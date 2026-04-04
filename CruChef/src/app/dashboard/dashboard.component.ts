import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { CategorySliderComponent } from './category-slider/category-slider.component';
import {
  categories,
  dishImageOptions,
  ownerNavigationItems,
} from './dashboard.data';
import { DishCardComponent } from './dish-card/dish-card.component';
import { DishFormValue, DishService } from './dish.service';
import { SearchBarComponent } from './search-bar/search-bar.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { Dish } from '../models/dish.model';

interface DashboardMetric {
  label: string;
  value: string;
  detail: string;
}

interface DashboardSpotlight {
  name: string;
  restaurant: string;
  category: string;
  price: string;
  rating: string;
  imageUrl: string;
}

interface DashboardHealthRow {
  label: string;
  detail: string;
  tone: 'good' | 'warn' | 'accent';
}

interface HistoryMetric {
  label: string;
  value: string;
  detail: string;
}

interface HistoryEntry {
  title: string;
  detail: string;
  time: string;
  tone: 'created' | 'updated' | 'highlight';
}

interface CategoryHistoryRow {
  name: string;
  total: number;
  share: number;
}

interface OrderMetric {
  label: string;
  value: string;
  detail: string;
}

interface OrderRow {
  code: string;
  customer: string;
  restaurant: string;
  total: string;
  status: 'Pendiente' | 'En preparacion' | 'Listo';
  eta: string;
}

interface RestaurantLoadRow {
  restaurant: string;
  orders: number;
  share: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
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
  private readonly dishService = inject(DishService);
  private readonly destroyRef = inject(DestroyRef);

