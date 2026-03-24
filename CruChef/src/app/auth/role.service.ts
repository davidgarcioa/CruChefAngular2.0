import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

export type AppRole = 'user' | 'owner';

@Injectable({
  providedIn: 'root',
})
export class RoleService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly storageKey = 'cruchef-session-role';
  private readonly roleState = signal<AppRole | null>(this.readRole());

  readonly role = this.roleState.asReadonly();

  getRole(): AppRole | null {
    return this.roleState();
  }

  setRole(role: AppRole): void {
    this.roleState.set(role);

    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.storageKey, role);
    }
  }

  clearRole(): void {
    this.roleState.set(null);

    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(this.storageKey);
    }
  }

  getHomeRoute(role = this.getRole()): string {
    if (role === 'owner') {
      return '/restaurants';
    }

    if (role === 'user') {
      return '/user';
    }

    return '/select-role';
  }

  private readRole(): AppRole | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    const role = localStorage.getItem(this.storageKey);
    return role === 'user' || role === 'owner' ? role : null;
  }
}
