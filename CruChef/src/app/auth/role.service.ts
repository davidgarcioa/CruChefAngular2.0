import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

export type AppRole = 'user' | 'owner';

@Injectable({
  providedIn: 'root',
})
export class RoleService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly storageKey = 'cruchef-session-role';
  private readonly allowedRolesStorageKey = 'cruchef-allowed-roles';
  private readonly roleState = signal<AppRole | null>(this.readRole());
  private readonly allowedRolesState = signal<AppRole[]>(this.readAllowedRoles());

  readonly role = this.roleState.asReadonly();
  readonly allowedRoles = this.allowedRolesState.asReadonly();

  getRole(): AppRole | null {
    return this.roleState();
  }

  setRole(role: AppRole): void {
    this.roleState.set(role);

    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.storageKey, role);
    }
  }

  setAllowedRoles(roles: AppRole[]): void {
    const normalized = [...new Set(roles.filter((role) => role === 'user' || role === 'owner'))];
    this.allowedRolesState.set(normalized);

    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.allowedRolesStorageKey, JSON.stringify(normalized));
    }
  }

  getAllowedRoles(): AppRole[] {
    return this.allowedRolesState();
  }

  canAccess(role: AppRole): boolean {
    return this.allowedRolesState().includes(role);
  }

  clearRole(): void {
    this.roleState.set(null);

    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(this.storageKey);
      localStorage.removeItem(this.allowedRolesStorageKey);
    }
  }

  getAllowedHomeRoute(): string {
    const roles = this.getAllowedRoles();

    if (roles.length === 1) {
      return this.getHomeRoute(roles[0]);
    }

    return '/select-role';
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

  private readAllowedRoles(): AppRole[] {
    if (!isPlatformBrowser(this.platformId)) {
      return [];
    }

    try {
      const stored = JSON.parse(localStorage.getItem(this.allowedRolesStorageKey) ?? '[]');
      return Array.isArray(stored)
        ? stored.filter((role): role is AppRole => role === 'user' || role === 'owner')
        : [];
    } catch {
      return [];
    }
  }
}
