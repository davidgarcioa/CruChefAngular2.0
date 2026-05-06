import { Routes } from '@angular/router';

import { authGuard } from './auth/auth.guard';
import { LoginComponent } from './auth/login/login.component';
import { OwnerSetupComponent } from './auth/owner-setup/owner-setup.component';
import { RegisterComponent } from './auth/register/register.component';
import { roleGuard } from './auth/role.guard';
import { RoleSelectorComponent } from './auth/role-selector/role-selector.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { PublicRestaurantMenuComponent } from './public-restaurant-menu/public-restaurant-menu.component';
import { UserMenuComponent } from './user-menu/user-menu.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'public/menu/:ownerUid/:restaurantId', component: PublicRestaurantMenuComponent },
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
    path: 'history',
    component: DashboardComponent,
    canActivate: [authGuard, roleGuard],
    data: { view: 'history', role: 'owner' },
  },
  {
    path: 'ai',
    component: DashboardComponent,
    canActivate: [authGuard, roleGuard],
    data: { view: 'ai', role: 'owner' },
  },
  { path: '**', redirectTo: 'login' },
];
