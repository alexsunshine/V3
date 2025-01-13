import './style.css';
import * as Tone from 'tone';

class AudioVisualizer {
  constructor() {
    this.isRecording = false;
    this.timeline = [];
    this.setupUI();
    this.setupAudioAnalysis();
  }

  setupUI() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="min-h-screen bg-gray-900 p-8">
        <div class="max-w-4xl mx-auto">
          <h1 class="text-4xl font-bold text-white mb-8">Visualizador de Sonido a Color</h1>
          
          <div class="mb-8">
            <button id="startBtn" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded mr-4">
              Iniciar Micrófono
            </button>
            <button id="recordBtn" class="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded" disabled>
              Grabar
            </button>
          </div>

          <div class="bg-white rounded-lg p-8 mb-8">
            <div id="currentColor" class="w-full h-64 rounded-lg border-4 border-gray-200 transition-all duration-200"></div>
          </div>

          <div id="timeline" class="h-32 bg-gray-800 rounded-lg overflow-x-auto whitespace-nowrap p-4"></div>
        </div>
      </div>
    `;

    this.startBtn = document.getElementById('startBtn');
    this.recordBtn = document.getElementById('recordBtn');
    this.currentColor = document.getElementById('currentColor');
    this.timelineEl = document.getElementById('timeline');

    this.startBtn.addEventListener('click', () => this.startAudio());
    this.recordBtn.addEventListener('click', () => this.toggleRecording());
  }

  async setupAudioAnalysis() {
    this.analyzer = new Tone.Analyser('fft', 2048);
    this.meter = new Tone.Meter();
  }

  async startAudio() {
    try {
      await Tone.start();
      const mic = new Tone.UserMedia();
      await mic.open();
      
      mic.connect(this.analyzer);
      mic.connect(this.meter);

      this.startBtn.disabled = true;
      this.recordBtn.disabled = false;
      this.startAnalysis();
    } catch (error) {
      console.error('Error al acceder al micrófono:', error);
      alert('No se pudo acceder al micrófono. Por favor, permite el acceso al micrófono y recarga la página.');
    }
  }

  frequencyToWavelength(frequency) {
    const speedOfSound = 343;
    return speedOfSound / frequency;
  }

  soundToLightWavelength(soundWavelength) {
    const minSoundWL = this.frequencyToWavelength(20000);
    const maxSoundWL = this.frequencyToWavelength(20);
    
    const minLightWL = 380;
    const maxLightWL = 750;
    
    const logSoundWL = Math.log(soundWavelength);
    const logMinSoundWL = Math.log(minSoundWL);
    const logMaxSoundWL = Math.log(maxSoundWL);
    
    const normalizedPosition = (logSoundWL - logMinSoundWL) / (logMaxSoundWL - logMinSoundWL);
    return minLightWL + (maxLightWL - minLightWL) * (1 - normalizedPosition);
  }

  wavelengthToRGB(wavelength) {
    let r, g, b;
    
    if (wavelength >= 380 && wavelength < 440) {
      r = -(wavelength - 440) / (440 - 380);
      g = 0;
      b = 1;
    } else if (wavelength >= 440 && wavelength < 490) {
      r = 0;
      g = (wavelength - 440) / (490 - 440);
      b = 1;
    } else if (wavelength >= 490 && wavelength < 510) {
      r = 0;
      g = 1;
      b = -(wavelength - 510) / (510 - 490);
    } else if (wavelength >= 510 && wavelength < 580) {
      r = (wavelength - 510) / (580 - 510);
      g = 1;
      b = 0;
    } else if (wavelength >= 580 && wavelength < 645) {
      r = 1;
      g = -(wavelength - 645) / (645 - 580);
      b = 0;
    } else if (wavelength >= 645 && wavelength <= 750) {
      r = 1;
      g = 0;
      b = 0;
    } else {
      r = 0;
      g = 0;
      b = 0;
    }

    let factor = 1;
    if (wavelength > 700) {
      factor = 0.3 + 0.7 * (750 - wavelength) / (750 - 700);
    } else if (wavelength < 420) {
      factor = 0.3 + 0.7 * (wavelength - 380) / (420 - 380);
    }

    return {
      r: Math.round(r * 255 * factor),
      g: Math.round(g * 255 * factor),
      b: Math.round(b * 255 * factor)
    };
  }

  frequencyToColor(frequency, amplitude) {
    const soundWavelength = this.frequencyToWavelength(frequency);
    const lightWavelength = this.soundToLightWavelength(soundWavelength);
    return this.wavelengthToRGB(lightWavelength);
  }

  startAnalysis() {
    const analyzeFrame = () => {
      const frequencyData = this.analyzer.getValue();
      const volume = this.meter.getValue();
      
      const nyquist = Tone.context.sampleRate / 2;
      const threshold = -60;
      let totalEnergy = 0;
      let weightedColor = {r: 0, g: 0, b: 0};

      for (let i = 0; i < frequencyData.length; i++) {
        const amplitude = frequencyData[i];
        if (amplitude > threshold) {
          const frequency = (i * nyquist) / frequencyData.length;
          const weight = Math.pow(10, amplitude / 20);
          totalEnergy += weight;
          
          const color = this.frequencyToColor(frequency, amplitude);
          weightedColor.r += color.r * weight;
          weightedColor.g += color.g * weight;
          weightedColor.b += color.b * weight;
        }
      }

      if (totalEnergy > 0) {
        weightedColor.r = Math.round(weightedColor.r / totalEnergy);
        weightedColor.g = Math.round(weightedColor.g / totalEnergy);
        weightedColor.b = Math.round(weightedColor.b / totalEnergy);
      }

      // Ajustar la intensidad según el volumen (normalizado entre 0 y 1)
      const normalizedVolume = (volume + 100) / 100;
      const factor = Math.min(Math.max(normalizedVolume, 0), 1);
      const finalColor = `rgba(${weightedColor.r}, ${weightedColor.g}, ${weightedColor.b}, ${factor})`;
      
      this.currentColor.style.backgroundColor = finalColor;
      
      if (this.isRecording) {
        this.timeline.push({
          color: finalColor,
          timestamp: Date.now()
        });
        this.updateTimeline();
      }

      requestAnimationFrame(analyzeFrame);
    };

    analyzeFrame();
  }

  toggleRecording() {
    this.isRecording = !this.isRecording;
    this.recordBtn.textContent = this.isRecording ? 'Detener Grabación' : 'Grabar';
    this.recordBtn.classList.toggle('bg-red-500');
    this.recordBtn.classList.toggle('bg-gray-500');

    if (!this.isRecording) {
      this.timeline = [];
      this.updateTimeline();
    }
  }

  updateTimeline() {
    this.timelineEl.innerHTML = this.timeline
      .map(entry => `
        <div 
          class="inline-block w-8 h-full mx-1 rounded-sm" 
          style="background-color: ${entry.color}"
        ></div>
      `)
      .join('');
    
    this.timelineEl.scrollLeft = this.timelineEl.scrollWidth;
  }
}

// Inicializar la aplicación
new AudioVisualizer();