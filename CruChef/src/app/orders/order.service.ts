import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { FirebaseError } from 'firebase/app';
import {
  Firestore,
  Timestamp,
  collection,
  doc,
  getFirestore,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { Observable, from, of, switchMap } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { FirebaseService } from '../firebase.service';
import { Dish } from '../models/dish.model';
import { Order, OrderStatus } from '../models/order.model';
import { Restaurant } from '../models/restaurant.model';

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

  getUserOrders(): Observable<Order[]> {
    if (!isPlatformBrowser(this.platformId) || !this.firebaseService.app) {
      return of([]);
    }

    return from(this.authService.requireVerifiedUser()).pipe(
      switchMap((user) => {
        const ordersRef = collection(this.firestore, 'users', user.uid, 'orders');

        return new Observable<Order[]>((subscriber) => {
          const unsubscribe = onSnapshot(
            ordersRef,
            (snapshot) => {
              subscriber.next(
                snapshot.docs
                  .map((document) => this.mapOrder(document.id, document.data()))
                  .sort((left, right) => right.createdAtMs - left.createdAtMs),
              );
            },
            (error) => subscriber.error(error),
          );

          return unsubscribe;
        });
      }),
    );
  }

  getOwnerOrders(restaurants: Restaurant[]): Observable<Order[]> {
    if (!isPlatformBrowser(this.platformId) || !this.firebaseService.app || restaurants.length === 0) {
      return of([]);
    }

    return from(this.authService.requireVerifiedUser()).pipe(
      switchMap((user) => {
        return new Observable<Order[]>((subscriber) => {
          const ordersByRestaurant = new Map<string, Order[]>();
          const unsubscribers = restaurants.map((restaurant) => {
            const ordersRef = collection(
              this.firestore,
              'users',
              user.uid,
              'restaurants',
              restaurant.id,
              'orders',
            );

            return onSnapshot(
              ordersRef,
              (snapshot) => {
                ordersByRestaurant.set(
                  restaurant.id,
                  snapshot.docs.map((document) => this.mapOrder(document.id, document.data())),
                );

                subscriber.next(
                  Array.from(ordersByRestaurant.values())
                    .flat()
                    .sort((left, right) => right.createdAtMs - left.createdAtMs),
                );
              },
              (error) => subscriber.error(error),
            );
          });

          return () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe());
          };
        });
      }),
    );
  }

  async createOrder(
    restaurant: Restaurant,
    dish: Dish,
    payload: CreateOrderPayload,
  ): Promise<void> {
    const user = await this.authService.requireVerifiedUser();
    const canonicalRef = doc(
      collection(
        this.firestore,
        'users',
        restaurant.ownerUid,
        'restaurants',
        restaurant.id,
        'orders',
      ),
    );
    const customerMirrorRef = doc(this.firestore, 'users', user.uid, 'orders', canonicalRef.id);

    const orderPayload = {
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
      totalPrice: Number(dish.price) * Number(payload.quantity),
      notes: payload.notes.trim(),
      status: 'pending',
      rating: null,
      reviewText: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      deliveredAt: null,
    };

    const batch = writeBatch(this.firestore);
    batch.set(canonicalRef, orderPayload);
    batch.set(customerMirrorRef, orderPayload);
    await batch.commit();
  }

  async updateOrderStatus(order: Order, status: OrderStatus): Promise<void> {
    const user = await this.authService.requireVerifiedUser();

    if (user.uid !== order.ownerUid) {
      throw new Error('permission-denied');
    }

    const refs = this.getOrderRefs(order);
    const patch = {
      status,
      updatedAt: serverTimestamp(),
      deliveredAt: status === 'delivered' ? serverTimestamp() : null,
    };

    const batch = writeBatch(this.firestore);
    batch.update(refs.canonicalRef, patch);
    batch.update(refs.customerMirrorRef, patch);
    await batch.commit();
  }

  async rateOrder(order: Order, payload: OrderRatingPayload): Promise<void> {
    const user = await this.authService.requireVerifiedUser();

    if (user.uid !== order.customerUid) {
      throw new Error('permission-denied');
    }

    await runTransaction(this.firestore, async (transaction) => {
      const refs = this.getOrderRefs(order);
      const dishRef = doc(
        this.firestore,
        'users',
        order.ownerUid,
        'restaurants',
        order.restaurantId,
        'dishes',
        order.dishId,
      );

      const orderSnapshot = await transaction.get(refs.canonicalRef);
      const dishSnapshot = await transaction.get(dishRef);

      if (!orderSnapshot.exists()) {
        throw new Error('order-not-found');
      }

      const orderData = orderSnapshot.data();
      const currentStatus = String(orderData['status'] ?? 'pending') as OrderStatus;
      const currentCustomerUid = String(orderData['customerUid'] ?? '');
      const existingRating =
        typeof orderData['rating'] === 'number' ? Number(orderData['rating']) : null;

      if (currentCustomerUid !== user.uid) {
        throw new Error('permission-denied');
      }

      if (currentStatus !== 'delivered') {
        throw new Error('order-not-delivered');
      }

      if (existingRating != null) {
        throw new Error('order-already-rated');
      }

      const dishData = dishSnapshot.exists() ? dishSnapshot.data() : {};
      const currentRatingCount = Number(dishData['ratingCount'] ?? 0);
      const currentRatingTotal =
        Number(dishData['ratingTotal'] ?? Number(dishData['rating'] ?? 0) * currentRatingCount);
      const nextRatingCount = currentRatingCount + 1;
      const nextRatingTotal = currentRatingTotal + Number(payload.rating);
      const nextRating = Number((nextRatingTotal / nextRatingCount).toFixed(1));
      const ratingPatch = {
        rating: Number(payload.rating),
        reviewText: payload.reviewText.trim(),
        updatedAt: serverTimestamp(),
      };

      transaction.update(refs.canonicalRef, ratingPatch);
      transaction.update(refs.customerMirrorRef, ratingPatch);

      if (dishSnapshot.exists()) {
        transaction.update(dishRef, {
          rating: nextRating,
          ratingCount: nextRatingCount,
          ratingTotal: nextRatingTotal,
        });
      }
    });
  }

  getErrorMessage(error: unknown): string {
    const code = this.getErrorCode(error);

    switch (code) {
      case 'permission-denied':
        return 'Firestore rechazo la operacion. Revisa las reglas de orders y dishes.';
      case 'failed-precondition':
        return 'Firestore requiere configuracion adicional para pedidos.';
      case 'order-not-found':
        return 'No se encontro el pedido seleccionado.';
      case 'order-not-delivered':
        return 'Solo puedes calificar pedidos entregados.';
      case 'order-already-rated':
        return 'Este pedido ya fue calificado.';
      case 'unavailable':
      case 'auth/network-request-failed':
        return 'No se pudo conectar con Firebase.';
      default:
        return 'No se pudo completar la operacion del pedido.';
    }
  }

  private getOrderRefs(order: Order) {
    return {
      canonicalRef: doc(
        this.firestore,
        'users',
        order.ownerUid,
        'restaurants',
        order.restaurantId,
        'orders',
        order.id,
      ),
      customerMirrorRef: doc(this.firestore, 'users', order.customerUid, 'orders', order.id),
    };
  }

  private mapOrder(id: string, document: Record<string, unknown>): Order {
    return {
      id,
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
    if (value instanceof Timestamp) {
      return value.toMillis();
    }

    if (typeof value === 'object' && value !== null && 'seconds' in value) {
      return Number((value as { seconds: number }).seconds) * 1000;
    }

    return 0;
  }

  private toNullableMillis(value: unknown): number | null {
    if (value == null) {
      return null;
    }

    return this.toMillis(value);
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
}

