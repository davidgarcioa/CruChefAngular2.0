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

  readonly orderForm = this.fb.nonNullable.group({
    quantity: [1, [Validators.required, Validators.min(1), Validators.max(10)]],
    notes: [''],
  });

  readonly ratingForm = this.fb.nonNullable.group({
    rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
    reviewText: [''],
  });

  readonly currentRestaurant = computed(
    () =>
      this.restaurants().find(
        (restaurant) => this.getRestaurantKey(restaurant) === this.selectedRestaurantId(),
      ) ?? null,
  );

  readonly currentRestaurantLabel = computed(
    () => this.currentRestaurant()?.name || 'sin restaurante seleccionado',
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

  readonly pageTitle = computed(() => {
    const view = this.currentView();

    return view === 'orders'
      ? 'Tus pedidos'
      : view === 'history'
        ? 'Historial y calificaciones'
        : 'Platos disponibles';
  });

  readonly pageLead = computed(() => {
    const view = this.currentView();

    return view === 'orders'
      ? 'Revisa el estado de los pedidos que ya enviaste a los propietarios.'
      : view === 'history'
        ? 'Consulta pedidos entregados o cancelados y deja tu calificacion cuando corresponda.'
        : `Estas viendo el menu de ${this.currentRestaurantLabel()}.`;
  });

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
            this.selectedRestaurantId.set(
              restaurants[0] ? this.getRestaurantKey(restaurants[0]) : '',
            );
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
  }

  selectRestaurant(restaurantId: string): void {
    this.selectedRestaurantId.set(restaurantId);
    this.selectedDish.set(null);
    this.orderSuccess.set('');
    this.orderActionError.set('');
  }

  openOrderComposer(dish: Dish): void {
    this.selectedDish.set(dish);
    this.orderActionError.set('');
    this.orderSuccess.set('');
    this.orderForm.reset({
      quantity: 1,
      notes: '',
    });
  }

  async submitOrder(): Promise<void> {
    if (this.orderForm.invalid) {
      this.orderForm.markAllAsTouched();
      return;
    }

    const restaurant = this.currentRestaurant();
    const dish = this.selectedDish();

    if (!restaurant || !dish) {
      this.orderActionError.set('Selecciona un plato del catalogo antes de enviar el pedido.');
      return;
    }

    this.isSubmittingOrder.set(true);
    this.orderActionError.set('');
    this.orderSuccess.set('');

    try {
      await this.orderService.createOrder(restaurant, dish, this.orderForm.getRawValue());
      this.orderSuccess.set('Pedido enviado al propietario correctamente.');
      this.selectedDish.set(null);
      this.orderForm.reset({
        quantity: 1,
        notes: '',
      });
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

  canRateOrder(order: Order): boolean {
    return order.status === 'delivered' && order.rating == null;
  }
}
