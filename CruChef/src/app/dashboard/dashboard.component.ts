import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { switchMap } from 'rxjs/operators';

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
import { CategorySliderComponent } from './category-slider/category-slider.component';
import { categories, getCategoryImageUrl, ownerNavigationItems } from './dashboard.data';
import { DishCardComponent } from './dish-card/dish-card.component';
import { DishFormValue, OwnerService } from './owner.service';
import { SearchBarComponent } from './search-bar/search-bar.component';
import { SidebarComponent } from './sidebar/sidebar.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SidebarComponent,
    SearchBarComponent,
    CategorySliderComponent,
    DishCardComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly ownerService = inject(OwnerService);
  private readonly orderService = inject(OrderService);
  private readonly destroyRef = inject(DestroyRef);

  readonly navigationItems = ownerNavigationItems;
  readonly categories = categories;
  readonly categoryOptions = categories.filter((category) => category.id !== 'all');
  readonly selectedCategoryId = signal('all');
  readonly restaurants = signal<Restaurant[]>([]);
  readonly dishes = signal<Dish[]>([]);
  readonly ownerOrders = signal<Order[]>([]);
  readonly selectedRestaurantId = signal<string | null>(null);
  readonly selectedOrderRestaurantId = signal<'all' | string>('all');
  readonly editingDishId = signal<string | null>(null);
  readonly viewedDish = signal<Dish | null>(null);
  readonly isSavingDish = signal(false);
  readonly updatingOrderId = signal<string | null>(null);
  readonly dishError = signal('');
  readonly dishSuccess = signal('');
  readonly ownerOrderError = signal('');
  readonly ownerOrderSuccess = signal('');
  readonly currentView = signal(
    (this.route.snapshot.data['view'] as string | undefined) ?? 'restaurants',
  );

  readonly dishForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    price: [24000, [Validators.required, Validators.min(1000)]],
    categoryId: ['burgers', Validators.required],
  });

  readonly selectedRestaurant = computed(() =>
    this.restaurants().find((restaurant) => restaurant.id === this.selectedRestaurantId()) ?? null,
  );

  readonly filteredDishes = computed(() => {
    const categoryId = this.selectedCategoryId();
    const dishes = this.dishes();

    if (categoryId === 'all') {
      return dishes;
    }

    return dishes.filter((dish) => dish.categoryId === categoryId);
  });

  readonly previewImageUrl = computed(() => {
    return getCategoryImageUrl(this.dishForm.controls.categoryId.value);
  });

  readonly viewedDishCategoryName = computed(() => {
    const dish = this.viewedDish();
    if (!dish) {
      return '';
    }

    return this.categories.find((category) => category.id === dish.categoryId)?.name ?? 'Categoria';
  });

  readonly activeOwnerOrders = computed(() =>
    this.ownerOrders().filter((order) => activeOrderStatuses.includes(order.status)),
  );

  readonly historicalOwnerOrders = computed(() =>
    this.ownerOrders().filter((order) => historicalOrderStatuses.includes(order.status)),
  );

  readonly visibleActiveOwnerOrders = computed(() =>
    this.filterOrdersByRestaurant(this.activeOwnerOrders()),
  );

  readonly visibleHistoricalOwnerOrders = computed(() =>
    this.filterOrdersByRestaurant(this.historicalOwnerOrders()),
  );

  readonly dashboardOrders = computed(() => {
    const restaurant = this.selectedRestaurant();

    if (!restaurant) {
      return [];
    }

    return this.ownerOrders()
      .filter((order) => order.restaurantId === restaurant.id)
      .sort((left, right) => right.createdAtMs - left.createdAtMs);
  });

  readonly dashboardRevenue = computed(() =>
    this.dashboardOrders()
      .filter((order) => order.status === 'delivered')
      .reduce((total, order) => total + order.totalPrice, 0),
  );

  readonly dashboardDeliveredOrders = computed(
    () => this.dashboardOrders().filter((order) => order.status === 'delivered').length,
  );

  readonly dashboardCancelledOrders = computed(
    () => this.dashboardOrders().filter((order) => order.status === 'cancelled').length,
  );

  readonly dashboardActiveOrdersCount = computed(
    () => this.dashboardOrders().filter((order) => activeOrderStatuses.includes(order.status)).length,
  );

  readonly dashboardAverageTicket = computed(() => {
    const deliveredOrders = this.dashboardDeliveredOrders();
    return deliveredOrders > 0 ? this.dashboardRevenue() / deliveredOrders : 0;
  });

  readonly dashboardRatingsCount = computed(() =>
    this.dishes().reduce((total, dish) => total + dish.ratingCount, 0),
  );

  readonly dashboardAverageRating = computed(() => {
    const totalRatings = this.dishes().reduce((total, dish) => total + dish.ratingTotal, 0);
    const ratingsCount = this.dashboardRatingsCount();

    return ratingsCount > 0 ? Number((totalRatings / ratingsCount).toFixed(1)) : 0;
  });

  readonly dashboardTopDishes = computed(() => {
    const dishMap = new Map<
      string,
      { dishId: string; name: string; imageUrl: string; orders: number; revenue: number }
    >();

    this.dashboardOrders().forEach((order) => {
      const current = dishMap.get(order.dishId) ?? {
        dishId: order.dishId,
        name: order.dishName,
        imageUrl: order.dishImageUrl,
        orders: 0,
        revenue: 0,
      };

      current.orders += order.quantity;
      current.revenue += order.totalPrice;
      dishMap.set(order.dishId, current);
    });

    return Array.from(dishMap.values())
      .sort((left, right) => {
        if (right.orders !== left.orders) {
          return right.orders - left.orders;
        }

        return right.revenue - left.revenue;
      })
      .slice(0, 4);
  });

  readonly dashboardRecentOrders = computed(() => this.dashboardOrders().slice(0, 5));

  readonly viewTitle = computed(() => {
    const currentView = this.currentView();

    return currentView === 'restaurants'
      ? 'Propietario'
      : currentView === 'dashboard'
        ? 'Dashboard'
        : currentView === 'orders'
          ? 'Ordenes'
          : 'Historial';
  });

  constructor() {
    this.route.data.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data) => {
      this.currentView.set((data['view'] as string | undefined) ?? 'restaurants');
    });

    this.ownerService
      .getRestaurants()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((restaurants) => {
        this.restaurants.set(restaurants);

        const currentId = this.selectedRestaurantId();
        if (restaurants.length === 0) {
          this.selectedRestaurantId.set(null);
          this.selectedOrderRestaurantId.set('all');
          this.dishes.set([]);
          return;
        }

        if (!currentId || !restaurants.some((restaurant) => restaurant.id === currentId)) {
          this.selectedRestaurantId.set(restaurants[0].id);
        }

        const currentOrderFilter = this.selectedOrderRestaurantId();
        if (
          currentOrderFilter !== 'all' &&
          !restaurants.some((restaurant) => restaurant.id === currentOrderFilter)
        ) {
          this.selectedOrderRestaurantId.set('all');
        }
      });

    toObservable(this.selectedRestaurantId)
      .pipe(
        switchMap((restaurantId) => this.ownerService.getDishes(restaurantId)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((dishes) => {
        this.dishes.set(dishes);
      });

    toObservable(this.restaurants)
      .pipe(
        switchMap((restaurants) => this.orderService.getOwnerOrders(restaurants)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (orders) => {
          this.ownerOrders.set(orders);
          this.ownerOrderError.set('');
        },
        error: (error) => {
          this.ownerOrders.set([]);
          this.ownerOrderError.set(this.orderService.getErrorMessage(error));
        },
      });
  }

  selectRestaurant(restaurantId: string): void {
    this.selectedRestaurantId.set(restaurantId);
    this.viewedDish.set(null);
    this.editingDishId.set(null);
    this.resetDishForm();
  }

  selectOrderRestaurant(restaurantId: 'all' | string): void {
    this.selectedOrderRestaurantId.set(restaurantId);
  }

  async submitDish(): Promise<void> {
    if (this.dishForm.invalid) {
      this.dishForm.markAllAsTouched();
      return;
    }

    const restaurant = this.selectedRestaurant();
    if (!restaurant) {
      this.dishError.set('Debes crear o seleccionar un restaurante primero.');
      return;
    }

    this.isSavingDish.set(true);
    this.dishError.set('');
    this.dishSuccess.set('');

    const payload = this.dishForm.getRawValue() as DishFormValue;

    try {
      if (this.editingDishId()) {
        await this.ownerService.updateDish(restaurant, this.editingDishId()!, payload);
        this.dishSuccess.set('Plato actualizado correctamente.');
      } else {
        await this.ownerService.createDish(restaurant, payload);
        this.dishSuccess.set('Plato creado dentro del restaurante seleccionado.');
      }

      this.resetDishForm();
    } catch (error) {
      this.dishError.set(this.ownerService.getErrorMessage(error));
    } finally {
      this.isSavingDish.set(false);
    }
  }

  editDish(dish: Dish): void {
    this.viewedDish.set(dish);
    this.editingDishId.set(dish.id);
    this.dishError.set('');
    this.dishSuccess.set('');
    this.dishForm.setValue({
      name: dish.name,
      price: dish.price,
      categoryId: dish.categoryId,
    });
  }

  async deleteDish(dishId: string): Promise<void> {
    const restaurant = this.selectedRestaurant();
    if (!restaurant) {
      this.dishError.set('Debes crear o seleccionar un restaurante primero.');
      return;
    }

    this.dishError.set('');
    this.dishSuccess.set('');

    try {
      await this.ownerService.deleteDish(restaurant.id, dishId);

      if (this.editingDishId() === dishId) {
        this.resetDishForm();
      }

      if (this.viewedDish()?.id === dishId) {
        this.viewedDish.set(null);
      }

      this.dishSuccess.set('Plato eliminado correctamente.');
    } catch (error) {
      this.dishError.set(this.ownerService.getErrorMessage(error));
    }
  }

  viewDish(dish: Dish): void {
    this.viewedDish.set(dish);
  }

  closeDishViewer(): void {
    this.viewedDish.set(null);
  }

  resetDishForm(): void {
    this.editingDishId.set(null);
    this.dishForm.reset({
      name: '',
      price: 24000,
      categoryId: 'burgers',
    });
  }

  async updateOrderStatus(order: Order, status: OrderStatus): Promise<void> {
    this.updatingOrderId.set(order.id);
    this.ownerOrderError.set('');
    this.ownerOrderSuccess.set('');

    try {
      await this.orderService.updateOrderStatus(order, status);
      this.ownerOrderSuccess.set(
        `Pedido de ${order.customerName} actualizado a ${this.getOrderStatusLabel(status).toLowerCase()}.`,
      );
    } catch (error) {
      this.ownerOrderError.set(this.orderService.getErrorMessage(error));
    } finally {
      this.updatingOrderId.set(null);
    }
  }

  getOrderStatusLabel(status: OrderStatus): string {
    return orderStatusLabelMap[status];
  }

  getOrderStatusClass(status: OrderStatus): string {
    return `verification-pill verification-pill--${status}`;
  }

  getNextStatuses(order: Order): OrderStatus[] {
    switch (order.status) {
      case 'pending':
        return ['accepted', 'cancelled'];
      case 'accepted':
        return ['preparing', 'cancelled'];
      case 'preparing':
        return ['ready', 'cancelled'];
      case 'ready':
        return ['delivered'];
      default:
        return [];
    }
  }

  private filterOrdersByRestaurant(orders: Order[]): Order[] {
    const restaurantId = this.selectedOrderRestaurantId();

    if (restaurantId === 'all') {
      return orders;
    }

    return orders.filter((order) => order.restaurantId === restaurantId);
  }
}
