import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Observable, firstValueFrom, from, map, of, switchMap } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { environment } from '../environment';
import { AppNotification, NotificationAudience } from '../models/notification.model';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);

  getNotifications(audience: NotificationAudience): Observable<AppNotification[]> {
    if (!isPlatformBrowser(this.platformId)) {
      return of([]);
    }

    return from(this.authService.requireVerifiedUser()).pipe(
      switchMap((user) =>
        this.http.get<Record<string, unknown>[]>(
          `${this.apiUrl}?recipientUid=${encodeURIComponent(user.uid)}&audience=${encodeURIComponent(audience)}`,
        ),
      ),
      map((notifications) =>
        notifications.map((notification) => this.mapNotification(notification)),
      ),
    );
  }

  async markAsRead(notificationId: string): Promise<void> {
    if (!notificationId || !isPlatformBrowser(this.platformId)) {
      return;
    }

    await firstValueFrom(this.http.patch(`${this.apiUrl}/${notificationId}/read`, {}));
  }

  async markAllAsRead(audience: NotificationAudience): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const user = await this.authService.requireVerifiedUser();
    await firstValueFrom(
      this.http.patch(`${this.apiUrl}/read-all`, {
        recipientUid: user.uid,
        audience,
      }),
    );
  }

  getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const message = typeof error.error?.message === 'string' ? error.error.message : '';

      if (error.status === 0) {
        return 'No se pudo conectar con el backend de notificaciones.';
      }

      return message || 'No se pudieron cargar las notificaciones.';
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'No se pudieron cargar las notificaciones.';
  }

  private get apiUrl(): string {
    return `${environment.apiBaseUrl}/notifications`;
  }

  private mapNotification(document: Record<string, unknown>): AppNotification {
    return {
      id: String(document['id'] ?? ''),
      recipientUid: String(document['recipientUid'] ?? ''),
      audience: document['audience'] === 'owner' ? 'owner' : 'user',
      type: String(document['type'] ?? 'system'),
      title: String(document['title'] ?? ''),
      message: String(document['message'] ?? ''),
      orderId: String(document['orderId'] ?? ''),
      restaurantId: String(document['restaurantId'] ?? ''),
      restaurantName: String(document['restaurantName'] ?? ''),
      dishName: String(document['dishName'] ?? ''),
      read: Boolean(document['read']),
      createdAtMs: this.toMillis(document['updatedAt'] ?? document['createdAt']),
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

    return Date.now();
  }
}
