import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { switchMap } from 'rxjs/operators';

import { Dish } from '../models/dish.model';
import { Restaurant } from '../models/restaurant.model';
import { DishCardComponent } from '../dashboard/dish-card/dish-card.component';
import { categories } from '../dashboard/dashboard.data';
import { PublicMenuService } from './public-menu.service';

@Component({
  selector: 'app-public-restaurant-menu',
  standalone: true,
  imports: [CommonModule, DishCardComponent],
  templateUrl: './public-restaurant-menu.component.html',
  styleUrl: './public-restaurant-menu.component.css',
})
export class PublicRestaurantMenuComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly publicMenuService = inject(PublicMenuService);
  private readonly destroyRef = inject(DestroyRef);

  readonly categories = categories;
  readonly selectedCategoryId = signal('all');
  readonly restaurant = signal<Restaurant | null>(null);
  readonly dishes = signal<Dish[]>([]);
  readonly isLoading = signal(true);
  readonly error = signal('');

  readonly filteredDishes = computed(() => {
    const categoryId = this.selectedCategoryId();
    const dishes = this.dishes();

    if (categoryId === 'all') {
      return dishes;
    }

    return dishes.filter((dish) => dish.categoryId === categoryId);
  });

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const ownerUid = params.get('ownerUid');
          const restaurantId = params.get('restaurantId');

          if (!ownerUid || !restaurantId) {
            this.error.set('Restaurante no encontrado.');
            this.isLoading.set(false);
            return [];
          }

          const combinedId = `${ownerUid}:${restaurantId}`;
          return this.publicMenuService.getDishes(combinedId);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (dishes) => {
          this.dishes.set(dishes);
          this.isLoading.set(false);
          this.error.set('');
        },
        error: (error) => {
          this.error.set(this.publicMenuService.getErrorMessage(error));
          this.isLoading.set(false);
        },
      });
  }

  viewDish(dish: Dish): void {
    // For now, just log. Can be extended with modal later.
    console.log('Viewing dish:', dish);
  }
}
