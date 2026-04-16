import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, inject, signal, computed, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { categories } from '../dashboard.data';
import { OwnerService } from '../owner.service';
import { AiVoiceAssistantService, DishResponse } from './ai-voice-assistant-web-speech.service';

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
  private readonly cdr = inject(ChangeDetectorRef);

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

  // NUEVOS: Signals para datos extraídos del backend
  readonly extractedDishName = signal('');
  readonly extractedDishPrice = signal(24000);
  readonly extractedDishCategory = signal('burgers');
  readonly hasExtractedData = computed(() => !!this.extractedDishName());

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
      console.log('[Component] ⏹️ stopListening() iniciado');
      this.dishError.set('');
      this.dishSuccess.set('');

      // Detener la grabación
      await this.voiceService.stopListening();
      console.log('[Component] voiceService.stopListening() completado');

      // Obtener el texto transcrito (puede estar vacío si falló)
      const transcript = this.voiceService.transcript();
      console.log('[Component] 📝 Transcript capturado:', transcript);
      console.log('[Component] Transcript longitud:', transcript?.length);
      console.log('[Component] Transcript está vacío:', !transcript || !transcript.trim());

      if (!transcript || !transcript.trim()) {
        console.warn('[Component] ⚠️ Transcript vacío o no capturado');
        this.voiceService.speak('No se detectó voz. Por favor intenta de nuevo.');
        this.dishError.set('No se detectó voz. Por favor intenta de nuevo.');
        return;
      }

      // Validar restaurante
      if (!this.selectedRestaurantId()) {
        console.warn('[Component] ⚠️ Restaurante no seleccionado');
        this.dishError.set('Por favor, selecciona un restaurante primero');
        return;
      }

      console.log('[Component] ✅ Enviando texto al backend');
      console.log('[Component] Transcript:', transcript);
      console.log('[Component] Restaurant ID:', this.selectedRestaurantId());

      this.isProcessing.set(true);

      // Enviar el texto al backend para extracción de datos
      const response = await this.voiceService.sendTextToBackend(
        transcript,
        this.selectedRestaurantId() || ''
      );

      console.log('[Component] ✅ Respuesta recibida del backend:', response);
      console.log('[Component] success:', response.success);
      console.log('[Component] dish:', response.dish);

      if (response.success && response.dish) {
        console.log('[Component] 🎯 Datos válidos, guardando en signals');

        const dishName = (response.dish.name || '').trim() || 'Plato del Día';
        const dishPrice = Number(response.dish.price) || 24000;
        const dishCategory = (response.dish.category || 'burgers').toLowerCase();

        console.log('[Component] Guardando:', { dishName, dishPrice, dishCategory });

        this.extractedDishName.set(dishName);
        this.extractedDishPrice.set(dishPrice);
        this.extractedDishCategory.set(dishCategory);

        console.log('[Component] ✅ Datos guardados en signals');
        console.log('[Component] hasExtractedData():', this.hasExtractedData());

        this.voiceService.speak(
          `Plato: ${dishName}. Precio: ${dishPrice} pesos. Categoría: ${dishCategory}. Por favor confirma.`
        );

        this.dishSuccess.set('✅ ' + response.message);
      } else {
        console.error('[Component] ❌ Respuesta inválida del backend:', response);
        const errorMsg = response.message || 'No se pudo procesar el comando';
        this.voiceService.speak(errorMsg);
        this.dishError.set(errorMsg);
      }
    } catch (error: any) {
      console.error('[Component] ❌ Error en stopListening:', error);
      console.error('[Component] Error message:', error.message);
      console.error('[Component] Error stack:', error.stack);

      this.voiceService.speak('Error procesando el comando. Intenta nuevamente.');
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

  applyExtractedDataToForm(): void {
    console.log('[Component] 📋 Creando plato desde datos extraídos');
    
    const dishName = this.extractedDishName();
    const dishPrice = this.extractedDishPrice();
    const dishCategory = this.extractedDishCategory();
    const restaurantId = this.selectedRestaurantId();

    console.log('[Component] 🎤 Datos a crear:', { dishName, dishPrice, dishCategory, restaurantId });

    if (!restaurantId) {
      this.voiceService.speak('Error: restaurante no seleccionado');
      this.dishError.set('Por favor selecciona un restaurante');
      return;
    }

    // Mostrar que está procesando
    this.isProcessing.set(true);
    this.dishSuccess.set('');
    this.dishError.set('');

    this.voiceService.speak('Guardando plato, por favor espera...');

    // Llamar directamente al endpoint de creación
    this.voiceService.createDishFromVoice(dishName, dishPrice, dishCategory, restaurantId).then(
      (response) => {
        console.log('[Component] ✅ Plato creado exitosamente:', response);
        
        this.dishSuccess.set(`✅ ${response.message}`);
        this.voiceService.speak(response.message || 'Plato creado exitosamente');

        // Limpiar todo después de 2 segundos
        setTimeout(() => {
          this.clearExtractedData();
          this.clearTranscript();
          this.dishSuccess.set('');
        }, 2000);
      },
      (error) => {
        console.error('[Component] ❌ Error creando plato:', error);
        
        const errorMsg = error.error?.message || error.message || 'Error al crear el plato';
        this.dishError.set(errorMsg);
        this.voiceService.speak('Error: ' + errorMsg);
      }
    ).finally(() => {
      this.isProcessing.set(false);
    });
  }

  clearExtractedData(): void {
    console.log('[Component] 🗑️ Limpiando datos extraídos');
    this.extractedDishName.set('');
    this.extractedDishPrice.set(24000);
    this.extractedDishCategory.set('burgers');
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

    if (!this.selectedRestaurantId()) {
      this.dishError.set('Por favor, selecciona un restaurante primero');
      return;
    }

    this.isProcessing.set(true);

    try {
      // Usar el backend (Deepseek) para procesar el texto
      this.voiceService.sendTextToBackend(text.trim(), this.selectedRestaurantId() || '')
        .then((response) => {
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
            this.voiceService.speak(response.message || 'Error procesando el texto');
            this.dishError.set(response.message || 'No se pudo procesar el texto');
          }
        })
        .catch((error) => {
          console.error('Error:', error);
          this.voiceService.speak('Error procesando el texto. Intenta nuevamente.');
          this.dishError.set(
            error.message || 'Error comunicándose con el servicio de IA'
          );
        })
        .finally(() => {
          this.isProcessing.set(false);
        });
    } catch (error: any) {
      console.error('Error:', error);
      this.isProcessing.set(false);
      this.dishError.set(error.message || 'Error procesando el texto');
    }
  }
}
