import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { switchMap } from 'rxjs/operators';
import { toDataURL } from 'qrcode';

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
import { AiVoiceAssistantComponent } from './ai-voice-assistant/ai-voice-assistant.component';
import { CategorySliderComponent } from './category-slider/category-slider.component';
import { categories, getCategoryImageUrl, ownerNavigationItems } from './dashboard.data';
import { DishCardComponent } from './dish-card/dish-card.component';
import { DishFormValue, OwnerService } from './owner.service';
import { SearchBarComponent } from './search-bar/search-bar.component';
import { SidebarComponent } from './sidebar/sidebar.component';

interface DashboardOrderAlert {
  id: string;
  tone: 'info' | 'success' | 'warning';
  title: string;
  detail: string;
  orderId: string;
  createdAt: number;
}

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
    AiVoiceAssistantComponent,
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
  private readonly platformId = inject(PLATFORM_ID);
  private previousOwnerOrderStatuses = new Map<string, OrderStatus>();
  private ownerAlertSequence = 0;

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
  readonly ownerAlerts = signal<DashboardOrderAlert[]>([]);
  readonly qrDataUrl = signal('');
  readonly qrPublicUrl = signal('');
  readonly qrRestaurantId = signal<string | null>(null);
  readonly qrError = signal('');
  readonly generatingQrRestaurantId = signal<string | null>(null);
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
          : currentView === 'ai'
            ? 'Asistente IA'
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
          this.syncOwnerOrderAlerts(orders);
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

  async generateRestaurantQr(restaurant: Restaurant): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      this.qrError.set('El QR solo se puede generar desde el navegador.');
      return;
    }

    const publicUrl = this.getPublicMenuUrl(restaurant);

    this.generatingQrRestaurantId.set(restaurant.id);
    this.qrError.set('');

    try {
      const qrDataUrl = await toDataURL(publicUrl, {
        width: 300,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#121212',
          light: '#ffffff',
        },
      });

      this.qrRestaurantId.set(restaurant.id);
      this.qrPublicUrl.set(publicUrl);
      this.qrDataUrl.set(qrDataUrl);
    } catch {
      this.qrError.set('No se pudo generar el QR de este restaurante.');
    } finally {
      this.generatingQrRestaurantId.set(null);
    }
  }

  getPublicMenuUrl(restaurant: Restaurant): string {
    const origin = isPlatformBrowser(this.platformId) ? window.location.origin : '';

    return `${origin}/public/menu/${encodeURIComponent(restaurant.ownerUid)}/${encodeURIComponent(restaurant.id)}`;
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

  dismissOwnerAlert(alertId: string): void {
    this.ownerAlerts.update((alerts) => alerts.filter((alert) => alert.id !== alertId));
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

  private syncOwnerOrderAlerts(orders: Order[]): void {
    const nextStatuses = new Map<string, OrderStatus>();

    orders.forEach((order) => {
      nextStatuses.set(order.id, order.status);
      const previousStatus = this.previousOwnerOrderStatuses.get(order.id);

      if (!previousStatus) {
        if (order.status === 'pending') {
          this.pushOwnerAlert({
            tone: 'info',
            title: 'Nuevo pedido recibido',
            detail: order.customerName + ' pidio ' + order.dishName + ' en ' + order.restaurantName + '.',
            orderId: order.id,
          });
        }
        return;
      }

      if (previousStatus !== order.status && order.status === 'cancelled') {
        this.pushOwnerAlert({
          tone: 'warning',
          title: 'Pedido cancelado',
          detail: 'El pedido de ' + order.customerName + ' para ' + order.dishName + ' fue cancelado.',
          orderId: order.id,
        });
      }
    });

    this.previousOwnerOrderStatuses = nextStatuses;
  }

  private pushOwnerAlert(alert: Omit<DashboardOrderAlert, 'id' | 'createdAt'>): void {
    const nextAlert: DashboardOrderAlert = {
      ...alert,
      id: 'owner-alert-' + ++this.ownerAlertSequence,
      createdAt: Date.now(),
    };

    this.ownerAlerts.update((alerts) => [nextAlert, ...alerts].slice(0, 5));
  }

  private filterOrdersByRestaurant(orders: Order[]): Order[] {
    const restaurantId = this.selectedOrderRestaurantId();

    if (restaurantId === 'all') {
      return orders;
    }

    return orders.filter((order) => order.restaurantId === restaurantId);
  }
}


