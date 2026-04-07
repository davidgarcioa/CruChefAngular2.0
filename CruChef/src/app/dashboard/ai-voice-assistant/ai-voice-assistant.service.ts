import { Injectable, signal } from '@angular/core';

export interface VoiceCommand {
  dishName?: string;
  price?: number;
  category?: string;
}

export interface VoiceServiceConfig {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxRetries: number;
  retryDelay: number;
}

@Injectable({
  providedIn: 'root',
})
export class AiVoiceAssistantService {
  private readonly SpeechRecognition = this.getSpeechRecognition();
  private readonly DEFAULT_CONFIG: VoiceServiceConfig = {
    language: 'es-ES',
    continuous: true,
    interimResults: true,
    maxRetries: 3,
    retryDelay: 1000,
  };

  isListening = signal(false);
  transcript = signal('');
  error = signal('');
  confidence = signal(0);
  isSupported = signal(this.SpeechRecognition !== null);

  private recognition: any;
  private accumulatedTranscript = '';
  private retryCount = 0;
  private config: VoiceServiceConfig;

  constructor() {
    this.config = this.DEFAULT_CONFIG;
    if (this.SpeechRecognition) {
      this.initializeRecognition();
    } else {
      this.error.set(
        'Speech Recognition API no está soportada en tu navegador. Por favor, usa Chrome, Edge o Safari.'
      );
    }
  }

  private getSpeechRecognition(): any {
    if (typeof window === 'undefined') {
      return null;
    }
    // Soporta múltiples navegadores
    const webkitSpeechRecognition = (window as any).webkitSpeechRecognition;
    const speechRecognition = (window as any).SpeechRecognition;
    const mozSpeechRecognition = (window as any).mozSpeechRecognition;

    return webkitSpeechRecognition || speechRecognition || mozSpeechRecognition;
  }

  private initializeRecognition(): void {
    try {
      this.recognition = new this.SpeechRecognition();

      // Configurar propiedades
      this.recognition.language = this.config.language;
      this.recognition.continuous = this.config.continuous;
      this.recognition.interimResults = this.config.interimResults;

      // Manejadores de eventos
      this.recognition.onstart = () => this.handleStart();
      this.recognition.onresult = (event: any) => this.handleResult(event);
      this.recognition.onerror = (event: any) => this.handleError(event);
      this.recognition.onend = () => this.handleEnd();

      console.debug('[VoiceService] Inicialización completada');
    } catch (error) {
      console.error('[VoiceService] Error durante inicialización:', error);
      this.error.set('Error al inicializar el reconocimiento de voz');
    }
  }

  startListening(): void {
    if (!this.isSupported()) {
      this.error.set('El reconocimiento de voz no está soportado');
      return;
    }

    if (this.isListening()) {
      console.warn('[VoiceService] Ya está escuchando');
      return;
    }

    try {
      this.accumulatedTranscript = '';
      this.transcript.set('');
      this.error.set('');
      this.retryCount = 0;
      this.confidence.set(0);

      this.recognition.start();
      console.debug('[VoiceService] Escucha iniciada');
    } catch (error) {
      console.error('[VoiceService] Error al iniciar escucha:', error);
      this.error.set('Error al iniciar el reconocimiento de voz');
    }
  }

  stopListening(): void {
    if (this.recognition && this.isListening()) {
      try {
        this.recognition.stop();
        console.debug('[VoiceService] Escucha detenida');
      } catch (error) {
        console.error('[VoiceService] Error al detener:', error);
      }
    }
  }

  abortListening(): void {
    if (this.recognition) {
      try {
        this.recognition.abort();
        this.isListening.set(false);
        console.debug('[VoiceService] Escucha abortada');
      } catch (error) {
        console.error('[VoiceService] Error al abortar:', error);
      }
    }
  }

  clearTranscript(): void {
    this.accumulatedTranscript = '';
    this.transcript.set('');
    this.error.set('');
    this.confidence.set(0);
  }

  private handleStart(): void {
    this.isListening.set(true);
    this.error.set('');
    console.debug('[VoiceService] Escucha iniciada correctamente');
  }

