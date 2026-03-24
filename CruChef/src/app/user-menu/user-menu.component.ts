import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Dish } from '../models/dish.model';
import { CategorySliderComponent } from '../dashboard/category-slider/category-slider.component';
import { DishCardComponent } from '../dashboard/dish-card/dish-card.component';
import { SidebarComponent } from '../dashboard/sidebar/sidebar.component';
import { DishService } from '../dashboard/dish.service';
import { categories, userNavigationItems } from '../dashboard/dashboard.data';

@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [
    CommonModule,
    SidebarComponent,
    CategorySliderComponent,
    DishCardComponent,
  ],
  templateUrl: './user-menu.component.html',
  styleUrl: './user-menu.component.css',
})
export class UserMenuComponent {
  private readonly dishService = inject(DishService);
  private readonly destroyRef = inject(DestroyRef);

  readonly navigationItems = userNavigationItems;
  readonly categories = categories;
  readonly dishes = signal<Dish[]>([]);
  readonly selectedCategoryId = signal('all');
  readonly selectedRestaurant = signal('');

  readonly restaurants = computed(() => {
    const uniqueRestaurants = new Set(
      this.dishes()
        .map((dish) => dish.restaurant.trim())
        .filter((restaurant) => restaurant.length > 0),
    );

    return Array.from(uniqueRestaurants).sort((left, right) => left.localeCompare(right));
  });

  readonly currentRestaurantLabel = computed(
    () => this.selectedRestaurant() || 'sin restaurante seleccionado',
  );

  readonly filteredDishes = computed(() => {
    const categoryId = this.selectedCategoryId();
    const restaurant = this.selectedRestaurant();

    return this.dishes().filter((dish) => {
      const sameRestaurant = restaurant ? dish.restaurant === restaurant : true;
      const sameCategory = categoryId === 'all' ? true : dish.categoryId === categoryId;
      return sameRestaurant && sameCategory;
    });
  });

  constructor() {
    this.dishService
      .getDishes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((dishes) => {
        this.dishes.set(dishes);

        const restaurants = this.getRestaurants(dishes);
        const currentRestaurant = this.selectedRestaurant();

        if (!currentRestaurant || !restaurants.includes(currentRestaurant)) {
          this.selectedRestaurant.set(restaurants[0] ?? '');
        }
      });
  }

  selectRestaurant(restaurant: string): void {
    this.selectedRestaurant.set(restaurant);
  }

  private getRestaurants(dishes: Dish[]): string[] {
    const uniqueRestaurants = new Set(
      dishes.map((dish) => dish.restaurant.trim()).filter((restaurant) => restaurant.length > 0),
    );

    return Array.from(uniqueRestaurants).sort((left, right) => left.localeCompare(right));
  }
}
