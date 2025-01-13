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
    // ... (código UI sin cambios)
  }

  async setupAudioAnalysis() {
    this.analyzer = new Tone.Analyser('fft', 2048);
    this.meter = new Tone.Meter();
  }

  frequencyToWavelength(frequency) {
    // Velocidad del sonido en el aire (m/s)
    const speedOfSound = 343;
    return speedOfSound / frequency;
  }

  // Convierte una longitud de onda de sonido a una "longitud de onda" equivalente en el espectro visible
  soundToLightWavelength(soundWavelength) {
    // El espectro visible va aproximadamente de 380nm a 750nm
    // Mapearemos las frecuencias audibles (20Hz - 20kHz) a este rango
    const minSoundWL = this.frequencyToWavelength(20000); // ~0.01715m
    const maxSoundWL = this.frequencyToWavelength(20);    // ~17.15m
    
    const minLightWL = 380;  // nanómetros
    const maxLightWL = 750;  // nanómetros
    
    // Mapeo logarítmico para una distribución más natural
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

    // Ajustar la intensidad en los extremos del espectro
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
      const volume = this.meter.getValue() + 100; // Normalizar el volumen
      
      // Encontrar todas las frecuencias significativas
      const nyquist = Tone.context.sampleRate / 2;
      const threshold = -60;
      let totalEnergy = 0;
      let weightedColor = {r: 0, g: 0, b: 0};

      for (let i = 0; i < frequencyData.length; i++) {
        const amplitude = frequencyData[i];
        if (amplitude > threshold) {
          const frequency = (i * nyquist) / frequencyData.length;
          const weight = Math.pow(10, amplitude / 20); // Convertir dB a escala lineal
          totalEnergy += weight;
          
          const color = this.frequencyToColor(frequency, amplitude);
          weightedColor.r += color.r * weight;
          weightedColor.g += color.g * weight;
          weightedColor.b += color.b * weight;
        }
      }

      // Normalizar el color resultante
      if (totalEnergy > 0) {
        weightedColor.r = Math.round(weightedColor.r / totalEnergy);
        weightedColor.g = Math.round(weightedColor.g / totalEnergy);
        weightedColor.b = Math.round(weightedColor.b / totalEnergy);
      }

      // Ajustar la intensidad según el volumen
      const factor = Math.min(Math.max(volume / 100, 0), 1);
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

  // ... (resto del código sin cambios)
}

// Inicializar la aplicación
new AudioVisualizer();