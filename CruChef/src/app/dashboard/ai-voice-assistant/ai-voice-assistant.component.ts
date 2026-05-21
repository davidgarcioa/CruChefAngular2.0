import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DishStockRequirement } from '../../models/dish.model';
import { InventoryItem } from '../../models/inventory-item.model';
import { Restaurant } from '../../models/restaurant.model';
import { formMaxLengths, normalizeTextInput } from '../../shared/form-validators';
import { categories } from '../dashboard.data';
import { InventoryFormValue, OwnerService } from '../owner.service';
import { AiVoiceAssistantService } from './ai-voice-assistant-new.service';

type AssistantMode = 'idle' | 'dish' | 'inventory';
type DishStep = 'name' | 'price' | 'category' | 'stock-item' | 'stock-quantity' | 'confirm';
type InventoryStep = 'name' | 'quantity' | 'unit' | 'minimum' | 'confirm';

interface AssistantMessage {
  role: 'assistant' | 'user' | 'system';
  text: string;
}

interface DishDraft {
  name: string;
  price: number | null;
  categoryId: string;
  stockRequirements: DishStockRequirement[];
}

interface InventoryDraft {
  name: string;
  quantity: number | null;
  unit: string;
  minimum: number | null;
}

@Component({
  selector: 'app-ai-voice-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-voice-assistant.component.html',
  styleUrl: './ai-voice-assistant.component.css',
  providers: [AiVoiceAssistantService],
})
export class AiVoiceAssistantComponent implements OnInit, OnDestroy {
  private readonly voiceService = inject(AiVoiceAssistantService);
  private readonly ownerService = inject(OwnerService);

  readonly isListening = this.voiceService.isListening;
  readonly transcript = this.voiceService.transcript;
  readonly voiceError = this.voiceService.error;
  readonly isVoiceSupported = this.voiceService.isSupported;

  readonly restaurants = signal<Restaurant[]>([]);
  readonly inventoryItems = signal<InventoryItem[]>([]);
  readonly selectedRestaurantId = signal<string | null>(null);
  readonly mode = signal<AssistantMode>('idle');
  readonly dishStep = signal<DishStep>('name');
  readonly inventoryStep = signal<InventoryStep>('name');
  readonly isSaving = signal(false);
  readonly statusMessage = signal('');
  readonly errorMessage = signal('');
  readonly pendingStockItemId = signal<string | null>(null);
  readonly messages = signal<AssistantMessage[]>([]);

  readonly categoryOptions = categories.filter((category) => category.id !== 'all');
  readonly manualText = signal('');
  readonly dishDraft = signal<DishDraft>({
    name: '',
    price: null,
    categoryId: '',
    stockRequirements: [],
  });
  readonly inventoryDraft = signal<InventoryDraft>({
    name: '',
    quantity: null,
    unit: 'unid',
    minimum: 0,
  });

  readonly selectedRestaurant = computed(() =>
    this.restaurants().find((restaurant) => restaurant.id === this.selectedRestaurantId()) ?? null,
  );

  readonly currentPrompt = computed(() => {
    if (!this.selectedRestaurant()) {
      return 'Selecciona un restaurante para iniciar el asistente.';
    }

    if (this.mode() === 'idle') {
      return 'Di si quieres crear un plato o registrar un insumo.';
    }

    if (this.mode() === 'dish') {
      const step = this.dishStep();
      if (step === 'name') return 'Dime el nombre del plato.';
      if (step === 'price') return 'Dime el precio del plato en pesos.';
      if (step === 'category') return 'Elige una categoria por voz o desde las opciones.';
      if (step === 'stock-item') return 'Selecciona un insumo para descontar al crear el plato.';
      if (step === 'stock-quantity') return 'Dime la cantidad de ese insumo que usa cada plato.';
      return 'Confirma si quieres guardar este plato.';
    }

    const step = this.inventoryStep();
    if (step === 'name') return 'Dime el nombre del insumo.';
    if (step === 'quantity') return 'Dime la cantidad disponible.';
    if (step === 'unit') return 'Dime la unidad de medida.';
    if (step === 'minimum') return 'Dime el minimo para alerta de inventario.';
    return 'Confirma si quieres guardar este insumo.';
  });