  private handleResult(event: any): void {
    try {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        const confidence = event.results[i][0].confidence;

        if (event.results[i].isFinal) {
          this.accumulatedTranscript += transcript + ' ';
          console.debug(`[VoiceService] Frase final: "${transcript}" (confianza: ${(confidence * 100).toFixed(0)}%)`);
        } else {
          interimTranscript += transcript;
        }
      }

      this.transcript.set(this.accumulatedTranscript + interimTranscript);

      const lastResult = event.results[event.results.length - 1];
      if (lastResult && lastResult[0]) {
        this.confidence.set(lastResult[0].confidence);
      }
    } catch (error) {
      console.error('[VoiceService] Error procesando resultado:', error);
    }
  }

  private handleError(event: any): void {
    const errorMessage = this.getErrorMessage(event.error);
    console.error(`[VoiceService] Error de reconocimiento: ${event.error}`, errorMessage);
    console.warn(`[VoiceService] Estado actual - isListening: ${this.isListening()}, retryCount: ${this.retryCount}`);

    // Intentar reintentar en caso de errores de red
    if (
      (event.error === 'network' || event.error === 'service-unavailable') &&
      this.retryCount < this.config.maxRetries
    ) {
      this.retryCount++;
      this.error.set(`Error de conexión. Reintentando... (${this.retryCount}/${this.config.maxRetries})`);
      
      console.warn(`[VoiceService] Reintentando (${this.retryCount}/${this.config.maxRetries}) después de ${this.config.retryDelay}ms`);

      // Esperar a que la escucha se detenga completamente antes de reintentar
      setTimeout(() => {
        try {
          // Asegurarse de que el recognition está en estado stopped
          this.recognition.abort();
          console.debug('[VoiceService] Recognition abortado antes de reintentar');
          
          // Pequeño delay adicional para asegurar estado limpio
          setTimeout(() => {
            try {
              this.accumulatedTranscript = '';
              this.transcript.set('');
              this.confidence.set(0);
              
              console.debug('[VoiceService] Iniciando reintento de escucha...');
              this.recognition.start();
              console.debug('[VoiceService] Reintento iniciado exitosamente');
            } catch (retryError) {
              console.error('[VoiceService] Error en reintento:', retryError);
              this.error.set(errorMessage);
            }
          }, 300);
        } catch (abortError) {
          console.error('[VoiceService] Error al abortar antes de reintentar:', abortError);
          this.error.set(errorMessage);
        }
      }, this.config.retryDelay);
    } else {
      this.error.set(errorMessage);
      
      // Si se alcanzó el máximo de reintentos, mostrar mensaje más específico
      if (event.error === 'network' || event.error === 'service-unavailable') {
        console.error(`[VoiceService] Se alcanzó el máximo de reintentos (${this.config.maxRetries})`);
      }
    }
  }

  private handleEnd(): void {
    this.isListening.set(false);
    console.debug('[VoiceService] Escucha finalizada');
  }

  private getErrorMessage(errorCode: string): string {
    const errorMap: { [key: string]: string } = {
      'no-speech': 'No se detectó voz. Por favor, intente nuevamente con mayor claridad.',
      'audio-capture': 'Micrófono no disponible. Compruebe los permisos.',
      'not-allowed': 'Permiso de micrófono denegado. Por favor, otorgue permiso.',
      'network': 'Error de red. Compruebe su conexión a Internet.',
      'service-unavailable': 'Servicio de reconocimiento no disponible. Intente más tarde.',
      'bad-grammar': 'Error en el reconocimiento. Intente nuevamente.',
      'unknown': 'Error desconocido en el reconocimiento de voz.',
    };

    return errorMap[errorCode] || `Error: ${errorCode}`;
  }

  parseVoiceCommand(text: string): VoiceCommand {
    const command: VoiceCommand = {};

    if (!text || text.trim().length === 0) {
      return command;
    }

    // Expresiones regulares mejoradas para extraer información
    const priceMatch = text.match(/(\d{1,7})\s*(pesos|cop|colones|dólares|usd|\$)?/i);

    const categoryKeywords: { [key: string]: string } = {
      burger: 'burgers',
      hamburguesa: 'burgers',
      'hamburguesas': 'burgers',
      pizza: 'pizza',
      'pizzas': 'pizza',
      taco: 'tacos',
      'tacos': 'tacos',
      sushi: 'sushi',
      pasta: 'pasta',
      'pastas': 'pasta',
      pollo: 'chicken',
      'pollos': 'chicken',
      combo: 'combo',
      'combos': 'combo',
      postre: 'desserts',
      'postres': 'desserts',
      bebida: 'drinks',
      'bebidas': 'drinks',
      desayuno: 'breakfast',
      'desayunos': 'breakfast',
      ensalada: 'salads',
      'ensaladas': 'salads',
    };

    // Extraer precio
    if (priceMatch) {
      const price = parseInt(priceMatch[1], 10);
      if (price >= 1000 && price <= 9999999) {
        command.price = price;
      }
    }

    // Extraer categoría
    const textLower = text.toLowerCase();
    for (const keyword in categoryKeywords) {
      if (textLower.includes(keyword)) {
        command.category = categoryKeywords[keyword];
        break;
      }
    }

    // Extraer nombre del plato
    let dishName = text
      .toLowerCase()
      .replace(/(\d{1,7})\s*(pesos|cop|colones|dólares|usd|\$)?/i, '')
      .trim();

    // Remover palabras de categoría
    for (const keyword in categoryKeywords) {
      dishName = dishName.replace(new RegExp(`\\b${keyword}\\b`, 'gi'), '').trim();
    }

    // Limpiar palabras comunes
    dishName = dishName
      .replace(/\b(un|una|el|la|de|en|con|por)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (dishName.length >= 2) {
      command.dishName = dishName.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }

    console.debug('[VoiceService] Comando parseado:', command);
    return command;
  }

  speak(text: string): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-ES';
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;

        speechSynthesis.cancel();
        speechSynthesis.speak(utterance);

        console.debug('[VoiceService] Síntesis iniciada:', text);
      } catch (error) {
        console.error('[VoiceService] Error en síntesis de voz:', error);
      }
    }
  }

  setLanguage(language: string): void {
    this.config.language = language;
    if (this.recognition) {
      this.recognition.language = language;
    }
  }
}
