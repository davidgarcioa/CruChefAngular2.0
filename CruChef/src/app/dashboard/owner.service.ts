import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { FirebaseError } from 'firebase/app';
import {
  BehaviorSubject,
  Observable,
  catchError,
  firstValueFrom,
  from,
  map,
  of,
  switchMap,
} from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { Dish } from '../models/dish.model';
import { InventoryItem } from '../models/inventory-item.model';
import { Restaurant } from '../models/restaurant.model';
import { environment } from '../environment';
import { emptyDishes, getCategoryImageKey, getDishImageUrl } from './dashboard.data';

export interface RestaurantFormValue {
  name: string;
  address: string;
  city: string;
  phone: string;
  schedule: string;
  rut: string;
}

export interface DishFormValue {
  name: string;
  price: number;
  categoryId: string;
}

export interface InventoryFormValue {
  name: string;
  unit: string;
  quantity: number;
  minimum: number;
}

@Injectable({
  providedIn: 'root',
})
export class OwnerService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly refreshRestaurants$ = new BehaviorSubject<void>(undefined);
  private readonly refreshDishes$ = new BehaviorSubject<void>(undefined);
  private readonly refreshInventory$ = new BehaviorSubject<void>(undefined);

  getRestaurants(): Observable<Restaurant[]> {
    if (!isPlatformBrowser(this.platformId)) {
      return of([]);
    }

    return this.refreshRestaurants$.pipe(
      switchMap(() => from(this.authService.getAuthHeaders())),
      switchMap((headers) =>
        this.http.get<Record<string, unknown>[]>(this.restaurantsUrl, { headers }),
      ),
      map((restaurants) => restaurants.map((restaurant) => this.mapRestaurant(restaurant))),
      catchError((error) => {
        console.error('No se pudieron cargar los restaurantes del propietario.', error);
        return of([] as Restaurant[]);
      }),
    );
  }

  getDishes(restaurantId: string | null): Observable<Dish[]> {
    if (!restaurantId || !isPlatformBrowser(this.platformId)) {
      return of(emptyDishes);
    }

    return this.refreshDishes$.pipe(
      switchMap(() => from(this.authService.getAuthHeaders())),
      switchMap((headers) =>
        this.http.get<Record<string, unknown>[]>(
          `${this.restaurantsUrl}/${encodeURIComponent(restaurantId)}/dishes`,
          { headers },
        ),
      ),
      map((dishes) => dishes.map((dish) => this.mapDish(dish, restaurantId))),
      catchError((error) => {
        console.error('No se pudieron cargar los platos del restaurante.', error);
        return of(emptyDishes);
      }),
    );
  }

  async createRestaurant(payload: RestaurantFormValue): Promise<string> {
    this.ensureBrowser();
    const headers = await this.authService.getAuthHeaders();
    const restaurant = await firstValueFrom(
      this.http.post<Record<string, unknown>>(this.restaurantsUrl, payload, { headers }),
    );

    this.refreshRestaurants$.next();
    return String(restaurant['id'] ?? '');
  }

  async hasRestaurants(): Promise<boolean> {
    this.ensureBrowser();
    const headers = await this.authService.getAuthHeaders();
    const restaurants = await firstValueFrom(
      this.http.get<Record<string, unknown>[]>(this.restaurantsUrl, { headers }),
    );
    return restaurants.length > 0;
  }

  async updateRestaurant(id: string, payload: RestaurantFormValue): Promise<void> {
    this.ensureBrowser();
    const headers = await this.authService.getAuthHeaders();
    await firstValueFrom(
      this.http.put(`${this.restaurantsUrl}/${encodeURIComponent(id)}`, payload, { headers }),
    );
    this.refreshRestaurants$.next();
  }

  async deleteRestaurant(id: string): Promise<void> {
    this.ensureBrowser();
    const headers = await this.authService.getAuthHeaders();
    await firstValueFrom(
      this.http.delete(`${this.restaurantsUrl}/${encodeURIComponent(id)}`, { headers }),
    );
    this.refreshRestaurants$.next();
    this.refreshDishes$.next();
  }

  async createDish(restaurant: Restaurant, payload: DishFormValue): Promise<void> {
    this.ensureBrowser();
    const headers = await this.authService.getAuthHeaders();
    await firstValueFrom(
      this.http.post(
        `${this.restaurantsUrl}/${encodeURIComponent(restaurant.id)}/dishes`,
        payload,
        { headers },
      ),
    );
    this.refreshDishes$.next();
  }

  async updateDish(
    restaurant: Restaurant,
    dishId: string,
    payload: DishFormValue,
  ): Promise<void> {
    this.ensureBrowser();
    const headers = await this.authService.getAuthHeaders();
    await firstValueFrom(
      this.http.put(
        `${this.restaurantsUrl}/${encodeURIComponent(restaurant.id)}/dishes/${encodeURIComponent(dishId)}`,
        payload,
        { headers },
      ),
    );
    this.refreshDishes$.next();
  }

  async deleteDish(restaurantId: string, dishId: string): Promise<void> {
    this.ensureBrowser();
    const headers = await this.authService.getAuthHeaders();
    await firstValueFrom(
      this.http.delete(
        `${this.restaurantsUrl}/${encodeURIComponent(restaurantId)}/dishes/${encodeURIComponent(dishId)}`,
        { headers },
      ),
    );
    this.refreshDishes$.next();
  }

  getInventory(restaurantId: string | null): Observable<InventoryItem[]> {
    if (!restaurantId || !isPlatformBrowser(this.platformId)) {
      return of([]);
    }

    return this.refreshInventory$.pipe(
      switchMap(() => from(this.authService.getAuthHeaders())),
      switchMap((headers) =>
        this.http.get<Record<string, unknown>[]>(
          `${this.restaurantsUrl}/${encodeURIComponent(restaurantId)}/inventory`,
          { headers },
        ),
      ),
      map((items) => items.map((item) => this.mapInventoryItem(item))),
      catchError((error) => {
        console.error('No se pudo cargar el inventario.', error);
        return of([] as InventoryItem[]);
      }),
    );
  }

  async createInventoryItem(restaurantId: string, payload: InventoryFormValue): Promise<void> {
    this.ensureBrowser();
    const headers = await this.authService.getAuthHeaders();
    await firstValueFrom(
      this.http.post(`${this.restaurantsUrl}/${encodeURIComponent(restaurantId)}/inventory`, payload, {
        headers,
      }),
    );
    this.refreshInventory$.next();
  }

  async updateInventoryItem(
    restaurantId: string,
    itemId: string,
    payload: InventoryFormValue,
  ): Promise<void> {
    this.ensureBrowser();
    const headers = await this.authService.getAuthHeaders();
    await firstValueFrom(
      this.http.put(
        `${this.restaurantsUrl}/${encodeURIComponent(restaurantId)}/inventory/${encodeURIComponent(itemId)}`,
        payload,
        { headers },
      ),
    );
    this.refreshInventory$.next();
  }

  async deleteInventoryItem(restaurantId: string, itemId: string): Promise<void> {
    this.ensureBrowser();
    const headers = await this.authService.getAuthHeaders();
    await firstValueFrom(
      this.http.delete(
        `${this.restaurantsUrl}/${encodeURIComponent(restaurantId)}/inventory/${encodeURIComponent(itemId)}`,
        { headers },
      ),
    );
    this.refreshInventory$.next();
  }

  getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const message = typeof error.error?.message === 'string' ? error.error.message : '';

      if (error.status === 0) {
        return 'No se pudo conectar con el backend. Verifica que Backend este corriendo en http://localhost:3000.';
      }

      if (error.status === 400) {
        return message || 'Los datos enviados no son validos.';
      }

      if (error.status === 401) {
        return message || 'Tu sesion ya no es valida. Inicia sesion de nuevo.';
      }

      if (error.status === 404) {
        return message || 'El restaurante o el plato solicitado no existe.';
      }

      if (error.status >= 500) {
        return message || 'El backend no pudo procesar la solicitud.';
      }

      return message || 'No se pudo guardar la informacion.';
    }

    const code =
      error instanceof FirebaseError
        ? error.code
        : error instanceof Error
          ? error.message
          : '';

    switch (code) {
      case 'auth/network-request-failed':
        return 'No se pudo conectar con Firebase.';
      case 'auth/user-not-found':
        return 'Tu sesion ya no es valida. Inicia sesion de nuevo.';
      case 'restaurant-required':
        return 'Debes crear o seleccionar un restaurante primero.';
      default:
        return 'No se pudo guardar la informacion.';
    }
  }

  private get restaurantsUrl(): string {
    return `${environment.apiBaseUrl}/owner/restaurants`;
  }

  private ensureBrowser(): void {
    if (!isPlatformBrowser(this.platformId)) {
      throw new Error('La administracion solo esta disponible en el navegador.');
    }
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

  private mapDish(document: Record<string, unknown>, restaurantId: string): Dish {
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
    };
  }

  private mapInventoryItem(document: Record<string, unknown>): InventoryItem {
    return {
      id: String(document['id'] ?? ''),
      name: String(document['name'] ?? ''),
      unit: String(document['unit'] ?? ''),
      quantity: Number(document['quantity'] ?? 0),
      minimum: Number(document['minimum'] ?? 0),
      updatedAtMs: this.toMillis(document['updatedAt']),
    };
  }

  private toMillis(value: unknown): number {
    if (typeof value === 'object' && value !== null) {
      const maybeSeconds = (value as { seconds?: unknown; _seconds?: unknown }).seconds;
      const legacySeconds = (value as { seconds?: unknown; _seconds?: unknown })._seconds;

      if (typeof maybeSeconds === 'number') {
        return maybeSeconds * 1000;
      }

      if (typeof legacySeconds === 'number') {
        return legacySeconds * 1000;
      }
    }

    return 0;
  }
}
