import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { categories } from '../dashboard.data';
import { OwnerService } from '../owner.service';
import { AiVoiceAssistantService, DishResponse } from './ai-voice-assistant-new.service';

@Component({
  selector: 'app-ai-voice-assistant',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, HttpClientModule],
  templateUrl: './ai-voice-assistant.component.html',
  styleUrl: './ai-voice-assistant.component.css',
  providers: [AiVoiceAssistantService],
})
export class AiVoiceAssistantComponent implements OnInit, OnDestroy {
  private readonly voiceService = inject(AiVoiceAssistantService);
  private readonly ownerService = inject(OwnerService);
  private readonly fb = inject(FormBuilder);

  // Voice service signals
  readonly isListening = this.voiceService.isListening;
  readonly transcript = this.voiceService.transcript;
  readonly error = this.voiceService.error;
  readonly confidence = this.voiceService.confidence;
  readonly isVoiceSupported = this.voiceService.isSupported;

  // Component signals
  readonly selectedRestaurantId = signal<string | null>(null);
  readonly restaurants = signal<any[]>([]);
  readonly isSavingDish = signal(false);
  readonly dishSuccess = signal('');
  readonly dishError = signal('');
  readonly showConfirmation = signal(false);
  readonly tempEditingDish = signal<any>(null);
  readonly isProcessing = signal(false);
  readonly hasRequestedMicPermission = signal(false);
  readonly useManualMode = signal(false);

  readonly categoryOptions = categories.filter((category) => category.id !== 'all');

