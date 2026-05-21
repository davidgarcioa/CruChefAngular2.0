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

interface TranscriptionResponse {
  success: boolean;
  message?: string;
  transcript: string;
  confidence?: number;
}

interface VoiceHealthResponse {
  openai_available?: boolean;
  deepseek_available?: boolean;
  local_whisper_available?: boolean;
  audio_transcription_available?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AiVoiceAssistantService {
  private readonly BACKEND_URL = 'http://localhost:8000';
  private recognition: any = null;
  private stopResolver: ((transcript: string) => void) | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private recordingStartedAt = 0;
  private backendAudioAvailable: boolean | null = null;

  isListening = signal(false);
  transcript = signal('');
  error = signal('');
  confidence = signal(0);
  isSupported = signal(this.checkAudioInputSupport());

  constructor(private http: HttpClient) {
    console.log(
      '[VoiceService] Entrada de voz soportada:',
      this.isSupported()
    );
    console.log('[VoiceService] Inicializado. Backend URL:', this.BACKEND_URL);
  }

  private checkAudioInputSupport(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    if (Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined') {
      return true;
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
      this.error.set('La entrada de voz no esta soportada en este navegador');
      return;
    }

    if (this.isListening()) {
      return;
    }

    try {
      this.transcript.set('');
      this.error.set('');
      this.confidence.set(0);

      if (await this.shouldUseBackendAudio()) {
        await this.startMediaRecording();
        return;
      }

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
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      return this.stopMediaRecording();
    }

    if (!this.recognition || !this.isListening()) {
      return this.transcript().trim();
    }

    return new Promise((resolve) => {
      this.stopResolver = resolve;
      this.recognition.stop();
    });
  }

  private async startMediaRecording(): Promise<void> {
    this.audioChunks = [];
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const mimeType = this.resolveRecordingMimeType();
    this.mediaRecorder = mimeType
      ? new MediaRecorder(this.mediaStream, { mimeType })
      : new MediaRecorder(this.mediaStream);

    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.onerror = (event) => {
      console.error('[VoiceService] Error MediaRecorder:', event);
      this.error.set('No fue posible grabar el audio del microfono.');
      this.isListening.set(false);
      this.stopMediaTracks();
    };

    this.recordingStartedAt = Date.now();
    this.mediaRecorder.start(250);
    this.isListening.set(true);
  }

  private async shouldUseBackendAudio(): Promise<boolean> {
    if (!this.canRecordAudio()) {
      return false;
    }

    return this.isBackendAudioAvailable();
  }

  private canRecordAudio(): boolean {
    return Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined';
  }

  private async isBackendAudioAvailable(): Promise<boolean> {
    if (this.backendAudioAvailable !== null) {
      return this.backendAudioAvailable;
    }

    try {
      const health = await firstValueFrom(
        this.http.get<VoiceHealthResponse>(`${this.BACKEND_URL}/health`)
      );
      this.backendAudioAvailable = Boolean(health.audio_transcription_available);
      return this.backendAudioAvailable;
    } catch {
      this.backendAudioAvailable = false;
      return false;
    }
  }

  private async stopMediaRecording(): Promise<string> {
    if (!this.mediaRecorder) {
      return '';
    }

    return new Promise((resolve) => {
      const recorder = this.mediaRecorder;
      if (!recorder) {
        resolve('');
        return;
      }

      recorder.onstop = async () => {
        this.isListening.set(false);
        this.stopMediaTracks();

        const recordingMs = Date.now() - this.recordingStartedAt;
        const blob = new Blob(this.audioChunks, {
          type: recorder.mimeType || 'audio/webm',
        });
        this.audioChunks = [];
        this.recordingStartedAt = 0;

        if (recordingMs < 700 || blob.size < 1200) {
          const message = 'La grabacion fue muy corta. Mantén Escuchar activo al menos un segundo y habla claramente.';
          this.error.set(message);
          resolve('');
          return;
        }

        try {
          const transcript = await this.transcribeAudio(blob);
          resolve(transcript);
        } catch (error: any) {
          const backendMessage = error?.error?.message || error?.error?.detail;
          const message =
            error?.status === 0
              ? 'Backend de voz no disponible. Inicia Python en http://localhost:8000.'
              : backendMessage || error?.message || 'No fue posible transcribir el audio grabado.';
          this.error.set(message);
          resolve('');
        }
      };

      recorder.stop();
    });
  }

  private async transcribeAudio(audioBlob: Blob): Promise<string> {
    const formData = new FormData();
    formData.append('file', audioBlob, 'voice.webm');

    let response: TranscriptionResponse;
    try {
      response = await firstValueFrom(
        this.http.post<TranscriptionResponse>(`${this.BACKEND_URL}/transcribe-only`, formData)
      );
    } catch (error: any) {
      const backendMessage = error?.error?.message || error?.error?.detail;
      const message =
        error?.status === 0
          ? 'Backend de voz no disponible. Inicia Python en http://localhost:8000.'
          : backendMessage || `El backend de voz respondio con error ${error?.status || ''}.`;
      throw new Error(message);
    }

    if (!response.success || !response.transcript) {
      throw new Error(response.message || 'El backend no devolvio una transcripcion valida.');
    }

    const transcript = this.normalizeTranscript(response.transcript);
    this.transcript.set(transcript);
    this.confidence.set(response.confidence || 1);
    this.error.set('');
    return transcript;
  }

  private resolveRecordingMimeType(): string {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ];

    return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || '';
  }

  private stopMediaTracks(): void {
    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.mediaStream = null;
    this.mediaRecorder = null;
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
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.stopMediaTracks();

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
