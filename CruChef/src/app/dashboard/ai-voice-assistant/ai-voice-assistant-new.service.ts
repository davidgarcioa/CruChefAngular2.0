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

  isListening = signal(false);
  transcript = signal('');
  error = signal('');
  confidence = signal(0);
  isSupported = signal(this.checkMediaSupport());

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioStream: MediaStream | null = null;
  private pendingAudioBlob: Blob | null = null;

  constructor(private http: HttpClient) {
    console.log('[VoiceService] Inicializado. Backend URL:', this.BACKEND_URL);
  }

  private checkMediaSupport(): boolean {
    const supported = !!(
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia
    );
    console.log('[VoiceService] MediaRecorder soportado:', supported);
    return supported;
  }

  async startListening(): Promise<void> {
    if (!this.isSupported()) {
      this.error.set('MediaRecorder API no está soportada');
      return;
    }

    if (this.isListening()) {
      console.warn('[VoiceService] Ya está escuchando');
      return;
    }

    try {
      console.log('[VoiceService] Solicitando permiso de micrófono...');

      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Intentar con audio/webm (más soportado), si falla usar el default del navegador
      const options: MediaRecorderOptions = {};
      
      // Intentar webm primero (formato más ampliamente soportado)
      if (MediaRecorder.isTypeSupported('audio/webm')) {
        options.mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options.mimeType = 'audio/mp4';
      }
      // Si no hay mimeType, MediaRecorder usa el default del navegador

      this.mediaRecorder = new MediaRecorder(this.audioStream, options);

      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = () => {
        console.log('[VoiceService] Grabación terminada');
      };

      this.mediaRecorder.onerror = (event: Event) => {
        const error = (event as any).error;
        console.error('[VoiceService] Error MediaRecorder:', error);
        this.error.set(`Error de grabación: ${error}`);
      };

      this.mediaRecorder.start();
      this.isListening.set(true);
      this.error.set('');
      this.transcript.set('');
      this.confidence.set(0);

      console.log('[VoiceService] Grabación iniciada ✓');
    } catch (error: any) {
      console.error('[VoiceService] Error iniciando grabación:', error);

      if (error.name === 'NotAllowedError') {
        this.error.set('Permiso de micrófono denegado. Revisa la configuración.');
      } else if (error.name === 'NotFoundError') {
        this.error.set('No se encontró micrófono en tu dispositivo.');
      } else {
        this.error.set(`Error al acceder al micrófono: ${error.message}`);
      }
    }
  }

  async stopListening(): Promise<Blob | null> {
    if (!this.mediaRecorder || !this.isListening()) {
      return null;
    }

    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = async () => {
        this.isListening.set(false);

        if (this.audioStream) {
          this.audioStream.getTracks().forEach((track) => track.stop());
          this.audioStream = null;
        }

        if (this.audioChunks.length > 0) {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
          console.log(
            `[VoiceService] Audio grabado: ${audioBlob.size} bytes`
          );
          this.pendingAudioBlob = audioBlob;
          resolve(audioBlob);
        } else {
          resolve(null);
        }
      };

      this.mediaRecorder!.stop();
    });
  }

  async sendAudioToBackend(
    audioBlob: Blob,
    restaurantId: string
  ): Promise<DishResponse> {
    try {
      console.log('[VoiceService] Enviando audio al backend...');

      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.wav');
      formData.append('restaurant_id', restaurantId);

      const response = await firstValueFrom(
        this.http.post<DishResponse>(
          `${this.BACKEND_URL}/transcribe-and-create`,
          formData
        )
      );

      console.log('[VoiceService] Respuesta del backend:', response);

      if (response.success && response.dish) {
        this.transcript.set(response.transcript);
        this.confidence.set(response.dish.confidence || 0);
        this.error.set('');
        return response;
      } else {
        this.error.set(
          response.message || 'Error procesando el audio'
        );
        return response;
      }
    } catch (error: any) {
      console.error('[VoiceService] Error comunicándose con backend:', error);

      let errorMsg = 'Error conectando con el servicio de IA';

      if (error.status === 0) {
        errorMsg =
          'Backend no disponible. Inicia el servidor Python en puerto 8000';
      } else if (error.status === 500) {
        errorMsg = 'Error en servidor: ' + (error.error?.detail || error.message);
      } else if (error.statusText) {
        errorMsg = `Error ${error.status}: ${error.statusText}`;
      }

      this.error.set(errorMsg);
      throw error;
    }
  }

  abortListening(): void {
    if (this.mediaRecorder && this.isListening()) {
      this.mediaRecorder.stop();
      this.isListening.set(false);
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach((track) => track.stop());
    }
  }

  clearTranscript(): void {
    this.transcript.set('');
    this.error.set('');
    this.confidence.set(0);
    this.audioChunks = [];
    this.pendingAudioBlob = null;
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
      speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('[VoiceService] Error en speech synthesis:', error);
    }
  }

  parseVoiceCommand(text: string): VoiceCommand {
    return { dishName: text };
  }

  getPendingAudioBlob(): Blob | null {
    return this.pendingAudioBlob;
  }
}
