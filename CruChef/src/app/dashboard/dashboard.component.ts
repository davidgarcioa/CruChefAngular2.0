import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs/operators';

import { Dish } from '../models/dish.model';
import { Restaurant } from '../models/restaurant.model';
import { CategorySliderComponent } from './category-slider/category-slider.component';
import { categories, dishImageOptions, ownerNavigationItems } from './dashboard.data';
import { DishCardComponent } from './dish-card/dish-card.component';
import { DishFormValue, OwnerService, RestaurantFormValue } from './owner.service';
import { SearchBarComponent } from './search-bar/search-bar.component';
import { SidebarComponent } from './sidebar/sidebar.component';

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
  private readonly ownerService = inject(OwnerService);
  private readonly destroyRef = inject(DestroyRef);

  readonly navigationItems = ownerNavigationItems;
  readonly categories = categories;
  readonly categoryOptions = categories.filter((category) => category.id !== 'all');
  readonly imageOptions = dishImageOptions;
  readonly selectedCategoryId = signal('all');
  readonly restaurants = signal<Restaurant[]>([]);
  readonly dishes = signal<Dish[]>([]);
  readonly selectedRestaurantId = signal<string | null>(null);
  readonly editingRestaurantId = signal<string | null>(null);
  readonly editingDishId = signal<string | null>(null);
  readonly viewedDish = signal<Dish | null>(null);
  readonly isSavingRestaurant = signal(false);
  readonly isSavingDish = signal(false);
  readonly restaurantError = signal('');
  readonly restaurantSuccess = signal('');
  readonly dishError = signal('');
  readonly dishSuccess = signal('');
  readonly currentView = signal(
    (this.route.snapshot.data['view'] as string | undefined) ?? 'restaurants',
  );

  readonly restaurantForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    address: ['', [Validators.required, Validators.minLength(5)]],
    city: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.minLength(7)]],
    schedule: ['', [Validators.required, Validators.minLength(3)]],
    rut: ['', [Validators.required, Validators.minLength(6)]],
  });

  readonly dishForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    price: [24000, [Validators.required, Validators.min(1000)]],
    rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
    imageKey: ['burger', Validators.required],
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
    const selectedKey = this.dishForm.controls.imageKey.value;
    return (
      this.imageOptions.find((option) => option.key === selectedKey)?.imageUrl ??
      this.imageOptions[0].imageUrl
    );
  });

  readonly viewedDishCategoryName = computed(() => {
    const dish = this.viewedDish();
    if (!dish) {
      return '';
    }

    return this.categories.find((category) => category.id === dish.categoryId)?.name ?? 'Categoria';
  });

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
          this.dishes.set([]);
          return;
        }

        if (!currentId || !restaurants.some((restaurant) => restaurant.id === currentId)) {
          this.selectedRestaurantId.set(restaurants[0].id);
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
  }

  selectRestaurant(restaurantId: string): void {
    this.selectedRestaurantId.set(restaurantId);
    this.viewedDish.set(null);
    this.editingDishId.set(null);
    this.resetDishForm();
  }

  async submitRestaurant(): Promise<void> {
    if (this.restaurantForm.invalid) {
      this.restaurantForm.markAllAsTouched();
      return;
    }

    this.isSavingRestaurant.set(true);
    this.restaurantError.set('');
    this.restaurantSuccess.set('');

    const payload = this.restaurantForm.getRawValue() as RestaurantFormValue;

    try {
      if (this.editingRestaurantId()) {
        await this.ownerService.updateRestaurant(this.editingRestaurantId()!, payload);
        this.restaurantSuccess.set('Datos del restaurante actualizados correctamente.');
      } else {
        const restaurantId = await this.ownerService.createRestaurant(payload);
        this.selectedRestaurantId.set(restaurantId);
        this.restaurantSuccess.set(
          'Restaurante creado y vinculado al correo autenticado. Queda en verificacion.',
        );
      }

      this.resetRestaurantForm();
    } catch (error) {
      this.restaurantError.set(this.ownerService.getErrorMessage(error));
    } finally {
      this.isSavingRestaurant.set(false);
    }
  }

  editRestaurant(restaurant: Restaurant): void {
    this.selectRestaurant(restaurant.id);
    this.editingRestaurantId.set(restaurant.id);
    this.restaurantError.set('');
    this.restaurantSuccess.set('');
    this.restaurantForm.setValue({
      name: restaurant.name,
      address: restaurant.address,
      city: restaurant.city,
      phone: restaurant.phone,
      schedule: restaurant.schedule,
      rut: restaurant.rut,
    });
  }

  resetRestaurantForm(): void {
    this.editingRestaurantId.set(null);
    this.restaurantError.set('');
    this.restaurantSuccess.set('');
    this.restaurantForm.reset({
      name: '',
      address: '',
      city: '',
      phone: '',
      schedule: '',
      rut: '',
    });
  }

  async deleteRestaurant(restaurantId: string): Promise<void> {
    this.restaurantError.set('');
    this.restaurantSuccess.set('');

    try {
      await this.ownerService.deleteRestaurant(restaurantId);

      if (this.selectedRestaurantId() === restaurantId) {
        this.selectedRestaurantId.set(null);
        this.viewedDish.set(null);
        this.resetDishForm();
      }

      if (this.editingRestaurantId() === restaurantId) {
        this.resetRestaurantForm();
      }

      this.restaurantSuccess.set('Restaurante y platos eliminados correctamente.');
    } catch (error) {
      this.restaurantError.set(this.ownerService.getErrorMessage(error));
    }
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
      rating: dish.rating,
      imageKey: dish.imageKey,
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
      rating: 5,
      imageKey: 'burger',
      categoryId: 'burgers',
    });
  }
}
