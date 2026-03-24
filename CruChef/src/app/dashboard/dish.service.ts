import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, Observable, catchError, firstValueFrom, map, of, switchMap } from 'rxjs';

import { environment } from '../environment';
import { Dish } from '../models/dish.model';
import {
  defaultDishes,
  dishImageOptions,
  getDishImageUrl,
} from './dashboard.data';

export interface DishFormValue {
  name: string;
  price: number;
  rating: number;
  restaurant: string;
  imageKey: string;
  categoryId: string;
}

@Injectable({
  providedIn: 'root',
})
export class DishService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly refreshDishes$ = new BehaviorSubject<void>(undefined);

  getImageOptions() {
    return dishImageOptions;
  }

  getDishes(): Observable<Dish[]> {
    if (!isPlatformBrowser(this.platformId)) {
      return of(defaultDishes);
    }

    return this.refreshDishes$.pipe(
      switchMap(() =>
        this.http.get<Record<string, unknown>[]>(this.apiUrl).pipe(
          map((documents) => documents.map((document) => this.mapDish(document))),
          map((dishes) => (dishes.length > 0 ? dishes : defaultDishes)),
          catchError((error) => {
            console.error('No se pudieron cargar los platos desde el backend.', error);
            return of(defaultDishes);
          }),
        ),
      ),
    );
  }

  async createDish(payload: DishFormValue): Promise<void> {
    this.ensureBrowser();
    await firstValueFrom(this.http.post(this.apiUrl, this.toApiDish(payload)));
    this.refreshDishes$.next();
  }

  async updateDish(id: string, payload: DishFormValue): Promise<void> {
    this.ensureBrowser();
    await firstValueFrom(this.http.put(`${this.apiUrl}/${id}`, this.toApiDish(payload)));
    this.refreshDishes$.next();
  }

  async deleteDish(id: string): Promise<void> {
    this.ensureBrowser();
    await firstValueFrom(this.http.delete(`${this.apiUrl}/${id}`));
    this.refreshDishes$.next();
  }

  getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const message =
        typeof error.error?.message === 'string' ? error.error.message : '';

      if (error.status === 0) {
        return 'No se pudo conectar con el backend de platos. Verifica que Backend este corriendo en http://localhost:3000.';
      }

      if (error.status === 404) {
        return message || 'El plato ya no existe en Firebase.';
      }

      if (error.status >= 500) {
        return message || 'El backend no pudo guardar el plato en Firebase.';
      }

      return message || 'No se pudo guardar el plato.';
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'No se pudo guardar el plato.';
  }

  private get apiUrl(): string {
    return `${environment.apiBaseUrl}/dishes`;
  }

  private ensureBrowser(): void {
    if (!isPlatformBrowser(this.platformId)) {
      throw new Error('Los platos solo se pueden administrar desde el navegador.');
    }
  }

  private toApiDish(payload: DishFormValue) {
    return {
      name: payload.name.trim(),
      price: Number(payload.price),
      rating: Number(payload.rating),
      restaurant: payload.restaurant.trim(),
      categoryId: payload.categoryId,
      imageKey: payload.imageKey,
      imageUrl: getDishImageUrl(payload.imageKey),
    };
  }

  private mapDish(document: Record<string, unknown>): Dish {
    const imageKey =
      typeof document['imageKey'] === 'string' ? document['imageKey'] : 'burger';

    return {
      id: String(document['id'] ?? ''),
      name: String(document['name'] ?? ''),
      price: Number(document['price'] ?? 0),
      rating: Number(document['rating'] ?? 0),
      restaurant: String(document['restaurant'] ?? ''),
      categoryId: String(document['categoryId'] ?? 'all'),
      imageKey,
      imageUrl:
        typeof document['imageUrl'] === 'string'
          ? String(document['imageUrl'])
          : getDishImageUrl(imageKey),
    };
  }
}