  readonly dishForm: FormGroup = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    price: [24000, [Validators.required, Validators.min(1000)]],
    categoryId: ['burgers', Validators.required],
  });

  readonly isFormValid = computed(() => this.dishForm.valid);
  readonly canStartListening = computed(() => !this.isListening() && !this.isSavingDish());

  private pendingAudioBlob: Blob | null = null;

  ngOnInit(): void {
    this.loadRestaurants();

    if (this.isVoiceSupported()) {
      this.voiceService.speak('Sistema de voz con IA activado. Haz clic en iniciar grabación cuando estés listo.');
    }
  }

  ngOnDestroy(): void {
    this.voiceService.abortListening();
  }

  private loadRestaurants(): void {
    this.ownerService.getRestaurants().subscribe((restaurants: any[]) => {
      this.restaurants.set(restaurants);
      if (restaurants.length > 0 && !this.selectedRestaurantId()) {
        this.selectedRestaurantId.set(restaurants[0].id);
      }
    });
  }

  async startListening(): Promise<void> {
    if (!this.isVoiceSupported()) {
      this.dishError.set('El reconocimiento de voz no está soportado');
      return;
    }

    this.hasRequestedMicPermission.set(true);
    await this.voiceService.startListening();
  }

  async stopListening(): Promise<void> {
    try {
      this.isProcessing.set(true);
      this.error.set('Procesando audio con IA...');

      // Detener grabación y obtener el blob
      const audioBlob = await this.voiceService.stopListening();

      if (!audioBlob) {
        this.voiceService.speak('No se capturó audio. Intenta nuevamente.');
        this.isProcessing.set(false);
        return;
      }

      // Guardar para uso posterior
      this.pendingAudioBlob = audioBlob;

      // Enviar al backend Python
      if (!this.selectedRestaurantId()) {
        this.dishError.set('Por favor, selecciona un restaurante primero');
        this.isProcessing.set(false);
        return;
      }

      const response = await this.voiceService.sendAudioToBackend(
        audioBlob,
        this.selectedRestaurantId() || ''
      );

      if (response.success && response.dish) {
        // Actualizar formulario con datos del backend
        this.dishForm.patchValue({
          name: response.dish.name,
          price: response.dish.price,
          categoryId: response.dish.category,
        });

        this.voiceService.speak(
          `Plato: ${response.dish.name}. Precio: ${response.dish.price} pesos. Categoría: ${response.dish.category}. Por favor confirma.`
        );

        this.dishSuccess.set('✅ ' + response.message);
      } else {
        this.voiceService.speak(response.message || 'Error procesando el audio');
        this.dishError.set(response.message || 'No se pudo procesar el audio');
      }
    } catch (error: any) {
      console.error('Error:', error);
      this.voiceService.speak('Error procesando el audio. Intenta nuevamente.');
      this.dishError.set(
        error.message || 'Error comunicándose con el servicio de IA'
      );
    } finally {
      this.isProcessing.set(false);
    }
  }

  clearTranscript(): void {
    this.voiceService.clearTranscript();
    this.dishForm.reset({ categoryId: 'burgers', price: 24000 });
    this.dishError.set('');
    this.dishSuccess.set('');
    this.pendingAudioBlob = null;
  }

  confirmAndCreateDish(): void {
    if (!this.isFormValid() || !this.selectedRestaurantId()) {
      this.voiceService.speak('Por favor, complete todos los campos.');
      return;
    }

    const selectedRestaurant = this.restaurants().find(
      (r) => r.id === this.selectedRestaurantId()
    );
    if (!selectedRestaurant) {
      this.dishError.set('Seleccione un restaurante válido');
      return;
    }

    const formValue = this.dishForm.value;
    this.tempEditingDish.set(formValue);
    this.showConfirmation.set(true);

    const categoryName = this.categoryOptions.find(
      (c) => c.id === formValue.categoryId
    )?.name || formValue.categoryId;
    this.voiceService.speak(
      `¿Confirma crear el plato ${formValue.name} de ${formValue.price} pesos en la categoría ${categoryName}?`
    );
  }

  async submitDish(): Promise<void> {
    const formValue = this.dishForm.value;
    const restaurantId = this.selectedRestaurantId();

    if (!restaurantId) {
      this.dishError.set('Restaurante no válido');
      return;
    }

    // Obtener el restaurante completo
    const selectedRestaurant = this.restaurants().find(
      (r) => r.id === restaurantId
    );

    if (!selectedRestaurant) {
      this.dishError.set('Restaurante no encontrado');
      return;
    }

    this.isSavingDish.set(true);
    this.showConfirmation.set(false);

    try {
      await this.ownerService.createDish(selectedRestaurant, {
        name: formValue.name,
        price: formValue.price,
        categoryId: formValue.categoryId,
      });

      this.dishSuccess.set(`✅ Plato "${formValue.name}" creado exitosamente`);
      this.voiceService.speak(`Plato ${formValue.name} creado exitosamente`);
      this.clearTranscript();
      setTimeout(() => {
        this.dishSuccess.set('');
      }, 4000);
    } catch (error: any) {
      this.dishError.set('Error al crear el plato: ' + (error?.message || error));
      this.voiceService.speak('Error al crear el plato. Intenta nuevamente.');
    } finally {
      this.isSavingDish.set(false);
    }
  }

  cancelConfirmation(): void {
    this.showConfirmation.set(false);
    this.voiceService.speak('Creación de plato cancelada.');
  }

  toggleManualMode(): void {
    this.useManualMode.update((mode) => !mode);
    if (this.useManualMode()) {
      this.voiceService.speak('Modo manual activado. Puedes escribir directamente en los campos.');
      this.voiceService.abortListening();
      this.clearTranscript();
    } else {
      this.voiceService.speak('Volviendo al modo de voz.');
    }
  }

  retryVoiceInput(): void {
    this.clearTranscript();
    this.dishError.set('');
    setTimeout(() => this.startListening(), 300);
  }

  processManualText(text: string): void {
    if (!text || !text.trim()) {
      this.dishError.set('Por favor, introduce el nombre del plato');
      return;
    }

    this.isProcessing.set(true);

    try {
      // Intentar parsear el texto manual
      const command = this.voiceService.parseVoiceCommand(text);

      this.dishForm.patchValue({
        name: command.dishName || text,
        price: command.price || 24000,
        categoryId: command.category || 'burgers',
      });

      this.voiceService.speak(`Plato: ${command.dishName || text}. Por favor confirme.`);
    } finally {
      this.isProcessing.set(false);
    }
  }
}
