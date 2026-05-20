import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { FirebaseError } from 'firebase/app';
import { Observable, from, of, switchMap, map } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { Dish, DishStockRequirement } from '../models/dish.model';
import { Restaurant } from '../models/restaurant.model';
import { environment } from '../environment';
import { getCategoryImageKey, getDishImageUrl } from '../dashboard/dashboard.data';

@Injectable({
  providedIn: 'root',
})
export class PublicMenuService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);

  getRestaurants(): Observable<Restaurant[]> {
    if (!isPlatformBrowser(this.platformId)) {
      return of([]);
    }

    return from(this.authService.requireVerifiedUser()).pipe(
      switchMap(() =>
        this.http.get<Record<string, unknown>[]>(
          `${environment.apiBaseUrl}/public/restaurants`,
        ),
      ),
      map((restaurants) => restaurants.map((restaurant) => this.mapRestaurant(restaurant))),
    );
  }

  getDishes(restaurantId: string | null): Observable<Dish[]> {
    if (!restaurantId || !isPlatformBrowser(this.platformId)) {
      return of([]);
    }

    const [ownerUid, currentRestaurantId] = restaurantId.split(':');

    if (!ownerUid || !currentRestaurantId) {
      return of([]);
    }

    return from(this.authService.requireVerifiedUser()).pipe(
      switchMap(() =>
        this.http.get<Record<string, unknown>[]>(
          `${environment.apiBaseUrl}/public/restaurants/${encodeURIComponent(ownerUid)}/${encodeURIComponent(currentRestaurantId)}/dishes`,
        ),
      ),
      map((dishes) =>
        dishes.map((dish) => this.mapDish(dish, currentRestaurantId)),
      ),
    );
  }

  getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const message = typeof error.error?.message === 'string' ? error.error.message : '';

      if (error.status === 0) {
        return 'No se pudo conectar con el backend. Verifica que Backend este corriendo en http://localhost:3000.';
      }

      if (error.status === 401) {
        return message || 'Tu sesion ya no es valida. Inicia sesion de nuevo.';
      }

      if (error.status === 404) {
        return message || 'El restaurante solicitado no existe.';
      }

      if (error.status >= 500) {
        return message || 'El backend no pudo cargar el catalogo.';
      }

      return message || 'No se pudo cargar el catalogo de restaurantes.';
    }

    const code = this.getErrorCode(error);

    switch (code) {
      case 'unavailable':
      case 'auth/network-request-failed':
        return 'No se pudo conectar con el backend.';
      case 'auth/user-not-found':
        return 'Tu sesion ya no es valida. Inicia sesion de nuevo.';
      default:
        return 'No se pudo cargar el catalogo de restaurantes.';
    }
  }

  private getErrorCode(error: unknown): string {
    if (error instanceof FirebaseError) {
      return error.code;
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code: unknown }).code === 'string'
    ) {
      return (error as { code: string }).code;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return '';
  }

  private mapRestaurant(document: Record<string, unknown>): Restaurant {
    return {
      id: String(document['id'] ?? ''),
      ownerUid: String(document['ownerUid'] ?? ''),
      ownerEmail: String(document['ownerEmail'] ?? ''),
      name: String(document['name'] ?? ''),
      address: String(document['address'] ?? ''),
      city: String(document['city'] ?? ''),
      phone: String(document['phone'] ?? ''),
      schedule: String(document['schedule'] ?? ''),
      rut: String(document['rut'] ?? ''),
      verificationStatus:
        document['verificationStatus'] === 'verified' ? 'verified' : 'pending',
    };
  }

  private mapDish(
    document: Record<string, unknown>,
    restaurantId: string,
  ): Dish {
    const categoryId = String(document['categoryId'] ?? 'burgers');
    const imageKey =
      typeof document['imageKey'] === 'string'
        ? document['imageKey']
        : getCategoryImageKey(categoryId);
    const rating = Number(document['rating'] ?? 0);
    const ratingCount = Number(
      document['ratingCount'] ?? (rating > 0 ? 1 : 0),
    );
    const restaurantName = String(document['restaurantName'] ?? document['restaurant'] ?? '');

    return {
      id: String(document['id'] ?? ''),
      name: String(document['name'] ?? ''),
      price: Number(document['price'] ?? 0),
      rating,
      ratingCount,
      ratingTotal: Number(document['ratingTotal'] ?? rating * ratingCount),
      restaurant: String(document['restaurant'] ?? restaurantName),
      restaurantId:
        typeof document['restaurantId'] === 'string' ? document['restaurantId'] : restaurantId,
      restaurantName,
      categoryId,
      imageKey,
      imageUrl:
        typeof document['imageUrl'] === 'string'
          ? String(document['imageUrl'])
          : getDishImageUrl(imageKey),
      stockRequirements: this.mapStockRequirements(document['stockRequirements']),
    };
  }

  private mapStockRequirements(value: unknown): DishStockRequirement[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((requirement) => {
        const document =
          typeof requirement === 'object' && requirement !== null
            ? (requirement as Record<string, unknown>)
            : {};

        return {
          itemId: String(document['itemId'] ?? ''),
          name: String(document['name'] ?? ''),
          unit: String(document['unit'] ?? ''),
          quantity: Number(document['quantity'] ?? 0),
        };
      })
      .filter((requirement) => requirement.itemId && requirement.quantity > 0);
  }
}
