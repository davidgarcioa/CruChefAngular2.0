import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { of, switchMap } from 'rxjs';

import { OrderService } from '../orders/order.service';
import {
  Order,
  OrderStatus,
  activeOrderStatuses,
  historicalOrderStatuses,
  orderStatusLabelMap,
} from '../models/order.model';
import { Dish } from '../models/dish.model';
import { Restaurant } from '../models/restaurant.model';
import { CategorySliderComponent } from '../dashboard/category-slider/category-slider.component';
import { DishCardComponent } from '../dashboard/dish-card/dish-card.component';
import { SidebarComponent } from '../dashboard/sidebar/sidebar.component';
import { categories, userNavigationItems } from '../dashboard/dashboard.data';
import { PublicMenuService } from './public-menu.service';
import { formMaxLengths } from '../shared/form-validators';

interface CartItem {
  dish: Dish;
  quantity: number;
}

@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SidebarComponent,
    CategorySliderComponent,
    DishCardComponent,
  ],
  templateUrl: './user-menu.component.html',
  styleUrl: './user-menu.component.css',
})
export class UserMenuComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly publicMenuService = inject(PublicMenuService);
  private readonly orderService = inject(OrderService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly navigationItems = userNavigationItems;
  readonly categories = categories;
  readonly restaurants = signal<Restaurant[]>([]);
  readonly dishes = signal<Dish[]>([]);
  readonly userOrders = signal<Order[]>([]);
  readonly selectedCategoryId = signal('all');
  readonly selectedRestaurantId = signal('');
  readonly selectedDish = signal<Dish | null>(null);
  readonly cartItems = signal<CartItem[]>([]);
  readonly checkoutStep = signal<'details' | 'payment' | 'review'>('details');
  readonly orderQuantity = signal(1);
  readonly selectedPaymentMethod = signal('cash');
  readonly catalogError = signal('');
  readonly ordersError = signal('');
  readonly orderSuccess = signal('');
  readonly orderActionError = signal('');
  readonly ratingSuccess = signal('');
  readonly ratingError = signal('');
  readonly isSubmittingOrder = signal(false);
  readonly isSubmittingRating = signal(false);
  readonly currentView = signal(
    (this.route.snapshot.data['view'] as string | undefined) ?? 'menu',
  );
  readonly ratingOrderId = signal<string | null>(null);
  readonly hasRestaurants = computed(() => this.restaurants().length > 0);
  readonly hasSelectedRestaurant = computed(() => this.selectedRestaurantId().length > 0);
  readonly restaurantCitiesCount = computed(
    () => new Set(this.restaurants().map((restaurant) => restaurant.city).filter(Boolean)).size,
  );

  readonly orderForm = this.fb.nonNullable.group({
    quantity: [1, [Validators.required, Validators.min(1), Validators.max(10)]],
    notes: ['', [Validators.maxLength(formMaxLengths.notes)]],
    paymentMethod: ['cash', Validators.required],
    cardholderName: ['', [Validators.maxLength(80)]],
    cardNumber: ['', [Validators.maxLength(23)]],
    cardExpiry: ['', [Validators.maxLength(5)]],
    cardCvv: ['', [Validators.maxLength(4)]],
    transferBank: ['', [Validators.maxLength(80)]],
    transferReference: ['', [Validators.maxLength(40)]],
  });

  readonly ratingForm = this.fb.nonNullable.group({
    rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
    reviewText: ['', [Validators.maxLength(formMaxLengths.reviewText)]],
  });

  readonly currentRestaurant = computed(
    () =>
      this.restaurants().find(
        (restaurant) => this.getRestaurantKey(restaurant) === this.selectedRestaurantId(),
      ) ?? null,
  );

  readonly currentRestaurantLabel = computed(
    () => this.currentRestaurant()?.name || 'Elige un restaurante',
  );

  readonly filteredDishes = computed(() => {
    const categoryId = this.selectedCategoryId();

    return this.dishes().filter((dish) =>
      categoryId === 'all' ? true : dish.categoryId === categoryId,
    );
  });

  readonly activeOrders = computed(() =>
    this.userOrders().filter((order) => activeOrderStatuses.includes(order.status)),
  );

  readonly historicalOrders = computed(() =>
    this.userOrders().filter((order) => historicalOrderStatuses.includes(order.status)),
  );

  readonly pendingRatingsCount = computed(
    () => this.historicalOrders().filter((order) => this.canRateOrder(order)).length,
  );

  readonly selectedRatingOrder = computed(
    () =>
      this.historicalOrders().find((order) => order.id === this.ratingOrderId()) ?? null,
  );

  readonly selectedDishCategoryName = computed(() => {
    const dish = this.selectedDish();
    if (!dish) {
      return '';
    }

    return this.categories.find((category) => category.id === dish.categoryId)?.name ?? 'Categoria';
  });

  readonly checkoutSubtotal = computed(() => {
    return this.cartItems().reduce(
      (total, item) => total + item.dish.price * item.quantity,
      0,
    );
  });

  readonly checkoutTotal = computed(() => this.checkoutSubtotal());
  readonly cartItemsCount = computed(() =>
    this.cartItems().reduce((total, item) => total + item.quantity, 0),
  );

  readonly paymentMethodLabel = computed(() => {
    switch (this.selectedPaymentMethod()) {
      case 'card':
        return 'Tarjeta';
      case 'transfer':
        return 'Transferencia';
      default:
        return 'Efectivo';
    }
  });

  readonly pageTitle = computed(() => {
    const view = this.currentView();

    return view === 'orders'
      ? 'Tus pedidos'
      : view === 'history'
        ? 'Historial y calificaciones'
        : this.hasSelectedRestaurant()
          ? 'Platos disponibles'
          : 'Restaurantes disponibles';
  });

  readonly pageLead = computed(() => {
    const view = this.currentView();

    return view === 'orders'
      ? 'Revisa el estado de los pedidos que ya enviaste a los propietarios.'
      : view === 'history'
        ? 'Consulta pedidos entregados o cancelados y deja tu calificacion cuando corresponda.'
        : this.hasSelectedRestaurant()
          ? `Estas viendo el menu de ${this.currentRestaurantLabel()}.`
          : 'Elige el restaurante que quieres revisar para ver sus platos disponibles.';
  });

  readonly selectedRestaurantDetails = computed(() => {
    const restaurant = this.currentRestaurant();

    return restaurant
      ? [
          { label: 'Ciudad', value: restaurant.city || 'Sin ciudad' },
          { label: 'Direccion', value: restaurant.address || 'Sin direccion' },
          { label: 'Horario', value: restaurant.schedule || 'Sin horario' },
          { label: 'Telefono', value: restaurant.phone || 'Sin telefono' },
        ]
      : [
          { label: 'Restaurantes', value: String(this.restaurants().length) },
          { label: 'Ciudades', value: String(this.restaurantCitiesCount()) },
          { label: 'Verificados', value: String(this.verifiedRestaurantsCount()) },
          { label: 'Seleccion', value: 'Pendiente' },
        ];
  });

  readonly verifiedRestaurantsCount = computed(
    () =>
      this.restaurants().filter((restaurant) => restaurant.verificationStatus === 'verified')
        .length,
  );

  constructor() {
    this.route.data.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data) => {
      this.currentView.set((data['view'] as string | undefined) ?? 'menu');
    });

    this.publicMenuService
      .getRestaurants()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (restaurants) => {
          this.catalogError.set('');
          this.restaurants.set(restaurants);

          const selectedRestaurantId = this.selectedRestaurantId();
          const hasSelection = restaurants.some(
            (restaurant) => this.getRestaurantKey(restaurant) === selectedRestaurantId,
          );

          if (!hasSelection) {
            this.selectedRestaurantId.set('');
            this.dishes.set([]);
            this.selectedDish.set(null);
          }

          if (restaurants.length === 0) {
            this.dishes.set([]);
            this.selectedDish.set(null);
          }
        },
        error: (error) => {
          this.restaurants.set([]);
          this.selectedRestaurantId.set('');
          this.selectedDish.set(null);
          this.dishes.set([]);
          this.catalogError.set(this.publicMenuService.getErrorMessage(error));
        },
      });

    toObservable(this.selectedRestaurantId)
      .pipe(
        switchMap((restaurantId) => {
          if (!restaurantId) {
            return of([] as Dish[]);
          }

          return this.publicMenuService.getDishes(restaurantId);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (dishes) => {
          if (this.selectedRestaurantId()) {
            this.catalogError.set('');
          }

          this.dishes.set(dishes);

          const currentDish = this.selectedDish();
          if (currentDish && !dishes.some((dish) => dish.id === currentDish.id)) {
            this.selectedDish.set(null);
          }
        },
        error: (error) => {
          this.dishes.set([]);
          this.selectedDish.set(null);
          this.catalogError.set(this.publicMenuService.getErrorMessage(error));
        },
      });

    this.orderService
      .getUserOrders()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (orders) => {
          this.ordersError.set('');
          this.userOrders.set(orders);

          const currentRatingOrderId = this.ratingOrderId();
          if (currentRatingOrderId && !orders.some((order) => order.id === currentRatingOrderId)) {
            this.ratingOrderId.set(null);
          }
        },
        error: (error) => {
          this.userOrders.set([]);
          this.ordersError.set(this.orderService.getErrorMessage(error));
        },
      });

    this.orderForm.controls.quantity.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((quantity) => {
        this.orderQuantity.set(Number(quantity) || 1);
      });

    this.orderForm.controls.paymentMethod.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((paymentMethod) => {
        this.selectedPaymentMethod.set(paymentMethod || 'cash');
        this.orderActionError.set('');
      });
  }

  selectRestaurant(restaurantId: string): void {
    this.selectedRestaurantId.set(restaurantId);
    this.selectedCategoryId.set('all');
    this.selectedDish.set(null);
    this.cartItems.set([]);
    this.orderSuccess.set('');
    this.orderActionError.set('');
  }

  openOrderComposer(dish: Dish): void {
    this.selectedDish.set(dish);
    this.addCartItem(dish);
    this.orderActionError.set('');
    this.orderSuccess.set('');
    this.checkoutStep.set('details');
  }

  addCartItem(dish: Dish): void {
    this.cartItems.update((items) => {
      const currentItem = items.find((item) => item.dish.id === dish.id);

      if (currentItem) {
        return items.map((item) =>
          item.dish.id === dish.id
            ? { ...item, quantity: Math.min(item.quantity + 1, 10) }
            : item,
        );
      }

      return [...items, { dish, quantity: 1 }];
    });
  }

  increaseCartItem(dishId: string): void {
    this.cartItems.update((items) =>
      items.map((item) =>
        item.dish.id === dishId
          ? { ...item, quantity: Math.min(item.quantity + 1, 10) }
          : item,
      ),
    );
  }

  decreaseCartItem(dishId: string): void {
    this.cartItems.update((items) =>
      items
        .map((item) =>
          item.dish.id === dishId
            ? { ...item, quantity: item.quantity - 1 }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  removeCartItem(dishId: string): void {
    this.cartItems.update((items) => items.filter((item) => item.dish.id !== dishId));
  }

  selectPaymentMethod(paymentMethod: 'cash' | 'card' | 'transfer'): void {
    this.orderForm.controls.paymentMethod.setValue(paymentMethod);
    this.selectedPaymentMethod.set(paymentMethod);
    this.orderActionError.set('');

    if (paymentMethod === 'cash') {
      this.orderForm.patchValue({
        cardholderName: '',
        cardNumber: '',
        cardExpiry: '',
        cardCvv: '',
        transferBank: '',
        transferReference: '',
      });
    }
  }

  goToPaymentStep(): void {
    if (this.cartItems().length === 0) {
      this.orderActionError.set('Agrega al menos un plato al pedido.');
      return;
    }

    this.checkoutStep.set('payment');
  }

  goToReviewStep(): void {
    this.orderForm.controls.paymentMethod.markAsTouched();

    if (this.orderForm.controls.paymentMethod.invalid) {
      return;
    }

    if (!this.validatePaymentSimulation()) {
      return;
    }

    this.checkoutStep.set('review');
  }

  goToCheckoutStep(step: 'details' | 'payment' | 'review'): void {
    this.checkoutStep.set(step);
  }

  async submitOrder(): Promise<void> {
    if (this.orderForm.invalid) {
      this.orderForm.markAllAsTouched();
      return;
    }

    const restaurant = this.currentRestaurant();
    const items = this.cartItems();

    if (!restaurant || items.length === 0) {
      this.orderActionError.set('Agrega al menos un plato al pedido.');
      return;
    }

    if (!this.validatePaymentSimulation()) {
      return;
    }

    this.isSubmittingOrder.set(true);
    this.orderActionError.set('');
    this.orderSuccess.set('');

    try {
      const formValue = this.orderForm.getRawValue();
      await Promise.all(
        items.map((item) =>
          this.orderService.createOrder(restaurant, item.dish, {
            ...formValue,
            quantity: item.quantity,
          }),
        ),
      );
      this.orderSuccess.set(
        items.length > 1
          ? 'Pedido enviado con varios platos al propietario.'
          : 'Pedido enviado al propietario correctamente.',
      );
      this.selectedDish.set(null);
      this.cartItems.set([]);
      this.orderForm.reset({
        quantity: 1,
        notes: '',
        paymentMethod: 'cash',
        cardholderName: '',
        cardNumber: '',
        cardExpiry: '',
        cardCvv: '',
        transferBank: '',
        transferReference: '',
      });
      this.orderQuantity.set(1);
      this.selectedPaymentMethod.set('cash');
      this.checkoutStep.set('details');
    } catch (error) {
      this.orderActionError.set(this.orderService.getErrorMessage(error));
    } finally {
      this.isSubmittingOrder.set(false);
    }
  }

  beginRating(order: Order): void {
    this.ratingOrderId.set(order.id);
    this.ratingSuccess.set('');
    this.ratingError.set('');
    this.ratingForm.reset({
      rating: 5,
      reviewText: '',
    });
  }

  cancelRating(): void {
    this.ratingOrderId.set(null);
    this.ratingSuccess.set('');
    this.ratingError.set('');
  }

  async submitRating(): Promise<void> {
    if (this.ratingForm.invalid) {
      this.ratingForm.markAllAsTouched();
      return;
    }

    const order = this.selectedRatingOrder();
    if (!order) {
      this.ratingError.set('Selecciona un pedido entregado para calificar.');
      return;
    }

    this.isSubmittingRating.set(true);
    this.ratingError.set('');
    this.ratingSuccess.set('');

    try {
      await this.orderService.rateOrder(order, this.ratingForm.getRawValue());
      this.ratingSuccess.set('Gracias. Tu calificacion ya quedo registrada.');
      this.ratingOrderId.set(null);
    } catch (error) {
      this.ratingError.set(this.orderService.getErrorMessage(error));
    } finally {
      this.isSubmittingRating.set(false);
    }
  }

  getRestaurantKey(restaurant: Restaurant): string {
    return `${restaurant.ownerUid}:${restaurant.id}`;
  }

  getOrderStatusLabel(status: OrderStatus): string {
    return orderStatusLabelMap[status];
  }

  getOrderStatusClass(status: OrderStatus): string {
    return `order-status order-status--${status}`;
  }

  getPaymentMethodLabel(paymentMethod: string): string {
    switch (paymentMethod) {
      case 'card':
        return 'Tarjeta';
      case 'transfer':
        return 'Transferencia';
      default:
        return 'Efectivo';
    }
  }

  getPaymentStatusLabel(paymentStatus: string): string {
    return paymentStatus === 'approved' ? 'Aprobado' : 'Pendiente';
  }

  canRateOrder(order: Order): boolean {
    return order.status === 'delivered' && order.rating == null;
  }

  formatCardNumber(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formattedValue = this.onlyDigits(input.value)
      .slice(0, 19)
      .replace(/(.{4})/g, '$1 ')
      .trim();

    input.value = formattedValue;
    this.orderForm.controls.cardNumber.setValue(formattedValue, { emitEvent: false });
  }

  formatCardExpiry(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = this.onlyDigits(input.value).slice(0, 4);
    const formattedValue =
      digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;

    input.value = formattedValue;
    this.orderForm.controls.cardExpiry.setValue(formattedValue, { emitEvent: false });
  }

  formatCardCvv(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formattedValue = this.onlyDigits(input.value).slice(0, 4);

    input.value = formattedValue;
    this.orderForm.controls.cardCvv.setValue(formattedValue, { emitEvent: false });
  }

  onlyDigits(value: string): string {
    return value.replace(/\D/g, '');
  }

  isCardExpiryValid(value: string): boolean {
    const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(value.trim());

    if (!match) {
      return false;
    }

    const month = Number(match[1]);
    const year = 2000 + Number(match[2]);
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    return year > currentYear || (year === currentYear && month >= currentMonth);
  }

  isCardCvvValid(value: string): boolean {
    const cardCvv = this.onlyDigits(value);
    return cardCvv.length >= 3 && cardCvv.length <= 4;
  }

  private validatePaymentSimulation(): boolean {
    const paymentMethod = this.orderForm.controls.paymentMethod.value;

    if (paymentMethod === 'card') {
      this.orderForm.controls.cardholderName.markAsTouched();
      this.orderForm.controls.cardNumber.markAsTouched();
      this.orderForm.controls.cardExpiry.markAsTouched();
      this.orderForm.controls.cardCvv.markAsTouched();
      const cardholderName = this.orderForm.controls.cardholderName.value.trim();
      const cardNumber = this.onlyDigits(this.orderForm.controls.cardNumber.value);
      const cardExpiry = this.orderForm.controls.cardExpiry.value.trim();
      const cardCvv = this.onlyDigits(this.orderForm.controls.cardCvv.value);

      if (cardholderName.length < 3) {
        this.orderActionError.set('Escribe el nombre del titular de la tarjeta demo.');
        return false;
      }

      if (cardNumber.length < 12 || cardNumber.length > 19) {
        this.orderActionError.set('Escribe un numero de tarjeta demo valido.');
        return false;
      }

      if (!this.isCardExpiryValid(cardExpiry)) {
        this.orderActionError.set('Escribe una fecha de vencimiento vigente en formato MM/AA.');
        return false;
      }

      if (!this.isCardCvvValid(cardCvv)) {
        this.orderActionError.set('Escribe un CVV demo valido.');
        return false;
      }
    }

    if (paymentMethod === 'transfer') {
      this.orderForm.controls.transferBank.markAsTouched();
      this.orderForm.controls.transferReference.markAsTouched();
      const transferBank = this.orderForm.controls.transferBank.value.trim();
      const transferReference = this.orderForm.controls.transferReference.value.trim();

      if (transferBank.length < 2) {
        this.orderActionError.set('Selecciona o escribe el banco de la transferencia demo.');
        return false;
      }

      if (transferReference.length < 4) {
        this.orderActionError.set('Escribe una referencia de transferencia demo.');
        return false;
      }
    }

    return true;
  }
}