  readonly canSaveDish = computed(() => {
    const draft = this.dishDraft();
    return (
      !!this.selectedRestaurant() &&
      draft.name.length >= 2 &&
      Number(draft.price) >= 1000 &&
      !!draft.categoryId &&
      draft.stockRequirements.length > 0
    );
  });

  readonly canSaveInventory = computed(() => {
    const draft = this.inventoryDraft();
    return (
      !!this.selectedRestaurant() &&
      draft.name.length >= 2 &&
      Number(draft.quantity) >= 0 &&
      draft.unit.trim().length > 0 &&
      Number(draft.minimum) >= 0
    );
  });

  ngOnInit(): void {
    this.ownerService.getRestaurants().subscribe((restaurants) => {
      this.restaurants.set(restaurants);
      const currentId = this.selectedRestaurantId();
      if (restaurants.length && (!currentId || !restaurants.some((item) => item.id === currentId))) {
        this.selectedRestaurantId.set(restaurants[0].id);
        this.loadInventory(restaurants[0].id);
      }

      if (!restaurants.length) {
        this.selectedRestaurantId.set(null);
        this.inventoryItems.set([]);
      }
    });

    this.addAssistantMessage('Selecciona un restaurante y luego inicia con plato o insumo.');
  }

  ngOnDestroy(): void {
    this.voiceService.abortListening();
  }

  selectRestaurant(restaurantId: string): void {
    this.selectedRestaurantId.set(restaurantId || null);
    this.loadInventory(restaurantId);
    this.resetFlow(false);
    const restaurant = this.selectedRestaurant();
    if (restaurant) {
      this.addSystemMessage(`Restaurante activo: ${restaurant.name}.`);
    }
  }

  startDishFlow(): void {
    if (!this.ensureRestaurant()) return;
    this.mode.set('dish');
    this.dishStep.set('name');
    this.errorMessage.set('');
    this.statusMessage.set('');
    this.dishDraft.set({ name: '', price: null, categoryId: '', stockRequirements: [] });
    this.pendingStockItemId.set(null);
    this.askCurrentStep();
  }

  startInventoryFlow(): void {
    if (!this.ensureRestaurant()) return;
    this.mode.set('inventory');
    this.inventoryStep.set('name');
    this.errorMessage.set('');
    this.statusMessage.set('');
    this.inventoryDraft.set({ name: '', quantity: null, unit: 'unid', minimum: 0 });
    this.askCurrentStep();
  }

  async startListening(): Promise<void> {
    this.errorMessage.set('');
    this.statusMessage.set('');

    if (!this.isVoiceSupported()) {
      this.errorMessage.set('Este navegador no soporta reconocimiento de voz. Usa Chrome o Edge.');
      return;
    }

    if (this.mode() === 'idle' && !this.ensureRestaurant()) {
      return;
    }

    await this.voiceService.startListening();
  }

  async stopListening(): Promise<void> {
    const text = await this.voiceService.stopListening();
    if (!text && this.voiceError()) {
      this.errorMessage.set(this.voiceError());
      return;
    }
    this.handleText(text);
  }

  handleManualText(): void {
    const text = this.manualText();
    this.manualText.set('');
    this.handleText(text);
  }

  handleText(rawText: string): void {
    const text = this.cleanText(rawText);
    if (!text) {
      this.errorMessage.set(this.voiceError() || 'No se detecto una respuesta valida.');
      return;
    }

    this.addUserMessage(text);
    this.errorMessage.set('');
    this.statusMessage.set('');

    if (this.mode() === 'idle') {
      this.resolveInitialIntent(text);
      return;
    }

    if (this.mode() === 'dish') {
      this.handleDishStep(text);
      return;
    }

    this.handleInventoryStep(text);
  }

