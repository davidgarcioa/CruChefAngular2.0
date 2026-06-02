import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../auth/auth.service';
import { AppRole, RoleService } from '../auth/role.service';
import { NavigationItem } from '../dashboard/dashboard.data';
import { OwnerService } from '../dashboard/owner.service';
import { SidebarComponent } from '../dashboard/sidebar/sidebar.component';
import { Dish } from '../models/dish.model';
import { Restaurant } from '../models/restaurant.model';
import { AdminService } from './admin.service';

@Component({
  selector: 'app-admin-restaurants',
  standalone: true,
  imports: [CommonModule, SidebarComponent],
  templateUrl: './admin-restaurants.component.html',
  styleUrl: './admin-restaurants.component.css',
})
export class AdminRestaurantsComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly authService = inject(AuthService);
  private readonly ownerService = inject(OwnerService);
  private readonly roleService = inject(RoleService);
  private readonly router = inject(Router);

  readonly restaurants = signal<Restaurant[]>([]);
  readonly dishes = signal<Dish[]>([]);
  readonly selectedRestaurantId = signal('');
  readonly isLoading = signal(true);
  readonly isLoadingDishes = signal(false);
  readonly actionRestaurantId = signal('');
  readonly errorMessage = signal('');
  readonly dishErrorMessage = signal('');
  readonly successMessage = signal('');
  readonly navigatingRole = signal<AppRole | null>(null);
  readonly navigationItems: NavigationItem[] = [
    { label: 'Admin', route: '/admin/restaurants', icon: 'admin_panel_settings' },
  ];

  readonly pendingCount = computed(
    () => this.restaurants().filter((restaurant) => restaurant.verificationStatus === 'pending').length,
  );
  readonly verifiedCount = computed(
    () => this.restaurants().filter((restaurant) => restaurant.verificationStatus === 'verified').length,
  );
  readonly selectedRestaurant = computed(
    () =>
      this.restaurants().find((restaurant) => this.getRestaurantKey(restaurant) === this.selectedRestaurantId()) ??
      null,
  );
  readonly selectedRestaurantDetails = computed(() => {
    const restaurant = this.selectedRestaurant();

    if (!restaurant) {
      return [];
    }

    return [
      { label: 'Nombre', value: restaurant.name || 'Sin nombre' },
      { label: 'Direccion', value: restaurant.address || 'Sin direccion' },
      { label: 'Ciudad', value: restaurant.city || 'Sin ciudad' },
      { label: 'Telefono', value: restaurant.phone || 'Sin telefono' },
      { label: 'Horario', value: restaurant.schedule || 'Sin horario' },
      { label: 'RUT', value: restaurant.rutFileName || restaurant.rut || 'Archivo cargado' },
      { label: 'Correo propietario', value: restaurant.ownerEmail || 'Sin correo' },
      { label: 'UID propietario', value: restaurant.ownerUid },
    ];
  });

  ngOnInit(): void {
    void this.loadRestaurants();
  }

  async loadRestaurants(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      this.restaurants.set(await this.adminService.getRestaurants());
      const currentSelection = this.selectedRestaurantId();
      const hasCurrentSelection = this.restaurants().some(
        (restaurant) => this.getRestaurantKey(restaurant) === currentSelection,
      );

      if (!hasCurrentSelection) {
        this.selectedRestaurantId.set(
          this.restaurants()[0] ? this.getRestaurantKey(this.restaurants()[0]) : '',
        );
      }

      await this.loadSelectedRestaurantDishes();
    } catch (error) {
      this.errorMessage.set(this.adminService.getErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  async selectRestaurant(restaurant: Restaurant): Promise<void> {
    this.selectedRestaurantId.set(this.getRestaurantKey(restaurant));
    await this.loadSelectedRestaurantDishes();
  }

  async loadSelectedRestaurantDishes(): Promise<void> {
    const restaurant = this.selectedRestaurant();

    if (!restaurant) {
      this.dishes.set([]);
      return;
    }

    this.isLoadingDishes.set(true);
    this.dishErrorMessage.set('');

    try {
      this.dishes.set(await this.adminService.getRestaurantDishes(restaurant));
    } catch (error) {
      this.dishes.set([]);
      this.dishErrorMessage.set(this.adminService.getErrorMessage(error));
    } finally {
      this.isLoadingDishes.set(false);
    }
  }

  async verifyRestaurant(restaurant: Restaurant): Promise<void> {
    this.actionRestaurantId.set(restaurant.id);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      await this.adminService.verifyRestaurant(restaurant);
      await this.loadRestaurants();
      this.selectedRestaurantId.set(this.getRestaurantKey(restaurant));
      this.successMessage.set(`${restaurant.name} fue verificado.`);
    } catch (error) {
      this.errorMessage.set(this.adminService.getErrorMessage(error));
    } finally {
      this.actionRestaurantId.set('');
    }
  }

  async deleteRestaurant(restaurant: Restaurant): Promise<void> {
    const confirmed = window.confirm(`Eliminar ${restaurant.name}? Esta accion no se puede deshacer.`);

    if (!confirmed) {
      return;
    }

    this.actionRestaurantId.set(restaurant.id);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      await this.adminService.deleteRestaurant(restaurant);
      await this.loadRestaurants();
      this.successMessage.set(`${restaurant.name} fue eliminado.`);
    } catch (error) {
      this.errorMessage.set(this.adminService.getErrorMessage(error));
    } finally {
      this.actionRestaurantId.set('');
    }
  }

  async enterAsUser(): Promise<void> {
    await this.enterWithRole('user');
  }

  async enterAsOwner(): Promise<void> {
    await this.enterWithRole('owner');
  }

  async logout(): Promise<void> {
    await this.authService.logout();
    await this.router.navigateByUrl('/login');
  }

  trackRestaurant(restaurant: Restaurant): string {
    return this.getRestaurantKey(restaurant);
  }

  getRestaurantKey(restaurant: Restaurant): string {
    return `${restaurant.ownerUid}:${restaurant.id}`;
  }

  private async enterWithRole(role: AppRole): Promise<void> {
    this.navigatingRole.set(role);
    this.errorMessage.set('');

    try {
      await this.authService.setSelectedRole(role);
      this.roleService.setRole(role);

      if (role === 'owner') {
        const hasRestaurants = await this.ownerService.hasRestaurants();
        await this.router.navigateByUrl(hasRestaurants ? '/restaurants' : '/owner/setup');
        return;
      }

      await this.router.navigateByUrl('/user');
    } catch (error) {
      this.errorMessage.set(
        role === 'owner'
          ? this.ownerService.getErrorMessage(error)
          : this.authService.getErrorMessage(error),
      );
    } finally {
      this.navigatingRole.set(null);
    }
  }
}
