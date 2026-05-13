import { CommonModule } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { catchError, of, switchMap, timer } from 'rxjs';

import { AuthService } from '../../auth/auth.service';
import { RoleService } from '../../auth/role.service';
import { NavigationItem } from '../dashboard.data';
import { AppNotification } from '../../models/notification.model';
import { NotificationService } from '../../shared/notification.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent {
  private readonly authService = inject(AuthService);
  private readonly roleService = inject(RoleService);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) items: NavigationItem[] = [];
  @Input() settingsRoute = '/select-role';
  @Input() role: 'user' | 'owner' = 'user';

  readonly notifications = signal<AppNotification[]>([]);
  readonly notificationsError = signal('');
  readonly isNotificationsOpen = signal(false);
  readonly unreadCount = computed(
    () => this.notifications().filter((notification) => !notification.read).length,
  );
  readonly visibleNotifications = computed(() => this.notifications().slice(0, 8));

  ngOnInit(): void {
    timer(0, 10000)
      .pipe(
        switchMap(() =>
          this.notificationService.getNotifications(this.role).pipe(
            catchError((error) => {
              this.notificationsError.set(this.notificationService.getErrorMessage(error));
              return of([] as AppNotification[]);
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((notifications) => {
        this.notificationsError.set('');
        this.notifications.set(notifications);
      });
  }

  goToSettings(): void {
    void this.router.navigateByUrl(this.settingsRoute);
  }

  toggleNotifications(): void {
    this.isNotificationsOpen.update((isOpen) => !isOpen);
  }

  async markNotificationAsRead(notification: AppNotification): Promise<void> {
    if (notification.read) {
      return;
    }

    await this.notificationService.markAsRead(notification.id);
    this.notifications.update((notifications) =>
      notifications.map((current) =>
        current.id === notification.id ? { ...current, read: true } : current,
      ),
    );
  }

  async openNotification(notification: AppNotification): Promise<void> {
    await this.markNotificationAsRead(notification);
    this.isNotificationsOpen.set(false);
    await this.router.navigateByUrl(this.getNotificationRoute(notification));
  }

  async markAllNotificationsAsRead(): Promise<void> {
    await this.notificationService.markAllAsRead(this.role);
    this.notifications.update((notifications) =>
      notifications.map((notification) => ({ ...notification, read: true })),
    );
  }

  private getNotificationRoute(notification: AppNotification): string {
    if (this.role === 'owner') {
      if (notification.type === 'inventory-low' || notification.type === 'inventory-empty') {
        return '/inventory';
      }

      if (notification.type === 'order-rated') {
        return '/history';
      }

      if (notification.orderId) {
        return '/orders';
      }

      return '/restaurants';
    }

    if (notification.type === 'order-delivered' || notification.type === 'order-cancelled') {
      return '/user/history';
    }

    if (notification.orderId) {
      return '/user/orders';
    }

    return '/user';
  }

  async logout(): Promise<void> {
    await this.authService.logout();
    this.roleService.clearRole();
    await this.router.navigateByUrl('/login');
  }
}
