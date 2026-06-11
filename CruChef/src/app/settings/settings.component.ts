import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { User } from 'firebase/auth';

import { AuthService } from '../auth/auth.service';
import { RoleService } from '../auth/role.service';
import { SidebarComponent } from '../dashboard/sidebar/sidebar.component';
import { ownerNavigationItems, userNavigationItems } from '../dashboard/dashboard.data';

type SettingsRole = 'user' | 'owner';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterLink, SidebarComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly roleService = inject(RoleService);

  readonly role = signal<SettingsRole>(
    (this.route.snapshot.data['role'] as SettingsRole | undefined) ?? 'user',
  );
  readonly currentUser = signal<User | null>(null);

  readonly isOwner = computed(() => this.role() === 'owner');
  readonly navigationItems = computed(() =>
    (this.isOwner() ? ownerNavigationItems : userNavigationItems).filter(
      (item) =>
        item.route !== '/select-role' || this.roleService.allowedRoles().length > 1,
    ),
  );
  readonly settingsRoute = computed(() =>
    this.isOwner() ? '/owner/settings' : '/user/settings',
  );
  readonly homeRoute = computed(() => (this.isOwner() ? '/restaurants' : '/user'));
  readonly displayName = computed(
    () => this.currentUser()?.displayName || 'Cuenta CruChef',
  );
  readonly email = computed(() => this.currentUser()?.email || 'Correo no disponible');
  readonly verifiedLabel = computed(() =>
    this.currentUser()?.emailVerified ? 'Correo verificado' : 'Correo pendiente',
  );

  readonly ownerSettings = [
    {
      icon: 'storefront',
      title: 'Restaurantes',
      text: 'Administra restaurantes, datos publicos, horarios y codigos QR.',
    },
    {
      icon: 'restaurant_menu',
      title: 'Catalogo',
      text: 'Crea platos, ajusta precios y revisa como se vera cada categoria.',
    },
    {
      icon: 'receipt_long',
      title: 'Operacion',
      text: 'Atiende pedidos, cambia estados y revisa el historial de ventas.',
    },
  ];

  readonly userSettings = [
    {
      icon: 'person',
      title: 'Perfil de cliente',
      text: 'Revisa la cuenta con la que haces pedidos dentro de CruChef.',
    },
    {
      icon: 'shopping_bag',
      title: 'Pedidos',
      text: 'Consulta pedidos activos y el historial de restaurantes visitados.',
    },
    {
      icon: 'star',
      title: 'Calificaciones',
      text: 'Deja comentarios cuando tus pedidos hayan sido entregados.',
    },
  ];

  constructor() {
    this.route.data.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data) => {
      this.role.set((data['role'] as SettingsRole | undefined) ?? 'user');
    });

    void this.loadUser();
  }

  private async loadUser(): Promise<void> {
    this.currentUser.set(await this.authService.getVerifiedUser());
  }
}
