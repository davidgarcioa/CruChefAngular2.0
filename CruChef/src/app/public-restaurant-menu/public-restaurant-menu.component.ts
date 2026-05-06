import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { switchMap } from 'rxjs';

import { CategorySliderComponent } from '../dashboard/category-slider/category-slider.component';
import { categories } from '../dashboard/dashboard.data';
import { DishCardComponent } from '../dashboard/dish-card/dish-card.component';
import { Dish } from '../models/dish.model';
import { Restaurant } from '../models/restaurant.model';
import { PublicRestaurantMenuService } from './public-restaurant-menu.service';

@Component({
  selector: 'app-public-restaurant-menu',
  standalone: true,
  imports: [CommonModule, CategorySliderComponent, DishCardComponent],
  templateUrl: './public-restaurant-menu.component.html',
  styleUrl: './public-restaurant-menu.component.css',
})
export class PublicRestaurantMenuComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly publicRestaurantMenuService = inject(PublicRestaurantMenuService);
  private readonly destroyRef = inject(DestroyRef);

  readonly categories = categories;
  readonly selectedCategoryId = signal('all');
  readonly restaurant = signal<Restaurant | null>(null);
  readonly dishes = signal<Dish[]>([]);
  readonly isLoading = signal(true);
  readonly menuError = signal('');

  readonly filteredDishes = computed(() => {
    const categoryId = this.selectedCategoryId();

    return this.dishes().filter((dish) =>
      categoryId === 'all' ? true : dish.categoryId === categoryId,
    );
  });

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const ownerUid = params.get('ownerUid') ?? '';
          const restaurantId = params.get('restaurantId') ?? '';

          this.isLoading.set(true);
          this.menuError.set('');
          this.restaurant.set(null);
          this.dishes.set([]);
          this.selectedCategoryId.set('all');

          return this.publicRestaurantMenuService.getRestaurantMenu(ownerUid, restaurantId);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (menu) => {
          this.restaurant.set(menu.restaurant);
          this.dishes.set(menu.dishes);
          this.isLoading.set(false);
        },
        error: (error) => {
          this.isLoading.set(false);
          this.menuError.set(this.publicRestaurantMenuService.getErrorMessage(error));
        },
      });
  }
}
