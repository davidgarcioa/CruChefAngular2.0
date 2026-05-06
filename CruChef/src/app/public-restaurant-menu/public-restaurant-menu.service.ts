import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../environment';
import { Dish } from '../models/dish.model';
import { Restaurant } from '../models/restaurant.model';
import { getCategoryImageKey, getDishImageUrl } from '../dashboard/dashboard.data';

export interface PublicRestaurantMenu {
  restaurant: Restaurant;
  dishes: Dish[];
}

@Injectable({
  providedIn: 'root',
})
export class PublicRestaurantMenuService {
  private readonly http = inject(HttpClient);

  getRestaurantMenu(ownerUid: string, restaurantId: string): Observable<PublicRestaurantMenu> {
    return this.http
      .get<PublicRestaurantMenu>(
        `${environment.apiBaseUrl}/public/restaurants/${encodeURIComponent(ownerUid)}/${encodeURIComponent(restaurantId)}/menu`,
      )
      .pipe(
        map((menu) => ({
          restaurant: menu.restaurant,
          dishes: menu.dishes.map((dish) => this.normalizeDish(dish)),
        })),
      );
  }

  getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 404) {
        return 'Este menu publico ya no existe o el restaurante fue eliminado.';
      }

      if (error.status === 0) {
        return 'No se pudo conectar con el servidor para cargar el menu.';
      }

      if (error.status >= 500) {
        return 'El menu no esta disponible en este momento.';
      }

      return typeof error.error?.message === 'string'
        ? error.error.message
        : 'No se pudo cargar el menu publico.';
    }

    return 'No se pudo cargar el menu publico.';
  }

  private normalizeDish(dish: Dish): Dish {
    const categoryId = dish.categoryId || 'burgers';
    const imageKey = dish.imageKey || getCategoryImageKey(categoryId);

    return {
      ...dish,
      categoryId,
      imageKey,
      imageUrl: dish.imageUrl || getDishImageUrl(imageKey),
      rating: Number(dish.rating || 0),
      ratingCount: Number(dish.ratingCount || 0),
      ratingTotal: Number(dish.ratingTotal || 0),
      price: Number(dish.price || 0),
    };
  }
}
