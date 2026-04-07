import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, Observable, catchError, firstValueFrom, map, of, switchMap } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { Dish } from '../models/dish.model';
import { Order, OrderStatus } from '../models/order.model';
import { Restaurant } from '../models/restaurant.model';
import { environment } from '../environment';

export interface CreateOrderPayload {
  quantity: number;
  notes: string;
}

export interface OrderRatingPayload {
  rating: number;
  reviewText: string;
}

@Injectable({
  providedIn: 'root',
})
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly refreshOrders$ = new BehaviorSubject<void>(undefined);

  getUserOrders(): Observable<Order[]> {
    if (!isPlatformBrowser(this.platformId)) {
      return of([]);
    }

    return this.refreshOrders$.pipe(
      switchMap(async () => {
        const user = await this.authService.requireVerifiedUser();
        return user.uid;
      }),
      switchMap((customerUid) =>
        this.http
          .get<Record<string, unknown>[]>(`${this.apiUrl}?customerUid=${encodeURIComponent(customerUid)}`)
          .pipe(
            map((orders) => orders.map((order) => this.mapOrder(order))),
            catchError((error) => {
              console.error('No se pudieron cargar las ordenes del usuario desde el backend.', error);
              return of([]);
            }),
          ),
      ),
    );
  }

  getOwnerOrders(restaurants: Restaurant[]): Observable<Order[]> {
    if (!isPlatformBrowser(this.platformId) || restaurants.length === 0) {
      return of([]);
    }

    const ownerUid = restaurants[0]?.ownerUid ?? '';
    if (!ownerUid) {
      return of([]);
    }

    return this.refreshOrders$.pipe(
      switchMap(() =>
        this.http
          .get<Record<string, unknown>[]>(`${this.apiUrl}?ownerUid=${encodeURIComponent(ownerUid)}`)
          .pipe(
            map((orders) => orders.map((order) => this.mapOrder(order))),
            map((orders) =>
              orders.filter((order) => restaurants.some((restaurant) => restaurant.id === order.restaurantId)),
            ),
            catchError((error) => {
              console.error('No se pudieron cargar las ordenes del propietario desde el backend.', error);
              return of([]);
            }),
          ),
      ),
    );
  }

  async createOrder(
    restaurant: Restaurant,
    dish: Dish,
    payload: CreateOrderPayload,
  ): Promise<void> {
    this.ensureBrowser();
    const user = await this.authService.requireVerifiedUser();

    await firstValueFrom(
      this.http.post(this.apiUrl, {
        ownerUid: restaurant.ownerUid,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
        customerUid: user.uid,
        customerEmail: user.email ?? '',
        customerName: user.displayName ?? user.email ?? 'Usuario CruChef',
        dishId: dish.id,
        dishName: dish.name,
        dishImageUrl: dish.imageUrl,
        categoryId: dish.categoryId,
        quantity: Number(payload.quantity),
        unitPrice: Number(dish.price),
        notes: payload.notes.trim(),
      }),
    );

    this.refreshOrders$.next();
  }

  async updateOrderStatus(order: Order, status: OrderStatus): Promise<void> {
    this.ensureBrowser();

    await firstValueFrom(
      this.http.patch(`${this.apiUrl}/${order.id}/status`, {
        status,
      }),
    );

    this.refreshOrders$.next();
  }

  async rateOrder(order: Order, payload: OrderRatingPayload): Promise<void> {
    this.ensureBrowser();

    await firstValueFrom(
      this.http.patch(`${this.apiUrl}/${order.id}/rating`, {
        rating: Number(payload.rating),
        reviewText: payload.reviewText.trim(),
      }),
    );

    this.refreshOrders$.next();
  }

  getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const message = typeof error.error?.message === 'string' ? error.error.message : '';

      if (error.status === 0) {
        return 'No se pudo conectar con el backend de ordenes. Verifica que Backend este corriendo en http://localhost:3000.';
      }

      if (error.status === 404) {
        if (typeof error.url === 'string' && (error.url.endsWith('/status') || error.url.endsWith('/rating'))) {
          return message || 'La orden no existe.';
        }

        return message || 'La ruta de ordenes no esta disponible en el backend.';
      }

      if (error.status === 400) {
        return message || 'Los datos de la orden no son validos.';
      }

      if (error.status >= 500) {
        return message || 'El backend no pudo procesar la orden.';
      }

      return message || 'No se pudo completar la operacion del pedido.';
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'No se pudo completar la operacion del pedido.';
  }

  private get apiUrl(): string {
    return `${environment.apiBaseUrl}/orders`;
  }

  private ensureBrowser(): void {
    if (!isPlatformBrowser(this.platformId)) {
      throw new Error('Las ordenes solo se pueden administrar desde el navegador.');
    }
  }

  private mapOrder(document: Record<string, unknown>): Order {
    return {
      id: String(document['id'] ?? ''),
      ownerUid: String(document['ownerUid'] ?? ''),
      restaurantId: String(document['restaurantId'] ?? ''),
      restaurantName: String(document['restaurantName'] ?? ''),
      customerUid: String(document['customerUid'] ?? ''),
      customerEmail: String(document['customerEmail'] ?? ''),
      customerName: String(document['customerName'] ?? ''),
      dishId: String(document['dishId'] ?? ''),
      dishName: String(document['dishName'] ?? ''),
      dishImageUrl: String(document['dishImageUrl'] ?? ''),
      categoryId: String(document['categoryId'] ?? 'all'),
      quantity: Number(document['quantity'] ?? 1),
      unitPrice: Number(document['unitPrice'] ?? 0),
      totalPrice: Number(document['totalPrice'] ?? 0),
      notes: String(document['notes'] ?? ''),
      status: this.mapStatus(document['status']),
      createdAtMs: this.toMillis(document['createdAt']),
      updatedAtMs: this.toMillis(document['updatedAt']),
      deliveredAtMs: this.toNullableMillis(document['deliveredAt']),
      rating: typeof document['rating'] === 'number' ? Number(document['rating']) : null,
      reviewText: String(document['reviewText'] ?? ''),
    };
  }

  private mapStatus(value: unknown): OrderStatus {
    switch (value) {
      case 'accepted':
      case 'preparing':
      case 'ready':
      case 'delivered':
      case 'cancelled':
        return value;
      default:
        return 'pending';
    }
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

  private toNullableMillis(value: unknown): number | null {
    if (value == null) {
      return null;
    }

    return this.toMillis(value);
  }
}