  selectCategory(categoryId: string): void {
    this.dishDraft.update((draft) => ({ ...draft, categoryId }));
    this.dishStep.set(this.inventoryItems().length ? 'stock-item' : 'confirm');
    this.addSystemMessage(`Categoria seleccionada: ${this.getCategoryName(categoryId)}.`);
    this.askCurrentStep();
  }

  selectStockItem(itemId: string): void {
    const item = this.inventoryItems().find((inventoryItem) => inventoryItem.id === itemId);
    if (!item) return;
    this.pendingStockItemId.set(item.id);
    this.dishStep.set('stock-quantity');
    this.addSystemMessage(`Insumo seleccionado: ${item.name}.`);
    this.askCurrentStep();
  }

  removeStockRequirement(itemId: string): void {
    this.dishDraft.update((draft) => ({
      ...draft,
      stockRequirements: draft.stockRequirements.filter((item) => item.itemId !== itemId),
    }));
  }

  async saveCurrentDraft(): Promise<void> {
    if (this.mode() === 'dish') {
      await this.saveDish();
      return;
    }

    if (this.mode() === 'inventory') {
      await this.saveInventoryItem();
    }
  }

  resetFlow(speak = true): void {
    this.voiceService.abortListening();
    this.mode.set('idle');
    this.dishStep.set('name');
    this.inventoryStep.set('name');
    this.pendingStockItemId.set(null);
    this.errorMessage.set('');
    if (speak) this.askCurrentStep();
  }

  private handleDishStep(text: string): void {
    const step = this.dishStep();

    if (step === 'name') {
      const name = this.toTitleCase(text);
      if (name.length < 2 || name.length > formMaxLengths.dishName) {
        this.rejectAndRepeat('El nombre del plato debe tener entre 2 y 80 caracteres.');
        return;
      }
      this.dishDraft.update((draft) => ({ ...draft, name }));
      this.dishStep.set('price');
      this.askCurrentStep();
      return;
    }

    if (step === 'price') {
      const price = this.extractNumber(text);
      if (!Number.isFinite(price) || price < 1000 || price > 1000000) {
        this.rejectAndRepeat('El precio debe estar entre 1000 y 1000000 pesos.');
        return;
      }
      this.dishDraft.update((draft) => ({ ...draft, price }));
      this.dishStep.set('category');
      this.askCurrentStep();
      return;
    }

    if (step === 'category') {
      const categoryId = this.resolveCategoryId(text);
      if (!categoryId) {
        this.rejectAndRepeat('No encontre esa categoria. Puedes decir una de las opciones visibles.');
        return;
      }
      this.selectCategory(categoryId);
      return;
    }

    if (step === 'stock-item') {
      if (this.isAffirmativeSkip(text) && this.dishDraft().stockRequirements.length > 0) {
        this.dishStep.set('confirm');
        this.askCurrentStep();
        return;
      }

      const item = this.resolveInventoryItem(text);
      if (!item) {
        this.rejectAndRepeat('No encontre ese insumo en el inventario del restaurante.');
        return;
      }
      this.selectStockItem(item.id);
      return;
    }

    if (step === 'stock-quantity') {
      const itemId = this.pendingStockItemId();
      const item = this.inventoryItems().find((inventoryItem) => inventoryItem.id === itemId);
      const quantity = this.extractNumber(text);
      if (!item || !Number.isFinite(quantity) || quantity <= 0) {
        this.rejectAndRepeat('La cantidad por plato debe ser mayor que cero.');
        return;
      }

      const requirement = {
        itemId: item.id,
        name: item.name,
        unit: item.unit,
        quantity,
      };

      this.dishDraft.update((draft) => ({
        ...draft,
        stockRequirements: [
          ...draft.stockRequirements.filter((current) => current.itemId !== item.id),
          requirement,
        ],
      }));
      this.pendingStockItemId.set(null);
      this.dishStep.set('stock-item');
      this.addSystemMessage(`${quantity} ${item.unit} de ${item.name} agregado a la receta.`);
      this.voiceService.speak('Insumo agregado. Di otro insumo o di listo para confirmar.');
      return;
    }

    if (this.isAffirmative(text)) {
      void this.saveDish();
      return;
    }

    if (this.isNegative(text)) {
      this.addSystemMessage('Guardado cancelado.');
      this.resetFlow();
      return;
    }

    this.rejectAndRepeat('Responde si para guardar o no para cancelar.');
  }

