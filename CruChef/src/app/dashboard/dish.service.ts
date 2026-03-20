import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { FirebaseError } from 'firebase/app';
import {
  Firestore,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { Observable, of } from 'rxjs';

import { FirebaseService } from '../firebase.service';
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
  private readonly firebaseService = inject(FirebaseService);
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

  getImageOptions() {
    return dishImageOptions;
  }

  getDishes(): Observable<Dish[]> {
    if (!isPlatformBrowser(this.platformId) || !this.firebaseService.app) {
      return of(defaultDishes);
    }

    return new Observable<Dish[]>((subscriber) => {
      const dishesRef = collection(this.firestore, 'dishes');
      const dishesQuery = query(dishesRef, orderBy('name'));

      const unsubscribe = onSnapshot(
        dishesQuery,
        (snapshot) => {
          const dishes = snapshot.docs.map((document) =>
            this.mapDish({
              id: document.id,
              ...document.data(),
            }),
          );

          subscriber.next(dishes.length > 0 ? dishes : defaultDishes);
        },
        (error) => subscriber.error(error),
      );

      return unsubscribe;
    });
  }

  async createDish(payload: DishFormValue): Promise<void> {
    await addDoc(collection(this.firestore, 'dishes'), this.toFirestoreDish(payload));
  }

  async updateDish(id: string, payload: DishFormValue): Promise<void> {
    await updateDoc(doc(this.firestore, 'dishes', id), this.toFirestoreDish(payload));
  }

  async deleteDish(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'dishes', id));
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
        return 'Firestore rechazo la operacion. Revisa las reglas de la coleccion dishes.';
      case 'unavailable':
      case 'auth/network-request-failed':
        return 'No se pudo conectar con Firebase.';
      default:
        return 'No se pudo guardar el plato.';
    }
  }

  private toFirestoreDish(payload: DishFormValue) {
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
