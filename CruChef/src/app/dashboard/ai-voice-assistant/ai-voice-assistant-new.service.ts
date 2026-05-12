import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface VoiceCommand {
  dishName?: string;
  price?: number;
  category?: string;
}

export interface DishResponse {
  success: boolean;
  message: string;
  code?: string;
  provider?: string;
  dish?: {
    name: string;
    price: number;
    category: string;
    confidence: number;
  };
  transcript: string;
}

@Injectable({
  providedIn: 'root',
})
export class AiVoiceAssistantService {
  private readonly BACKEND_URL = 'http://localhost:8000';
  private recognition: any = null;
  private stopResolver: ((transcript: string) => void) | null = null;

  isListening = signal(false);
  transcript = signal('');
  error = signal('');
  confidence = signal(0);
  isSupported = signal(this.checkSpeechRecognitionSupport());

  constructor(private http: HttpClient) {
    console.log(
      '[VoiceService] SpeechRecognition soportado:',
      this.isSupported()
    );
    console.log('[VoiceService] Inicializado. Backend URL:', this.BACKEND_URL);
  }

  private checkSpeechRecognitionSupport(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    const speechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    return !!speechRecognition;
  }

  private ensureRecognition(): any {
    if (this.recognition) {
      return this.recognition;
    }

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      throw new Error('SpeechRecognition API no esta soportada');
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'es-CO';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      this.isListening.set(true);
      this.error.set('');
      this.confidence.set(0);
    };

    recognition.onresult = (event: any) => {
      let fullTranscript = '';
      let bestConfidence = 0;

      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const alternative = result?.[0];
        const chunk = alternative?.transcript ?? '';
        fullTranscript += `${chunk} `;

        const rawConfidence =
          typeof alternative?.confidence === 'number'
            ? alternative.confidence
            : 0;

        if (rawConfidence > bestConfidence) {
          bestConfidence = rawConfidence;
        }
      }

      const normalizedTranscript = this.normalizeTranscript(fullTranscript);
      this.transcript.set(normalizedTranscript);

      if (bestConfidence > 0) {
        this.confidence.set(bestConfidence);
      } else if (normalizedTranscript) {
        this.confidence.set(0.85);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('[VoiceService] Error SpeechRecognition:', event);
      this.isListening.set(false);

      const errorCode = event?.error || '';
      let message = 'No fue posible reconocer la voz.';

      if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') {
        message = 'Permiso de microfono denegado. Revisa la configuracion del navegador.';
      } else if (errorCode === 'audio-capture') {
        message = 'No se detecto un microfono disponible.';
      } else if (errorCode === 'network') {
        message = 'SpeechRecognition no pudo usar la red del navegador.';
      } else if (errorCode === 'no-speech') {
        message = 'No se detecto voz. Intenta hablar mas cerca del microfono.';
      }

      this.error.set(message);

      if (this.stopResolver) {
        this.stopResolver(this.transcript().trim());
        this.stopResolver = null;
      }
    };

    recognition.onend = () => {
      this.isListening.set(false);

      if (this.stopResolver) {
        const resolve = this.stopResolver;
        this.stopResolver = null;
        resolve(this.transcript().trim());
      }
    };

    this.recognition = recognition;
    return recognition;
  }

  async startListening(): Promise<void> {
    if (!this.isSupported()) {
      this.error.set('SpeechRecognition no esta soportado en este navegador');
      return;
    }

    if (this.isListening()) {
      return;
    }

    try {
      this.transcript.set('');
      this.error.set('');
      this.confidence.set(0);

      const recognition = this.ensureRecognition();
      recognition.start();
    } catch (error: any) {
      console.error('[VoiceService] Error iniciando reconocimiento:', error);
      this.error.set(
        error?.message || 'No fue posible iniciar el reconocimiento de voz.'
      );
    }
  }

  async stopListening(): Promise<string> {
    if (!this.recognition || !this.isListening()) {
      return this.transcript().trim();
    }

    return new Promise((resolve) => {
      this.stopResolver = resolve;
      this.recognition.stop();
    });
  }

  async sendTranscriptToBackend(
    transcript: string,
    restaurantId: string
  ): Promise<DishResponse> {
    try {
      console.log('[VoiceService] Enviando transcript al backend...');

      const response = await firstValueFrom(
        this.http.post<DishResponse>(
          `${this.BACKEND_URL}/transcribe-and-create`,
          {
            transcript,
            restaurant_id: restaurantId,
          }
        )
      );

      console.log('[VoiceService] Respuesta del backend:', response);

      if (response.success && response.dish) {
        this.transcript.set(response.transcript);
        this.confidence.set(response.dish.confidence || 0);
        this.error.set('');
        return response;
      }

      this.error.set(response.message || 'Error procesando el transcript');
      return response;
    } catch (error: any) {
      console.error('[VoiceService] Error comunicandose con backend:', error);

      let errorMsg = 'Error conectando con el servicio de IA';
      const backendMessage = error?.error?.message || error?.error?.detail;

      if (error.status === 0) {
        errorMsg =
          'Backend no disponible. Inicia el servidor Python en puerto 8000';
      } else if (backendMessage) {
        errorMsg = backendMessage;
      } else if (error.statusText) {
        errorMsg = `Error ${error.status}: ${error.statusText}`;
      }

      this.error.set(errorMsg);
      throw new Error(errorMsg);
    }
  }

  abortListening(): void {
    if (this.recognition && this.isListening()) {
      this.recognition.stop();
    }
    this.isListening.set(false);

    if (this.stopResolver) {
      this.stopResolver(this.transcript().trim());
      this.stopResolver = null;
    }
  }

  clearTranscript(): void {
    this.transcript.set('');
    this.error.set('');
    this.confidence.set(0);
  }

  speak(text: string): void {
    if (!('speechSynthesis' in window)) {
      console.warn('[VoiceService] Speech Synthesis no soportado');
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      utterance.rate = 1;
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('[VoiceService] Error en speech synthesis:', error);
    }
  }

  parseVoiceCommand(text: string): VoiceCommand {
    return { dishName: this.normalizeTranscript(text) };
  }

  private normalizeTranscript(text: string): string {
    return text.trim().replace(/\s+/g, ' ');
  }
}