  readonly navigationItems = ownerNavigationItems;
  readonly categories = categories;
  readonly categoryOptions = categories.filter((category) => category.id !== 'all');
  readonly imageOptions = dishImageOptions;
  readonly selectedCategoryId = signal('all');
  readonly dishes = signal<Dish[]>([]);
  readonly editingDishId = signal<string | null>(null);
  readonly isSaving = signal(false);
  readonly formError = signal('');
  readonly formSuccess = signal('');
  readonly currentView =
    (this.route.snapshot.data['view'] as string | undefined) ?? 'restaurants';

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    price: [24000, [Validators.required, Validators.min(1000)]],
    rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
    restaurant: ['', [Validators.required, Validators.minLength(2)]],
    imageKey: ['burger', Validators.required],
    categoryId: ['burgers', Validators.required],
  });

  readonly filteredDishes = computed(() => {
    const categoryId = this.selectedCategoryId();
    const dishes = this.dishes();

    if (categoryId === 'all') {
      return dishes;
    }

    return dishes.filter((dish) => dish.categoryId === categoryId);
  });

  readonly dashboardMetrics = computed<DashboardMetric[]>(() => {
    const dishes = this.dishes();
    const total = dishes.length;
    const averagePrice =
      total > 0
        ? `$${Math.round(dishes.reduce((sum, dish) => sum + dish.price, 0) / total).toLocaleString('es-CO')}`
        : '$0';
    const restaurants = new Set(dishes.map((dish) => dish.restaurant)).size;
    const readyOrders = this.orderRows().filter((order) => order.status === 'Listo').length;

    return [
      {
        label: 'Catalogo activo',
        value: String(total),
        detail: 'Platos visibles ahora mismo en el panel.',
      },
      {
        label: 'Ticket medio',
        value: averagePrice,
        detail: 'Promedio actual de precios cargados.',
      },
      {
        label: 'Restaurantes activos',
        value: String(restaurants),
        detail: 'Marcas con platos publicados hoy.',
      },
      {
        label: 'Listos para salida',
        value: String(readyOrders),
        detail: 'Ordenes marcadas como listas en el flujo.',
      },
    ];
  });

  readonly dashboardSpotlight = computed<DashboardSpotlight | null>(() => {
    const topDish = [...this.dishes()].sort(
      (left, right) => right.rating - left.rating || right.price - left.price || left.name.localeCompare(right.name),
    )[0];

    if (!topDish) {
      return null;
    }

    return {
      name: topDish.name,
      restaurant: topDish.restaurant,
      category:
        this.categoryOptions.find((category) => category.id === topDish.categoryId)?.name ?? 'Sin categoria',
      price: `$${topDish.price.toLocaleString('es-CO')}`,
      rating: `${topDish.rating.toFixed(1)} / 5`,
      imageUrl:
        this.imageOptions.find((option) => option.key === topDish.imageKey)?.imageUrl ?? this.imageOptions[0].imageUrl,
    };
  });

  readonly dashboardHealthRows = computed<DashboardHealthRow[]>(() => {
    const dishes = this.dishes();
    const orders = this.orderRows();
    const coveredCategories = this.categoryOptions.filter((category) =>
      dishes.some((dish) => dish.categoryId === category.id),
    ).length;
    const pendingOrders = orders.filter((order) => order.status === 'Pendiente').length;
    const averageRating =
      dishes.length > 0
        ? (dishes.reduce((sum, dish) => sum + dish.rating, 0) / dishes.length).toFixed(1)
        : '0.0';

    return [
      {
        label: 'Cobertura del menu',
        detail: `${coveredCategories} categorias ya tienen platos cargados.`,
        tone: 'good',
      },
      {
        label: 'Pendientes por mover',
        detail: `${pendingOrders} ordenes siguen esperando arranque de cocina.`,
        tone: pendingOrders > 2 ? 'warn' : 'accent',
      },
      {
        label: 'Pulso del catalogo',
        detail: `La calificacion media del panel esta en ${averageRating}.`,
        tone: 'accent',
      },
    ];
  });

  readonly dashboardFeaturedDishes = computed(() =>
    [...this.dishes()]
      .sort((left, right) => right.rating - left.rating || right.price - left.price || left.name.localeCompare(right.name))
      .slice(0, 4),
  );

  readonly historyMetrics = computed<HistoryMetric[]>(() => {
    const dishes = this.dishes();
    const total = dishes.length;
    const averageRating =
      total > 0
        ? (dishes.reduce((sum, dish) => sum + dish.rating, 0) / total).toFixed(1)
        : '0.0';
    const restaurants = new Set(dishes.map((dish) => dish.restaurant)).size;

    const categoryCount = new Map<string, number>();
    for (const dish of dishes) {
      categoryCount.set(dish.categoryId, (categoryCount.get(dish.categoryId) ?? 0) + 1);
    }

    const topCategoryId = Array.from(categoryCount.entries()).sort((left, right) => right[1] - left[1])[0]?.[0];
    const topCategoryName =
      this.categoryOptions.find((category) => category.id === topCategoryId)?.name ?? 'Sin categoria';

    return [
      {
        label: 'Platos activos',
        value: String(total),
        detail: 'Disponibles hoy dentro del catalogo.',
      },
      {
        label: 'Calificacion media',
        value: averageRating,
        detail: 'Promedio actual de valoraciones visibles.',
      },
      {
        label: 'Restaurantes',
        value: String(restaurants),
        detail: 'Marcas o sedes con platos registrados.',
      },
      {
        label: 'Categoria lider',
        value: topCategoryName,
        detail: 'La categoria con mas movimiento del catalogo.',
      },
    ];
  });

  readonly historyEntries = computed<HistoryEntry[]>(() => {
    const dishes = [...this.dishes()].sort((left, right) => right.rating - left.rating || left.name.localeCompare(right.name));
    const timeLabels = ['Hace un momento', 'Hoy', 'Hace 2 horas', 'Ayer', 'Esta semana', 'Reciente'];

    return dishes.slice(0, 6).map((dish, index) => {
      const tone: HistoryEntry['tone'] =
        index % 3 === 0 ? 'created' : index % 3 === 1 ? 'updated' : 'highlight';

      const title =
        tone === 'created'
          ? `Nuevo plato destacado: ${dish.name}`
          : tone === 'updated'
            ? `Ajuste reciente en ${dish.name}`
            : `Buen desempeno para ${dish.name}`;

      const detail =
        tone === 'created'
          ? `${dish.restaurant} agrego este plato al flujo visible del panel.`
          : tone === 'updated'
            ? `${dish.restaurant} mantiene ${dish.rating} puntos y precio de $${dish.price.toLocaleString('es-CO')}.`
            : `${dish.name} se mantiene entre los platos mas fuertes de ${dish.restaurant}.`;

      return {
        title,
        detail,
        time: timeLabels[index] ?? 'Reciente',
        tone,
      };
    });
  });

  readonly historyCategoryRows = computed<CategoryHistoryRow[]>(() => {
    const dishes = this.dishes();
    const total = dishes.length || 1;

    return this.categoryOptions
      .map((category) => {
        const count = dishes.filter((dish) => dish.categoryId === category.id).length;
        return {
          name: category.name,
          total: count,
          share: Math.round((count / total) * 100),
        };
      })
      .filter((row) => row.total > 0)
      .sort((left, right) => right.total - left.total);
  });

  readonly orderRows = computed<OrderRow[]>(() => {
    const dishes = [...this.dishes()].sort((left, right) => right.price - left.price || left.name.localeCompare(right.name));
    const statuses: OrderRow['status'][] = ['Pendiente', 'En preparacion', 'Listo'];
    const names = ['Camila Rojas', 'Juan Perez', 'Andrea Mena', 'Carlos Diaz', 'Luisa Vega', 'Mateo Ruiz'];

    return dishes.slice(0, 6).map((dish, index) => ({
      code: `ORD-${String(index + 101).padStart(3, '0')}`,
      customer: names[index] ?? `Cliente ${index + 1}`,
      restaurant: dish.restaurant,
      total: `$${dish.price.toLocaleString('es-CO')}`,
      status: statuses[index % statuses.length],
      eta: index % 3 === 0 ? '8 min' : index % 3 === 1 ? '14 min' : 'Entregado',
    }));
  });

  readonly orderMetrics = computed<OrderMetric[]>(() => {
    const orders = this.orderRows();
    const total = orders.length;
    const pending = orders.filter((order) => order.status === 'Pendiente').length;
    const inPrep = orders.filter((order) => order.status === 'En preparacion').length;
    const ready = orders.filter((order) => order.status === 'Listo').length;

    return [
      {
        label: 'Ordenes activas',
        value: String(total),
        detail: 'Ordenes visibles en la operacion actual.',
      },
      {
        label: 'Pendientes',
        value: String(pending),
        detail: 'Esperando confirmacion o arranque de cocina.',
      },
      {
        label: 'En preparacion',
        value: String(inPrep),
        detail: 'Ordenes avanzando dentro del flujo.',
      },
      {
        label: 'Listas',
        value: String(ready),
        detail: 'Ordenes listas para despacho o entrega.',
      },
    ];
  });

  readonly restaurantLoadRows = computed<RestaurantLoadRow[]>(() => {
    const orders = this.orderRows();
    const total = orders.length || 1;
    const counts = new Map<string, number>();

    for (const order of orders) {
      counts.set(order.restaurant, (counts.get(order.restaurant) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([restaurant, ordersCount]) => ({
        restaurant,
        orders: ordersCount,
        share: Math.round((ordersCount / total) * 100),
      }))
      .sort((left, right) => right.orders - left.orders);
  });

  readonly previewImageUrl = computed(() => {
    const selectedKey = this.form.controls.imageKey.value;
    return (
      this.imageOptions.find((option) => option.key === selectedKey)?.imageUrl ??
      this.imageOptions[0].imageUrl
    );
  });

  readonly viewTitle =
    this.currentView === 'restaurants'
      ? 'Restaurantes'
      : this.currentView === 'dashboard'
        ? 'Dashboard'
        : this.currentView === 'orders'
          ? 'Ordenes'
          : 'Historial';

  constructor() {
    this.dishService
      .getDishes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((dishes) => {
        this.dishes.set(dishes);
      });
  }

  async submitDish(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.formError.set('');
    this.formSuccess.set('');

    const payload = this.form.getRawValue() as DishFormValue;

    try {
      if (this.editingDishId()) {
        await this.dishService.updateDish(this.editingDishId()!, payload);
        this.formSuccess.set('Plato actualizado correctamente.');
      } else {
        await this.dishService.createDish(payload);
        this.formSuccess.set('Plato creado correctamente.');
      }

      this.resetForm();
    } catch (error) {
      this.formError.set(this.dishService.getErrorMessage(error));
    } finally {
      this.isSaving.set(false);
    }
  }

  editDish(dish: Dish): void {
    this.editingDishId.set(dish.id);
    this.formError.set('');
    this.formSuccess.set('');
    this.form.setValue({
      name: dish.name,
      price: dish.price,
      rating: dish.rating,
      restaurant: dish.restaurant,
      imageKey: dish.imageKey,
      categoryId: dish.categoryId,
    });
  }

  async deleteDish(id: string): Promise<void> {
    this.formError.set('');
    this.formSuccess.set('');

    try {
      await this.dishService.deleteDish(id);

      if (this.editingDishId() === id) {
        this.resetForm();
      }

      this.formSuccess.set('Plato eliminado correctamente.');
    } catch (error) {
      this.formError.set(this.dishService.getErrorMessage(error));
    }
  }

  resetForm(): void {
    this.editingDishId.set(null);
    this.form.reset({
      name: '',
      price: 24000,
      rating: 5,
      restaurant: '',
      imageKey: 'burger',
      categoryId: 'burgers',
    });
  }

  isPersistedDish(dish: Dish): boolean {
    return !dish.id.startsWith('dish-');
  }
}
