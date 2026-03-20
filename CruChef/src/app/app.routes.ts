import { Routes } from '@angular/router';

import { authGuard } from './auth/auth.guard';
import { LoginComponent } from './auth/login/login.component';
import { RegisterComponent } from './auth/register/register.component';
import { DashboardComponent } from './dashboard/dashboard.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard], data: { view: 'dashboard' } },
  { path: 'orders', component: DashboardComponent, canActivate: [authGuard], data: { view: 'orders' } },
  { path: 'restaurants', component: DashboardComponent, canActivate: [authGuard], data: { view: 'restaurants' } },
  { path: 'history', component: DashboardComponent, canActivate: [authGuard], data: { view: 'history' } },
  { path: '**', redirectTo: 'login' },
];
