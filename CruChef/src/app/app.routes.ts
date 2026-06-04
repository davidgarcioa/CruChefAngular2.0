import { Routes } from '@angular/router';

import { authGuard } from './auth/auth.guard';
import { AdminRestaurantsComponent } from './admin/admin-restaurants.component';
import { adminGuard } from './admin/admin.guard';
import { LoginComponent } from './auth/login/login.component';
import { OwnerSetupComponent } from './auth/owner-setup/owner-setup.component';
import { RegisterComponent } from './auth/register/register.component';
import { roleGuard } from './auth/role.guard';
import { RoleSelectorComponent } from './auth/role-selector/role-selector.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { UserMenuComponent } from './user-menu/user-menu.component';
import { PublicRestaurantMenuComponent } from './user-menu/public-restaurant-menu.component';
import { SettingsComponent } from './settings/settings.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'admin', pathMatch: 'full', redirectTo: 'admin/restaurants' },
  {
    path: 'admin/restaurants',
    component: AdminRestaurantsComponent,
    canActivate: [authGuard, adminGuard],
  },
  { path: 'select-role', component: RoleSelectorComponent, canActivate: [authGuard] },
  {
    path: 'owner/setup',
    component: OwnerSetupComponent,
    canActivate: [authGuard, roleGuard],
    data: { role: 'owner' },
  },
  {
    path: 'user',
    component: UserMenuComponent,
    canActivate: [authGuard, roleGuard],
    data: { role: 'user', view: 'menu' },
  },
  {
    path: 'user/orders',
    component: UserMenuComponent,
    canActivate: [authGuard, roleGuard],
    data: { role: 'user', view: 'orders' },
  },
  {
    path: 'user/history',
    component: UserMenuComponent,
    canActivate: [authGuard, roleGuard],
    data: { role: 'user', view: 'history' },
  },
  {
    path: 'user/settings',
    component: SettingsComponent,
    canActivate: [authGuard, roleGuard],
    data: { role: 'user' },
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard, roleGuard],
    data: { view: 'dashboard', role: 'owner' },
  },
  {
    path: 'orders',
    component: DashboardComponent,
    canActivate: [authGuard, roleGuard],
    data: { view: 'orders', role: 'owner' },
  },
  {
    path: 'restaurants',
    component: DashboardComponent,
    canActivate: [authGuard, roleGuard],
    data: { view: 'restaurants', role: 'owner' },
  },
  {
    path: 'dishes',
    component: DashboardComponent,
    canActivate: [authGuard, roleGuard],
    data: { view: 'dishes', role: 'owner' },
  },
  {
    path: 'history',
    component: DashboardComponent,
    canActivate: [authGuard, roleGuard],
    data: { view: 'history', role: 'owner' },
  },
  {
    path: 'inventory',
    component: DashboardComponent,
    canActivate: [authGuard, roleGuard],
    data: { view: 'inventory', role: 'owner' },
  },
  {
    path: 'ai',
    component: DashboardComponent,
    canActivate: [authGuard, roleGuard],
    data: { view: 'ai', role: 'owner' },
  },
  {
    path: 'owner/settings',
    component: SettingsComponent,
    canActivate: [authGuard, roleGuard],
    data: { role: 'owner' },
  },
  {
    path: 'public/menu/:ownerUid/:restaurantId',
    component: PublicRestaurantMenuComponent,
  },
  { path: '**', redirectTo: 'login' },
];