  private handleInventoryStep(text: string): void {
    const step = this.inventoryStep();

    if (step === 'name') {
      const name = this.toTitleCase(text);
      if (name.length < 2 || name.length > 60) {
        this.rejectAndRepeat('El nombre del insumo debe tener entre 2 y 60 caracteres.');
        return;
      }
      this.inventoryDraft.update((draft) => ({ ...draft, name }));
      this.inventoryStep.set('quantity');
      this.askCurrentStep();
      return;
    }

    if (step === 'quantity') {
      const quantity = this.extractNumber(text);
      if (!Number.isFinite(quantity) || quantity < 0) {
        this.rejectAndRepeat('La cantidad no puede ser negativa.');
        return;
      }
      this.inventoryDraft.update((draft) => ({ ...draft, quantity }));
      this.inventoryStep.set('unit');
      this.askCurrentStep();
      return;
    }

    if (step === 'unit') {
      const unit = this.normalizeUnit(text);
      if (!unit) {
        this.rejectAndRepeat('La unidad de medida es obligatoria.');
        return;
      }
      this.inventoryDraft.update((draft) => ({ ...draft, unit }));
      this.inventoryStep.set('minimum');
      this.askCurrentStep();
      return;
    }

    if (step === 'minimum') {
      const minimum = this.extractNumber(text);
      if (!Number.isFinite(minimum) || minimum < 0) {
        this.rejectAndRepeat('El minimo no puede ser negativo.');
        return;
      }
      this.inventoryDraft.update((draft) => ({ ...draft, minimum }));
      this.inventoryStep.set('confirm');
      this.askCurrentStep();
      return;
    }

    if (this.isAffirmative(text)) {
      void this.saveInventoryItem();
      return;
    }

    if (this.isNegative(text)) {
      this.addSystemMessage('Guardado cancelado.');
      this.resetFlow();
      return;
    }

    this.rejectAndRepeat('Responde si para guardar o no para cancelar.');
  }

