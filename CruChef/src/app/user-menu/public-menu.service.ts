import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { FirebaseError } from 'firebase/app';
import {
  Firestore,
  collection,
  collectionGroup,
  getFirestore,
  onSnapshot,
} from 'firebase/firestore';
import { Observable, from, of, switchMap } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { FirebaseService } from '../firebase.service';
import { Dish } from '../models/dish.model';
import { Restaurant } from '../models/restaurant.model';
import { getCategoryImageKey, getDishImageUrl } from '../dashboard/dashboard.data';

@Injectable({
  providedIn: 'root',
})
export class PublicMenuService {
  private readonly firebaseService = inject(FirebaseService);
  private readonly authService = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);
  private firestoreInstance: Firestore | null = null;

  private get firestore(): Firestore {
    if (!isPlatformBrowser(this.platformId) || !this.firebaseService.app) {
      throw new Error('Firestore no esta disponible en este entorno.');
    }

    if (!this.firestoreInstance) {
      this.firestoreInstance = getFirestore(this.firebaseService.app);
    }

    return this.firestoreInstance;
  }

  getRestaurants(): Observable<Restaurant[]> {
    if (!isPlatformBrowser(this.platformId) || !this.firebaseService.app) {
      return of([]);
    }

    return from(this.authService.requireVerifiedUser()).pipe(
      switchMap(() => {
        const restaurantsRef = collectionGroup(this.firestore, 'restaurants');

        return new Observable<Restaurant[]>((subscriber) => {
          const unsubscribe = onSnapshot(
            restaurantsRef,
            (snapshot) => {
              const restaurants = snapshot.docs
                .map((document) => this.mapRestaurant(document.id, document.data(), document.ref.parent.parent?.id ?? ''))
                .sort((left, right) => left.name.localeCompare(right.name));

              subscriber.next(restaurants);
            },
            (error) => subscriber.error(error),
          );

          return unsubscribe;
        });
      }),
    );
  }

  getDishes(restaurantId: string | null): Observable<Dish[]> {
    if (!restaurantId || !isPlatformBrowser(this.platformId) || !this.firebaseService.app) {
      return of([]);
    }

    const [ownerUid, currentRestaurantId] = restaurantId.split(':');

    if (!ownerUid || !currentRestaurantId) {
      return of([]);
    }

    return from(this.authService.requireVerifiedUser()).pipe(
      switchMap(() => {
        const dishesRef = collection(
          this.firestore,
          'users',
          ownerUid,
          'restaurants',
          currentRestaurantId,
          'dishes',
        );

        return new Observable<Dish[]>((subscriber) => {
          const unsubscribe = onSnapshot(
            dishesRef,
            (snapshot) => {
              const dishes = snapshot.docs
                .map((document) =>
                  this.mapDish(document.id, document.data(), currentRestaurantId),
                )
                .sort((left, right) => left.name.localeCompare(right.name));

              subscriber.next(dishes);
            },
            (error) => subscriber.error(error),
          );

          return unsubscribe;
        });
      }),
    );
  }

  getErrorMessage(error: unknown): string {
    const code = this.getErrorCode(error);

    switch (code) {
      case 'permission-denied':
        return 'Firebase no permite leer los restaurantes. Ajusta las reglas de Firestore.';
      case 'unavailable':
      case 'auth/network-request-failed':
        return 'No se pudo conectar con Firebase.';
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

  private mapRestaurant(
    id: string,
    document: Record<string, unknown>,
    ownerUid: string,
  ): Restaurant {
    return {
      id,
      ownerUid,
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
    id: string,
    document: Record<string, unknown>,
    restaurantId: string,
  ): Dish {
    const categoryId = String(document['categoryId'] ?? 'burgers');
    const imageKey =
      typeof document['imageKey'] === 'string'
        ? document['imageKey']
        : getCategoryImageKey(categoryId);
    const restaurantName = String(document['restaurantName'] ?? document['restaurant'] ?? '');

    return {
      id,
      name: String(document['name'] ?? ''),
      price: Number(document['price'] ?? 0),
      rating: Number(document['rating'] ?? 0),
      ratingCount: Number(
        document['ratingCount'] ??
          (Number(document['rating'] ?? 0) > 0 ? 1 : 0),
      ),
      ratingTotal: Number(
        document['ratingTotal'] ??
          Number(document['rating'] ?? 0) *
            Number(document['ratingCount'] ?? (Number(document['rating'] ?? 0) > 0 ? 1 : 0)),
      ),
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
    };
  }
}
