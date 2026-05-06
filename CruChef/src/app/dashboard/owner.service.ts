import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { FirebaseError } from 'firebase/app';
import {
  Firestore,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { Observable, from, of, switchMap } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { FirebaseService } from '../firebase.service';
import { Dish } from '../models/dish.model';
import { Restaurant } from '../models/restaurant.model';
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

@Injectable({
  providedIn: 'root',
})
export class OwnerService {
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
      switchMap((user) => {
        const restaurantsRef = collection(this.firestore, 'users', user.uid, 'restaurants');
        const restaurantsQuery = query(restaurantsRef, orderBy('name'));

        return new Observable<Restaurant[]>((subscriber) => {
          const unsubscribe = onSnapshot(
            restaurantsQuery,
            (snapshot) => {
              subscriber.next(
                snapshot.docs.map((document) =>
                  this.mapRestaurant(
                    {
                      id: document.id,
                      ...document.data(),
                    },
                    user.uid,
                    user.email ?? '',
                  ),
                ),
              );
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
      return of(emptyDishes);
    }

    return from(this.authService.requireVerifiedUser()).pipe(
      switchMap((user) => {
        const dishesRef = collection(
          this.firestore,
          'users',
          user.uid,
          'restaurants',
          restaurantId,
          'dishes',
        );
        const dishesQuery = query(dishesRef, orderBy('name'));

        return new Observable<Dish[]>((subscriber) => {
          const unsubscribe = onSnapshot(
            dishesQuery,
            (snapshot) => {
              subscriber.next(
                snapshot.docs.map((document) =>
                  this.mapDish(
                    {
                      id: document.id,
                      ...document.data(),
                    },
                    restaurantId,
                  ),
                ),
              );
            },
            (error) => subscriber.error(error),
          );

          return unsubscribe;
        });
      }),
    );
  }

  async createRestaurant(payload: RestaurantFormValue): Promise<string> {
    const user = await this.authService.requireVerifiedUser();
    const documentReference = await addDoc(
      collection(this.firestore, 'users', user.uid, 'restaurants'),
      this.toFirestoreRestaurantOnCreate(payload, user.uid, user.email ?? ''),
    );
    return documentReference.id;
  }

  async hasRestaurants(): Promise<boolean> {
    const user = await this.authService.requireVerifiedUser();
    const snapshot = await getDocs(collection(this.firestore, 'users', user.uid, 'restaurants'));
    return !snapshot.empty;
  }

  async updateRestaurant(id: string, payload: RestaurantFormValue): Promise<void> {
    const user = await this.authService.requireVerifiedUser();
    await updateDoc(
      doc(this.firestore, 'users', user.uid, 'restaurants', id),
      this.toFirestoreRestaurantOnUpdate(payload, user.uid, user.email ?? ''),
    );
  }

  async deleteRestaurant(id: string): Promise<void> {
    const user = await this.authService.requireVerifiedUser();
    const dishesRef = collection(this.firestore, 'users', user.uid, 'restaurants', id, 'dishes');
    const dishesSnapshot = await getDocs(dishesRef);

    if (!dishesSnapshot.empty) {
      const batch = writeBatch(this.firestore);

      dishesSnapshot.docs.forEach((dishDocument) => {
        batch.delete(dishDocument.ref);
      });

      await batch.commit();
    }

    await deleteDoc(doc(this.firestore, 'users', user.uid, 'restaurants', id));
  }

  async createDish(restaurant: Restaurant, payload: DishFormValue): Promise<void> {
    const user = await this.authService.requireVerifiedUser();
    await addDoc(
      collection(this.firestore, 'users', user.uid, 'restaurants', restaurant.id, 'dishes'),
      this.toFirestoreDishOnCreate(restaurant, payload),
    );
  }

  async updateDish(
    restaurant: Restaurant,
    dishId: string,
    payload: DishFormValue,
  ): Promise<void> {
    const user = await this.authService.requireVerifiedUser();
    await updateDoc(
      doc(this.firestore, 'users', user.uid, 'restaurants', restaurant.id, 'dishes', dishId),
      this.toFirestoreDish(restaurant, payload),
    );
  }

  async deleteDish(restaurantId: string, dishId: string): Promise<void> {
    const user = await this.authService.requireVerifiedUser();
    await deleteDoc(
      doc(this.firestore, 'users', user.uid, 'restaurants', restaurantId, 'dishes', dishId),
    );
  }

  getErrorMessage(error: unknown): string {
    const code =
      error instanceof FirebaseError
        ? error.code
        : error instanceof Error
          ? error.message
          : '';

    switch (code) {
      case 'permission-denied':
        return 'Firestore rechazo la operacion. Revisa las reglas de restaurants y dishes.';
      case 'unavailable':
      case 'auth/network-request-failed':
        return 'No se pudo conectar con Firebase.';
      case 'restaurant-required':
        return 'Debes crear o seleccionar un restaurante primero.';
      default:
        return 'No se pudo guardar la informacion.';
    }
  }

  private toFirestoreRestaurantFields(
    payload: RestaurantFormValue,
    ownerUid: string,
    ownerEmail: string,
  ) {
    return {
      ownerUid,
      ownerEmail,
      name: payload.name.trim(),
      address: payload.address.trim(),
      city: payload.city.trim(),
      phone: payload.phone.trim(),
      schedule: payload.schedule.trim(),
      rut: payload.rut.trim(),
    };
  }

  private toFirestoreRestaurantOnCreate(
    payload: RestaurantFormValue,
    ownerUid: string,
    ownerEmail: string,
  ) {
    return {
      ...this.toFirestoreRestaurantFields(payload, ownerUid, ownerEmail),
      verificationStatus: 'pending',
    };
  }

  private toFirestoreRestaurantOnUpdate(
    payload: RestaurantFormValue,
    ownerUid: string,
    ownerEmail: string,
  ) {
    return this.toFirestoreRestaurantFields(payload, ownerUid, ownerEmail);
  }

  private toFirestoreDish(restaurant: Restaurant, payload: DishFormValue) {
    const imageKey = getCategoryImageKey(payload.categoryId);

    return {
      name: payload.name.trim(),
      price: Number(payload.price),
      categoryId: payload.categoryId,
      imageKey,
      imageUrl: getDishImageUrl(imageKey),
      restaurant: restaurant.name,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
    };
  }

  private toFirestoreDishOnCreate(restaurant: Restaurant, payload: DishFormValue) {
    return {
      ...this.toFirestoreDish(restaurant, payload),
      rating: 0,
      ratingCount: 0,
      ratingTotal: 0,
    };
  }

  private mapRestaurant(
    document: Record<string, unknown>,
    ownerUid: string,
    ownerEmail: string,
  ): Restaurant {
    return {
      id: String(document['id'] ?? ''),
      ownerUid,
      ownerEmail:
        typeof document['ownerEmail'] === 'string'
          ? document['ownerEmail']
          : ownerEmail,
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
    const restaurantName = String(document['restaurantName'] ?? document['restaurant'] ?? '');

    return {
      id: String(document['id'] ?? ''),
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
}
