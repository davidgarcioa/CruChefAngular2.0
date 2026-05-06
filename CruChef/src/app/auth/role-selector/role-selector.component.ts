import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { OwnerService } from '../../dashboard/owner.service';
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
export class RoleSelectorComponent {
  private readonly router = inject(Router);
  private readonly roleService = inject(RoleService);
  private readonly authService = inject(AuthService);
  private readonly ownerService = inject(OwnerService);

  readonly isNavigating = signal(false);
  readonly errorMessage = signal('');

  async chooseRole(role: AppRole): Promise<void> {
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