  private async saveDish(): Promise<void> {
    const restaurant = this.selectedRestaurant();
    const draft = this.dishDraft();

    if (!restaurant || !this.canSaveDish()) {
      this.rejectAndRepeat('Faltan datos para guardar el plato.');
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set('');
    try {
      await this.ownerService.createDish(restaurant, {
        name: normalizeTextInput(draft.name),
        price: Number(draft.price),
        categoryId: draft.categoryId,
        stockRequirements: draft.stockRequirements,
      });
      this.statusMessage.set(`Plato "${draft.name}" guardado en ${restaurant.name}.`);
      this.addSystemMessage('Plato guardado correctamente en la coleccion del restaurante.');
      this.voiceService.speak('Plato guardado correctamente.');
      this.loadInventory(restaurant.id);
      this.resetFlow(false);
    } catch (error) {
      this.errorMessage.set(this.ownerService.getErrorMessage(error));
      this.voiceService.speak('No pude guardar el plato. Revisa el mensaje en pantalla.');
    } finally {
      this.isSaving.set(false);
    }
  }

  private async saveInventoryItem(): Promise<void> {
    const restaurant = this.selectedRestaurant();
    const draft = this.inventoryDraft();

    if (!restaurant || !this.canSaveInventory()) {
      this.rejectAndRepeat('Faltan datos para guardar el insumo.');
      return;
    }

    const payload: InventoryFormValue = {
      name: normalizeTextInput(draft.name),
      quantity: Number(draft.quantity),
      unit: normalizeTextInput(draft.unit),
      minimum: Number(draft.minimum),
    };

    this.isSaving.set(true);
    this.errorMessage.set('');
    try {
      await this.ownerService.createInventoryItem(restaurant.id, payload);
      this.statusMessage.set(`Insumo "${payload.name}" registrado en ${restaurant.name}.`);
      this.addSystemMessage('Insumo guardado correctamente en el inventario del restaurante.');
      this.voiceService.speak('Insumo guardado correctamente.');
      this.loadInventory(restaurant.id);
      this.resetFlow(false);
    } catch (error) {
      this.errorMessage.set(this.ownerService.getErrorMessage(error));
      this.voiceService.speak('No pude guardar el insumo. Revisa el mensaje en pantalla.');
    } finally {
      this.isSaving.set(false);
    }
  }

  private resolveInitialIntent(text: string): void {
    if (this.includesAny(text, ['plato', 'comida', 'producto', 'menu', 'menú'])) {
      this.startDishFlow();
      return;
    }

    if (this.includesAny(text, ['insumo', 'inventario', 'ingrediente', 'materia prima'])) {
      this.startInventoryFlow();
      return;
    }

    this.rejectAndRepeat('No entendi si quieres crear un plato o registrar un insumo.');
  }

  private loadInventory(restaurantId: string): void {
    if (!restaurantId) return;
    this.ownerService.getInventory(restaurantId).subscribe((items) => {
      this.inventoryItems.set(items);
    });
  }

  private askCurrentStep(): void {
    const prompt = this.currentPrompt();
    this.addAssistantMessage(prompt);
    this.voiceService.speak(prompt);
  }

  private rejectAndRepeat(message: string): void {
    this.errorMessage.set(message);
    this.addSystemMessage(message);
    this.voiceService.speak(`${message} ${this.currentPrompt()}`);
  }

  private ensureRestaurant(): boolean {
    if (this.selectedRestaurant()) return true;
    this.errorMessage.set('Selecciona un restaurante antes de usar el asistente.');
    return false;
  }

  private resolveCategoryId(text: string): string {
    const normalized = this.normalizeForMatch(text);
    const aliases: Record<string, string[]> = {
      burgers: [
        'hamburguesa',
        'hamburguesas',
        'amburguesa',
        'amburguesas',
        'hamburgesa',
        'hamburgesas',
        'burger',
        'burgers',
        'burgar',
        'burga',
      ],
      pizza: ['pizza', 'pizzas', 'piza', 'pisa', 'pitsa', 'pissa', 'pigs'],
      tacos: ['taco', 'tacos', 'tako', 'takos'],
      sushi: ['sushi', 'suchi', 'susi'],
      pasta: ['pasta', 'pastas'],
      chicken: ['pollo', 'pollos', 'chicken'],
      desserts: ['postre', 'postres', 'torta', 'helado dulce'],
      drinks: ['bebida', 'bebidas', 'jugo', 'jugos', 'gaseosa'],
      breakfast: ['desayuno', 'desayunos'],
      salads: ['ensalada', 'ensaladas'],
      grill: ['carne', 'carnes', 'parrilla', 'asado'],
      seafood: ['marisco', 'mariscos'],
      fish: ['pescado', 'pescados'],
      soups: ['sopa', 'sopas'],
      rice: ['arroz', 'arroces'],
      vegan: ['vegano', 'vegetariano'],
      coffee: ['cafe', 'café'],
      icecream: ['helado', 'helados'],
      bakery: ['panaderia', 'panadería', 'pan'],
      hotdogs: ['perro', 'perros', 'hot dog', 'perro caliente'],
      arepas: ['arepa', 'arepas'],
      healthy: ['saludable', 'sano'],
    };
    const legacyAliases: Record<string, string> = {
      hamburguesa: 'burgers',
      hamburguesas: 'burgers',
      burger: 'burgers',
      burgers: 'burgers',
      pizzas: 'pizza',
      taco: 'tacos',
      tacos: 'tacos',
      pastas: 'pasta',
      pollo: 'chicken',
      postre: 'desserts',
      postres: 'desserts',
      bebida: 'drinks',
      bebidas: 'drinks',
      desayuno: 'breakfast',
      desayunos: 'breakfast',
      ensalada: 'salads',
      ensaladas: 'salads',
      carnes: 'grill',
      parrilla: 'grill',
      marisco: 'seafood',
      mariscos: 'seafood',
      pescado: 'fish',
      pescados: 'fish',
      sopa: 'soups',
      sopas: 'soups',
      arroz: 'rice',
      arroces: 'rice',
      vegano: 'vegan',
      vegetariano: 'vegan',
      cafe: 'coffee',
      café: 'coffee',
      helado: 'icecream',
      helados: 'icecream',
      panaderia: 'bakery',
      panadería: 'bakery',
      perro: 'hotdogs',
      perros: 'hotdogs',
      arepa: 'arepas',
      arepas: 'arepas',
      saludable: 'healthy',
    };

    for (const [categoryId, words] of Object.entries(aliases)) {
      if (words.some((word) => normalized.includes(this.normalizeForMatch(word)))) {
        return categoryId;
      }
    }

    const legacyAlias = Object.entries(legacyAliases).find(([word]) =>
      normalized.includes(this.normalizeForMatch(word)),
    );
    if (legacyAlias) {
      return legacyAlias[1];
    }

    const match = this.categoryOptions.find((category) => {
      const id = this.normalizeForMatch(category.id);
      const name = this.normalizeForMatch(category.name);
      return normalized.includes(id) || normalized.includes(name);
    });
    if (match) {
      return match.id;
    }

    const spokenWords = normalized.split(/\s+/).filter((word) => word.length >= 3);
    let bestMatch = { categoryId: '', distance: Number.POSITIVE_INFINITY };

    for (const [categoryId, words] of Object.entries(aliases)) {
      for (const spokenWord of spokenWords) {
        for (const aliasWord of words.map((word) => this.normalizeForMatch(word))) {
          const distance = this.levenshteinDistance(spokenWord, aliasWord);
          const maxLength = Math.max(spokenWord.length, aliasWord.length);
          const allowedDistance = maxLength <= 5 ? 1 : 2;

          if (distance <= allowedDistance && distance < bestMatch.distance) {
            bestMatch = { categoryId, distance };
          }
        }
      }
    }

    return bestMatch.categoryId;
  }

  private resolveInventoryItem(text: string): InventoryItem | null {
    const normalized = this.normalizeForMatch(text);
    return (
      this.inventoryItems().find((item) => normalized.includes(this.normalizeForMatch(item.name))) ??
      null
    );
  }

  private extractNumber(text: string): number {
    const normalized = this.normalizeForMatch(text);
    const formattedThousands = normalized.match(/\b\d{1,3}(?:[.,]\d{3})+\b/);
    if (formattedThousands) {
      return Number(formattedThousands[0].replace(/[.,]/g, ''));
    }

    const numericThousands = normalized.match(/(\d+(?:[.,]\d+)?)\s*mil\b/);
    if (numericThousands) {
      return Number(numericThousands[1].replace(',', '.')) * 1000;
    }

    const match = normalized.match(/\d+(?:[.,]\d+)?/);
    if (match) {
      return Number(match[0].replace(',', '.'));
    }

    return this.parseSpanishNumber(normalized);
  }

  private parseSpanishNumber(text: string): number {
    const units: Record<string, number> = {
      cero: 0,
      un: 1,
      uno: 1,
      una: 1,
      dos: 2,
      tres: 3,
      cuatro: 4,
      cinco: 5,
      seis: 6,
      siete: 7,
      ocho: 8,
      nueve: 9,
      diez: 10,
      once: 11,
      doce: 12,
      trece: 13,
      catorce: 14,
      quince: 15,
      dieciseis: 16,
      diecisiete: 17,
      dieciocho: 18,
      diecinueve: 19,
      veinte: 20,
      veintiuno: 21,
      veintidos: 22,
      veintitres: 23,
      veinticuatro: 24,
      veinticinco: 25,
      veintiseis: 26,
      veintisiete: 27,
      veintiocho: 28,
      veintinueve: 29,
    };
    const tens: Record<string, number> = {
      treinta: 30,
      cuarenta: 40,
      cincuenta: 50,
      sesenta: 60,
      setenta: 70,
      ochenta: 80,
      noventa: 90,
    };

    const words = text.split(/\s+/).filter((word) => !['pesos', 'peso', 'cop', 'de', 'y'].includes(word));
    let total = 0;
    let current = 0;

    words.forEach((word) => {
      if (units[word] !== undefined) {
        current += units[word];
        return;
      }

      if (tens[word] !== undefined) {
        current += tens[word];
        return;
      }

      if (word === 'cien' || word === 'ciento') {
        current += 100;
        return;
      }

      if (word === 'mil') {
        total += (current || 1) * 1000;
        current = 0;
      }
    });

    const parsed = total + current;
    return parsed > 0 || text.includes('cero') ? parsed : Number.NaN;
  }

  private normalizeUnit(text: string): string {
    const value = this.cleanText(text)
      .replace(/\b(unidad|unidades)\b/g, 'unid')
      .replace(/\bkilogramos?\b/g, 'kg')
      .replace(/\bgramos?\b/g, 'g')
      .replace(/\blitros?\b/g, 'l')
      .replace(/\bmililitros?\b/g, 'ml')
      .trim();
    return value.slice(0, 16);
  }

  getCategoryName(categoryId: string): string {
    return this.categoryOptions.find((category) => category.id === categoryId)?.name ?? categoryId;
  }

  private isAffirmative(text: string): boolean {
    return this.includesAny(text, ['si', 'sí', 'confirmar', 'guardar', 'crealo', 'créalo', 'aceptar']);
  }

  private isNegative(text: string): boolean {
    return this.includesAny(text, ['no', 'cancelar', 'descartar', 'volver']);
  }

  private isAffirmativeSkip(text: string): boolean {
    return this.includesAny(text, ['listo', 'terminar', 'confirmar', 'guardar']);
  }

  private includesAny(text: string, words: string[]): boolean {
    const normalized = this.normalizeForMatch(text);
    return words.some((word) => normalized.includes(this.normalizeForMatch(word)));
  }

  private cleanText(text: string): string {
    return text.trim().replace(/\s+/g, ' ');
  }

  private normalizeForMatch(text: string): string {
    return this.cleanText(text)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private toTitleCase(text: string): string {
    return this.compactRepeatedSpeech(text)
      .toLowerCase()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private compactRepeatedSpeech(text: string): string {
    const cleaned = this.cleanText(text)
      .replace(/[¡!¿?]/g, '')
      .replace(/\s*,\s*/g, ', ')
      .trim();
    const parts = cleaned
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length > 1) {
      const firstNormalized = this.normalizeForMatch(parts[0]);
      const mostlyRepeated = parts.every((part) => {
        const normalized = this.normalizeForMatch(part);
        return (
          normalized === firstNormalized ||
          this.levenshteinDistance(normalized, firstNormalized) <= 2
        );
      });

      if (mostlyRepeated) {
        return parts[0];
      }
    }

    return cleaned.replace(/\s+/g, ' ');
  }

  private levenshteinDistance(left: string, right: string): number {
    const rows = left.length + 1;
    const columns = right.length + 1;
    const distances = Array.from({ length: rows }, () => Array(columns).fill(0));

    for (let row = 0; row < rows; row += 1) {
      distances[row][0] = row;
    }

    for (let column = 0; column < columns; column += 1) {
      distances[0][column] = column;
    }

    for (let row = 1; row < rows; row += 1) {
      for (let column = 1; column < columns; column += 1) {
        const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
        distances[row][column] = Math.min(
          distances[row - 1][column] + 1,
          distances[row][column - 1] + 1,
          distances[row - 1][column - 1] + substitutionCost,
        );
      }
    }

    return distances[left.length][right.length];
  }

  private addAssistantMessage(text: string): void {
    this.addMessage({ role: 'assistant', text });
  }

  private addUserMessage(text: string): void {
    this.addMessage({ role: 'user', text });
  }

  private addSystemMessage(text: string): void {
    this.addMessage({ role: 'system', text });
  }

  private addMessage(message: AssistantMessage): void {
    this.messages.update((messages) => [...messages.slice(-7), message]);
  }
}
