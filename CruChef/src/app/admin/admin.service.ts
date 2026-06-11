import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { environment } from '../environment';
import { Dish, DishStockRequirement } from '../models/dish.model';
import { Restaurant } from '../models/restaurant.model';
import { getCategoryImageKey, getDishImageUrl } from '../dashboard/dashboard.data';

export interface RestaurantRutDocument {
  fileName: string;
  fileType: string;
  fileSize: number;
  fileData: string;
}

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  async getRestaurants(): Promise<Restaurant[]> {
    const headers = await this.authService.getAuthHeaders();
    const restaurants = await firstValueFrom(
      this.http.get<Record<string, unknown>[]>(this.restaurantsUrl, { headers }),
    );
    return restaurants.map((restaurant) => this.mapRestaurant(restaurant));
  }

  async verifyRestaurant(restaurant: Restaurant): Promise<void> {
    const headers = await this.authService.getAuthHeaders();
    await firstValueFrom(
      this.http.put(
        `${this.restaurantsUrl}/${encodeURIComponent(restaurant.ownerUid)}/${encodeURIComponent(restaurant.id)}/verify`,
        {},
        { headers },
      ),
    );
  }

  async getRestaurantRut(restaurant: Restaurant): Promise<RestaurantRutDocument> {
    const headers = await this.authService.getAuthHeaders();
    return firstValueFrom(
      this.http.get<RestaurantRutDocument>(
        `${this.restaurantsUrl}/${encodeURIComponent(restaurant.ownerUid)}/${encodeURIComponent(restaurant.id)}/rut`,
        { headers },
      ),
    );
  }

  async getRestaurantDishes(restaurant: Restaurant): Promise<Dish[]> {
    const headers = await this.authService.getAuthHeaders();
    const dishes = await firstValueFrom(
      this.http.get<Record<string, unknown>[]>(
        `${this.restaurantsUrl}/${encodeURIComponent(restaurant.ownerUid)}/${encodeURIComponent(restaurant.id)}/dishes`,
        { headers },
      ),
    );
    return dishes.map((dish) => this.mapDish(dish, restaurant.id));
  }

  async deleteRestaurant(restaurant: Restaurant): Promise<void> {
    const headers = await this.authService.getAuthHeaders();
    await firstValueFrom(
      this.http.delete(
        `${this.restaurantsUrl}/${encodeURIComponent(restaurant.ownerUid)}/${encodeURIComponent(restaurant.id)}`,
        { headers },
      ),
    );
  }

  getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const message = typeof error.error?.message === 'string' ? error.error.message : '';

      if (error.status === 0) {
        return 'No se pudo conectar con el backend. Verifica que Backend este corriendo en http://localhost:3000.';
      }

      if (error.status === 403) {
        return message || 'No tienes permisos para acceder a la administracion.';
      }

      return message || 'No se pudo completar la accion administrativa.';
    }

    return 'No se pudo completar la accion administrativa.';
  }

  private get restaurantsUrl(): string {
    return `${environment.apiBaseUrl}/admin/restaurants`;
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
      rutFileName: String(document['rutFileName'] ?? ''),
      rutFileType: String(document['rutFileType'] ?? ''),
      rutFileSize: Number(document['rutFileSize'] ?? 0),
      verificationStatus:
        document['verificationStatus'] === 'verified' ? 'verified' : 'pending',
    };
  }

  private mapDish(document: Record<string, unknown>, restaurantId: string): Dish {
    const categoryId = String(document['categoryId'] ?? 'burgers');
    const imageKey =
      typeof document['imageKey'] === 'string'
        ? document['imageKey']
        : getCategoryImageKey(categoryId);
    const rating = Number(document['rating'] ?? 0);
    const ratingCount = Number(document['ratingCount'] ?? (rating > 0 ? 1 : 0));
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
        typeof document['restaurantId'] === 'string'
          ? document['restaurantId']
          : restaurantId,
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
