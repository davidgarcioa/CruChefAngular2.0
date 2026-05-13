import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal, PLATFORM_ID } from '@angular/core';
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
import { InventoryItem } from '../models/inventory-item.model';
import { Restaurant } from '../models/restaurant.model';
import { AiVoiceAssistantComponent } from './ai-voice-assistant/ai-voice-assistant.component';
import { CategorySliderComponent } from './category-slider/category-slider.component';
import { categories, getCategoryImageUrl, ownerNavigationItems } from './dashboard.data';
import { DishCardComponent } from './dish-card/dish-card.component';
import { DishFormValue, InventoryFormValue, OwnerService } from './owner.service';
import { SearchBarComponent } from './search-bar/search-bar.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import {
  formMaxLengths,
  normalizeTextInput,
  trimmedRequired,
} from '../shared/form-validators';

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

  readonly navigationItems = ownerNavigationItems;
  readonly categories = categories;
  readonly categoryOptions = categories.filter((category) => category.id !== 'all');
  readonly selectedCategoryId = signal('all');
  readonly restaurants = signal<Restaurant[]>([]);
  readonly dishes = signal<Dish[]>([]);
  readonly inventoryItems = signal<InventoryItem[]>([]);
  readonly ownerOrders = signal<Order[]>([]);
  readonly selectedRestaurantId = signal<string | null>(null);
  readonly selectedOrderRestaurantId = signal<'all' | string>('all');
  readonly editingDishId = signal<string | null>(null);
  readonly editingInventoryItemId = signal<string | null>(null);
  readonly viewedDish = signal<Dish | null>(null);
  readonly isSavingDish = signal(false);
  readonly updatingOrderId = signal<string | null>(null);
  readonly pendingOrderCancellation = signal<Order | null>(null);
  readonly pendingDishDeletionId = signal<string | null>(null);
  readonly dishError = signal('');
  readonly dishSuccess = signal('');
  readonly ownerOrderError = signal('');
  readonly ownerOrderSuccess = signal('');
  readonly inventoryError = signal('');
  readonly inventorySuccess = signal('');
  readonly currentView = signal(
    (this.route.snapshot.data['view'] as string | undefined) ?? 'restaurants',
  );

  readonly qrDataUrl = signal('');
  readonly qrPublicUrl = signal('');
  readonly qrRestaurantId = signal<string | null>(null);
  readonly qrError = signal('');
  readonly generatingQrRestaurantId = signal<string | null>(null);

  readonly dishForm = this.fb.nonNullable.group({
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

  readonly inventoryForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, trimmedRequired, Validators.minLength(2), Validators.maxLength(60)]],
    unit: ['unid', [Validators.required, Validators.maxLength(16)]],
    quantity: [0, [Validators.required, Validators.min(0)]],
    minimum: [5, [Validators.required, Validators.min(0)]],
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
  readonly lowInventoryItems = computed(() =>
    this.inventoryItems().filter((item) => item.quantity <= item.minimum),
  );
  readonly emptyInventoryItems = computed(() =>
    this.inventoryItems().filter((item) => item.quantity === 0),
  );

  readonly viewTitle = computed(() => {
    const currentView = this.currentView();

    return currentView === 'restaurants'
      ? 'Propietario'
      : currentView === 'dashboard'
        ? 'Dashboard'
          : currentView === 'orders'
            ? 'Ordenes'
            : currentView === 'inventory'
              ? 'Inventario'
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

    toObservable(this.selectedRestaurantId)
      .pipe(
        switchMap((restaurantId) => this.ownerService.getInventory(restaurantId)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((items) => {
        this.inventoryItems.set(items);
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
    this.qrDataUrl.set('');
    this.qrPublicUrl.set('');
    this.qrRestaurantId.set(null);
    this.qrError.set('');
    this.resetDishForm();
    this.resetInventoryForm();
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

    const payload = {
      ...this.dishForm.getRawValue(),
      name: normalizeTextInput(this.dishForm.controls.name.value),
    } as DishFormValue;

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

    this.pendingDishDeletionId.set(dishId);
  }

  cancelDishDeletion(): void {
    this.pendingDishDeletionId.set(null);
  }

  async confirmDishDeletion(): Promise<void> {
    const dishId = this.pendingDishDeletionId();
    const restaurant = this.selectedRestaurant();
    if (!dishId || !restaurant) {
      this.pendingDishDeletionId.set(null);
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
    } finally {
      this.pendingDishDeletionId.set(null);
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

  editInventoryItem(item: InventoryItem): void {
    this.editingInventoryItemId.set(item.id);
    this.inventoryError.set('');
    this.inventorySuccess.set('');
    this.inventoryForm.setValue({
      name: item.name,
      unit: item.unit,
      quantity: item.quantity,
      minimum: item.minimum,
    });
  }

  resetInventoryForm(): void {
    this.editingInventoryItemId.set(null);
    this.inventoryForm.reset({
      name: '',
      unit: 'unid',
      quantity: 0,
      minimum: 5,
    });
  }

  async submitInventoryItem(): Promise<void> {
    if (this.inventoryForm.invalid) {
      this.inventoryForm.markAllAsTouched();
      return;
    }

    const restaurant = this.selectedRestaurant();
    if (!restaurant) {
      this.inventoryError.set('Selecciona un restaurante para registrar inventario.');
      return;
    }

    this.inventoryError.set('');
    this.inventorySuccess.set('');

    const payload = {
      ...this.inventoryForm.getRawValue(),
      name: normalizeTextInput(this.inventoryForm.controls.name.value),
      unit: normalizeTextInput(this.inventoryForm.controls.unit.value),
    } as InventoryFormValue;

    try {
      if (this.editingInventoryItemId()) {
        await this.ownerService.updateInventoryItem(restaurant.id, this.editingInventoryItemId()!, payload);
        this.inventorySuccess.set('Insumo actualizado.');
      } else {
        await this.ownerService.createInventoryItem(restaurant.id, payload);
        this.inventorySuccess.set('Insumo registrado.');
      }

      this.resetInventoryForm();
    } catch (error) {
      this.inventoryError.set(this.ownerService.getErrorMessage(error));
    }
  }

  async deleteInventoryItem(itemId: string): Promise<void> {
    const restaurant = this.selectedRestaurant();
    if (!restaurant) {
      return;
    }

    try {
      await this.ownerService.deleteInventoryItem(restaurant.id, itemId);
      this.inventorySuccess.set('Insumo eliminado.');
    } catch (error) {
      this.inventoryError.set(this.ownerService.getErrorMessage(error));
    }
  }

  getInventoryStatus(item: InventoryItem): string {
    if (item.quantity === 0) {
      return 'Agotado';
    }

    if (item.quantity <= item.minimum) {
      return 'Bajo';
    }

    return 'Ok';
  }

  getInventoryStatusClass(item: InventoryItem): string {
    return item.quantity === 0
      ? 'inventory-status inventory-status--empty'
      : item.quantity <= item.minimum
        ? 'inventory-status inventory-status--low'
        : 'inventory-status inventory-status--ok';
  }

  async updateOrderStatus(order: Order, status: OrderStatus): Promise<void> {
    if (status === 'cancelled') {
      this.pendingOrderCancellation.set(order);
      return;
    }

    await this.applyOrderStatusUpdate(order, status);
  }

  cancelOrderCancellation(): void {
    this.pendingOrderCancellation.set(null);
  }

  async confirmOrderCancellation(): Promise<void> {
    const order = this.pendingOrderCancellation();
    if (!order) {
      return;
    }

    this.pendingOrderCancellation.set(null);
    await this.applyOrderStatusUpdate(order, 'cancelled');
  }

  private async applyOrderStatusUpdate(order: Order, status: OrderStatus): Promise<void> {
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

  async generateRestaurantQr(restaurant: Restaurant): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      this.qrError.set('El QR solo se puede generar desde el navegador.');
      return;
    }

    this.generatingQrRestaurantId.set(restaurant.id);
    this.qrError.set('');

    const publicUrl = this.getPublicMenuUrl(restaurant);

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
    } catch (error) {
      this.qrError.set('No se pudo generar el QR de este restaurante.');
    } finally {
      this.generatingQrRestaurantId.set(null);
    }
  }

  getPublicMenuUrl(restaurant: Restaurant): string {
    const origin = window.location.origin;
    return `${origin}/public/menu/${encodeURIComponent(restaurant.ownerUid)}/${encodeURIComponent(restaurant.id)}`;
  }
}
