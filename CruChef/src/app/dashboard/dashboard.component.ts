import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { CategorySliderComponent } from './category-slider/category-slider.component';
import {
  categories,
  dishImageOptions,
  navigationItems,
} from './dashboard.data';
import { DishCardComponent } from './dish-card/dish-card.component';
import { DishFormValue, DishService } from './dish.service';
import { SearchBarComponent } from './search-bar/search-bar.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { Dish } from '../models/dish.model';

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

  readonly navigationItems = navigationItems;
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
