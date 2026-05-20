import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { categories } from '../dashboard.data';
import { OwnerService } from '../owner.service';
import { AiVoiceAssistantService } from './ai-voice-assistant-new.service';
import {
  formMaxLengths,
  normalizeTextInput,
  trimmedRequired,
} from '../../shared/form-validators';

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

  readonly isListening = this.voiceService.isListening;
  readonly transcript = this.voiceService.transcript;
  readonly error = this.voiceService.error;
  readonly confidence = this.voiceService.confidence;
  readonly isVoiceSupported = this.voiceService.isSupported;

  readonly selectedRestaurantId = signal<string | null>(null);
  readonly restaurants = signal<any[]>([]);
  readonly isSavingDish = signal(false);
  readonly dishSuccess = signal('');
  readonly dishError = signal('');
  readonly showConfirmation = signal(false);
  readonly isProcessing = signal(false);
  readonly hasRequestedMicPermission = signal(false);
  readonly useManualMode = signal(false);

  readonly categoryOptions = categories.filter((category) => category.id !== 'all');

  readonly dishForm: FormGroup = this.fb.nonNullable.group({
    name: [
      '',
      [
        Validators.required,
        trimmedRequired,
        Validators.minLength(2),
        Validators.maxLength(formMaxLengths.dishName),
      ],
    ],
    price: [24000, [Validators.required, Validators.min(1000), Validators.max(1000000)]],
    categoryId: ['burgers', Validators.required],
  });

  readonly isFormValid = computed(() => {
    const formValid = this.dishForm.valid;
    const restaurantSelected = !!this.selectedRestaurantId();
    return formValid && restaurantSelected;
  });
  readonly canStartListening = computed(() => !this.isListening() && !this.isSavingDish());

  ngOnInit(): void {
    this.loadRestaurants();

    if (this.isVoiceSupported()) {
      this.voiceService.speak(
        'Sistema de voz con IA activado. Haz clic en iniciar cuando estes listo.'
      );
    }
  }

  ngOnDestroy(): void {
    this.voiceService.abortListening();
  }

  private loadRestaurants(): void {
    this.ownerService.getRestaurants().subscribe((restaurants: any[]) => {
      this.restaurants.set(restaurants);

      if (restaurants.length > 0) {
        const currentRestaurantId = this.selectedRestaurantId();
        if (!currentRestaurantId || !restaurants.find(r => r.id === currentRestaurantId)) {
          this.selectedRestaurantId.set(restaurants[0].id);
        }
      }
    });
  }

  async startListening(): Promise<void> {
    if (!this.isVoiceSupported()) {
      this.dishError.set('El reconocimiento de voz no esta soportado en este navegador.');
      return;
    }

    this.hasRequestedMicPermission.set(true);
    this.dishError.set('');
    this.dishSuccess.set('');
    await this.voiceService.startListening();
  }

  async stopListening(): Promise<void> {
    try {
      this.isProcessing.set(true);
      this.error.set('Procesando comando con IA...');

      const transcript = await this.voiceService.stopListening();
      if (!transcript) {
        this.voiceService.speak('No se detecto una instruccion valida. Intenta nuevamente.');
        return;
      }

      await this.processTranscript(transcript);
    } catch (error: any) {
      console.error('Error procesando voz:', error);
      this.voiceService.speak('Error procesando la voz. Intenta nuevamente.');
      this.dishError.set(error?.message || 'Error comunicandose con el servicio de IA');
    } finally {
      this.isProcessing.set(false);
    }
  }

  clearTranscript(): void {
    this.voiceService.clearTranscript();
    this.dishForm.reset({ categoryId: 'burgers', price: 24000 });
    this.dishError.set('');
    this.dishSuccess.set('');
  }

  confirmAndCreateDish(): void {
    if (!this.isFormValid() || !this.selectedRestaurantId()) {
      this.dishForm.markAllAsTouched();
      this.voiceService.speak('Por favor, completa todos los campos.');
      return;
    }

    const selectedRestaurant = this.restaurants().find(
      (restaurant) => restaurant.id === this.selectedRestaurantId()
    );
    if (!selectedRestaurant) {
      this.dishError.set('Selecciona un restaurante valido.');
      return;
    }

    this.showConfirmation.set(true);

    const formValue = this.dishForm.value;
    const categoryName =
      this.categoryOptions.find((category) => category.id === formValue.categoryId)?.name ||
      formValue.categoryId;

    this.voiceService.speak(
      `Confirma crear el plato ${formValue.name} de ${formValue.price} pesos en la categoria ${categoryName}.`
    );
  }

  async submitDish(): Promise<void> {
    if (this.dishForm.invalid) {
      this.dishForm.markAllAsTouched();
      return;
    }

    const restaurantId = this.selectedRestaurantId();
    if (!restaurantId) {
      this.dishError.set('Restaurante no valido.');
      return;
    }

    const selectedRestaurant = this.restaurants().find(
      (restaurant) => restaurant.id === restaurantId
    );
    if (!selectedRestaurant) {
      this.dishError.set('Restaurante no encontrado.');
      return;
    }

    this.isSavingDish.set(true);
    this.showConfirmation.set(false);
    this.dishError.set('');

    const formValue = this.dishForm.value;

    try {
      await this.ownerService.createDish(selectedRestaurant, {
        name: normalizeTextInput(formValue.name),
        price: formValue.price,
        categoryId: formValue.categoryId,
        stockRequirements: [],
      });

      this.dishSuccess.set(`OK Plato "${formValue.name}" creado exitosamente.`);
      this.voiceService.speak(`Plato ${formValue.name} creado exitosamente.`);
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
    this.voiceService.speak('Creacion de plato cancelada.');
  }

  toggleManualMode(): void {
    this.useManualMode.update((currentMode) => !currentMode);

    if (this.useManualMode()) {
      this.voiceService.speak(
        'Modo manual activado. Puedes escribir el comando directamente.'
      );
      this.voiceService.abortListening();
      this.clearTranscript();
      return;
    }

    this.voiceService.speak('Volviendo al modo de voz.');
  }

  retryVoiceInput(): void {
    this.clearTranscript();
    this.dishError.set('');
    setTimeout(() => this.startListening(), 300);
  }

  async processManualText(text: string): Promise<void> {
    if (!text || !text.trim()) {
      this.dishError.set('Por favor, escribe el nombre o la descripcion del plato.');
      return;
    }

    try {
      this.isProcessing.set(true);
      await this.processTranscript(text);
    } finally {
      this.isProcessing.set(false);
    }
  }

  private async processTranscript(transcript: string): Promise<void> {
    const restaurantId = this.selectedRestaurantId();
    if (!restaurantId) {
      this.dishError.set('Por favor, selecciona un restaurante primero.');
      return;
    }

    this.dishError.set('');
    this.dishSuccess.set('');

    const response = await this.voiceService.sendTranscriptToBackend(
      transcript,
      restaurantId
    );

    if (!response.success || !response.dish) {
      this.dishError.set(response.message || 'No se pudo procesar el comando.');
      this.voiceService.speak(response.message || 'No se pudo procesar el comando.');
      return;
    }

    this.dishForm.patchValue({
      name: response.dish.name,
      price: response.dish.price,
      categoryId: response.dish.category,
    });

    this.dishSuccess.set(`OK ${response.message}`);
    this.voiceService.speak(
      `Plato: ${response.dish.name}. Precio: ${response.dish.price} pesos. Categoria: ${response.dish.category}. Por favor confirma.`
    );
  }
}
