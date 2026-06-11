import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { OwnerService } from '../../dashboard/owner.service';
import { isAdminEmail } from '../../admin/admin.config';
import { AuthShellComponent } from '../auth-shell/auth-shell.component';
import { AuthService } from '../auth.service';
import { AppRole, RoleService } from '../role.service';

@Component({
  selector: 'app-role-selector',
  standalone: true,
  imports: [CommonModule, AuthShellComponent],
  templateUrl: './role-selector.component.html',
  styleUrl: './role-selector.component.css',
})
export class RoleSelectorComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly roleService = inject(RoleService);
  private readonly authService = inject(AuthService);
  private readonly ownerService = inject(OwnerService);

  readonly isNavigating = signal(false);
  readonly isLoadingRoles = signal(true);
  readonly allowedRoles = signal<AppRole[]>([]);
  readonly errorMessage = signal('');

  ngOnInit(): void {
    void this.initializeRoles();
  }

  private async initializeRoles(): Promise<void> {
    const user = await this.authService.getVerifiedUser();

    if (isAdminEmail(user?.email)) {
      await this.router.navigateByUrl('/admin/restaurants');
      return;
    }

    try {
      const roles = await this.authService.getAllowedRoles();
      this.allowedRoles.set(roles);
      this.roleService.setAllowedRoles(roles);

      if (roles.length === 1) {
        await this.chooseRole(roles[0]);
      }
    } catch (error) {
      this.errorMessage.set(this.authService.getErrorMessage(error));
    } finally {
      this.isLoadingRoles.set(false);
    }
  }

  canChoose(role: AppRole): boolean {
    return this.allowedRoles().includes(role);
  }

  async chooseRole(role: AppRole): Promise<void> {
    if (!this.canChoose(role)) {
      this.errorMessage.set('Tu cuenta no tiene habilitado ese tipo de acceso.');
      return;
    }

    this.errorMessage.set('');
    this.isNavigating.set(true);

    try {
      await this.authService.setSelectedRole(role);
      this.roleService.setRole(role);

      if (role === 'owner') {
        const hasRestaurants = await this.ownerService.hasRestaurants();
        await this.router.navigateByUrl(hasRestaurants ? '/restaurants' : '/owner/setup');
      } else {
        await this.router.navigateByUrl(this.roleService.getHomeRoute(role));
      }
    } catch (error) {
      this.errorMessage.set(
        role === 'owner'
          ? this.ownerService.getErrorMessage(error)
          : this.authService.getErrorMessage(error),
      );
    } finally {
      this.isNavigating.set(false);
    }
  }
}
