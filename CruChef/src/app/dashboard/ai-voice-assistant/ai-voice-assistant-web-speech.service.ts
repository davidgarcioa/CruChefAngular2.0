import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export interface VoiceCommand {
  dishName?: string;
  price?: number;
  category?: string;
}

export interface DishResponse {
  success: boolean;
  message: string;
  dish?: {
    name: string;
    price: number;
    category: string;
    confidence: number;
  };
  transcript: string;
  firebase_id?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AiVoiceAssistantService {
  private readonly BACKEND_URL = 'http://localhost:8000';
  private recognition: any = null;

  isListening = signal(false);
  transcript = signal('');
  error = signal('');
  confidence = signal(0);
  isSupported = signal(this.checkSupport());

  constructor(private http: HttpClient) {
    console.log('[Voice] Service initialized');
    this.initRecognition();
  }

  private checkSupport(): boolean {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    return !!SpeechRecognition;
  }

  private initRecognition(): void {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'es-ES';
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      console.log('[Voice] Recognition started');
      this.isListening.set(true);
      this.error.set('');
      this.transcript.set('');
    };

    this.recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += text + ' ';
          this.confidence.set(event.results[i][0].confidence);
        } else {
          interim += text;
        }
      }

      const recognized = (final || interim).trim();
      console.log('[Voice] Recognized:', recognized);
      this.transcript.set(recognized);
    };

    this.recognition.onerror = (event: any) => {
      console.error('[Voice] Error:', event.error);
      let msg = 'Error en reconocimiento de voz';

      if (event.error === 'network') msg = 'Error de red. Verifica Internet y volumen.';
      if (event.error === 'not-allowed') msg = 'Permiso de micrófono denegado.';
      if (event.error === 'no-speech') msg = 'No se detectó voz. Habla más fuerte o más cerca.';
      if (event.error === 'audio-capture') msg = 'No se encontró micrófono.';

      console.warn(`[Voice] Error detallado: ${msg}`);
      this.error.set(msg);
      this.isListening.set(false);
    };

    this.recognition.onend = () => {
      console.log('[Voice] Recognition ended');
      this.isListening.set(false);
    };
  }

  async startListening(): Promise<void> {
    if (!this.isSupported()) {
      this.error.set('Web Speech API no soportada');
      return;
    }

    if (!this.recognition) {
      this.error.set('Error inicializando reconocimiento');
      return;
    }

    if (this.isListening()) {
      console.warn('[Voice] Ya escuchando');
      return;
    }

    try {
      console.log('[Voice] Starting recognition...');
      this.recognition.start();
    } catch (err: any) {
      console.error('[Voice] Start error:', err);
      this.error.set(`Error: ${err.message}`);
    }
  }

  async stopListening(): Promise<Blob | null> {
    console.log('[Voice] stopListening() called');
    console.log('[Voice] isListening:', this.isListening());
    console.log('[Voice] Current transcript:', this.transcript());
    
    if (!this.recognition) {
      console.warn('[Voice] No recognition object');
      return null;
    }

    // Dejar que termine la grabación
    try {
      this.recognition.stop();
      console.log('[Voice] recognition.stop() called');
    } catch (err) {
      console.error('[Voice] Error calling stop():', err);
    }

    // Forzar a false inmediatamente para que se habiliten los campos
    this.isListening.set(false);
    console.log('[Voice] isListening set to false immediately');

    return null;
  }

  async sendTextToBackend(transcript: string, restaurantId: string): Promise<DishResponse> {
    try {
      console.log('[Voice] Enviando al backend:', { transcript, restaurantId });

      const payload = {
        transcript: transcript.trim(),
        restaurant_id: restaurantId
      };

      console.log('[Voice] Payload:', payload);

      const response = await firstValueFrom(
        this.http.post<DishResponse>(`${this.BACKEND_URL}/text-to-dish`, payload)
      );

      console.log('[Voice] Respuesta completa del backend:', response);
      console.log('[Voice] Dish data:', response.dish);

      if (response.success && response.dish) {
        this.transcript.set(response.transcript || transcript);
        this.confidence.set(response.dish.confidence || 0.7);
        this.error.set('');
        console.log('[Voice] ✅ Datos procesados exitosamente');
        return response;
      } else {
        const msg = response.message || 'Error procesando texto';
        this.error.set(msg);
        console.log('[Voice] ❌ Error en respuesta:', msg);
        return response;
      }
    } catch (error: any) {
      console.error('[Voice] Error de red:', error);
      console.error('[Voice] Error status:', error.status);
      console.error('[Voice] Error message:', error.message);

      let msg = 'Error conectando con el servicio';
      if (error.status === 0) msg = 'Backend no disponible. Inicia puerto 8000';
      if (error.status === 500) msg = 'Error en servidor';

      this.error.set(msg);
      throw error;
    }
  }

  async createDishFromVoice(name: string, price: number, category: string, restaurantId: string): Promise<any> {
    try {
      console.log('[Voice] 🎙️ Creando plato desde voz:', { name, price, category, restaurantId });

      const payload = {
        name: name.trim(),
        price: Number(price),
        category: category.trim().toLowerCase(),
        restaurant_id: restaurantId
      };

      console.log('[Voice] Enviando payload a /create-dish-from-voice:', payload);

      const response = await firstValueFrom(
        this.http.post<any>(`${this.BACKEND_URL}/create-dish-from-voice`, payload)
      );

      console.log('[Voice] Respuesta de creación:', response);

      if (response.success) {
        this.error.set('');
        console.log('[Voice] ✅ Plato creado exitosamente:', response);
        return response;
      } else {
        const msg = response.message || 'Error al crear el plato';
        this.error.set(msg);
        console.log('[Voice] ❌ Error en creación:', msg);
        throw new Error(msg);
      }
    } catch (error: any) {
      console.error('[Voice] Error creando plato:', error);

      let msg = 'Error al crear el plato';
      if (error.status === 0) msg = 'Backend no disponible';
      if (error.status === 400) msg = 'Datos inválidos: ' + (error.error?.message || '');
      if (error.status === 500) msg = 'Error en el servidor';

      this.error.set(msg);
      throw error;
    }
  }

  async sendAudioToBackend(audioBlob: Blob, restaurantId: string): Promise<DishResponse> {
    const txt = this.transcript();
    if (!txt) {
      return {
        success: false,
        message: 'No hay texto',
        transcript: ''
      };
    }
    return this.sendTextToBackend(txt, restaurantId);
  }

  abortListening(): void {
    if (this.recognition && this.isListening()) {
      try {
        this.recognition.abort();
      } catch (err) {
        console.error('[Voice] Abort error:', err);
      }
      this.isListening.set(false);
    }
  }

  clearTranscript(): void {
    this.transcript.set('');
    this.error.set('');
    this.confidence.set(0);
  }

  speak(text: string): void {
    if (!('speechSynthesis' in window)) {
      console.warn('[Voice] Speech Synthesis no soportado');
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      utterance.rate = 1;
      speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('[Voice] Synthesis error:', error);
    }
  }

  parseVoiceCommand(text: string): VoiceCommand {
    return { dishName: text };
  }

  getPendingAudioBlob(): Blob | null {
    return null;
  }
}
