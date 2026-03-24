import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { RoleService, AppRole } from '../role.service';
import { AuthShellComponent } from '../auth-shell/auth-shell.component';

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

  readonly isNavigating = signal(false);

  async chooseRole(role: AppRole): Promise<void> {
    this.isNavigating.set(true);
    this.roleService.setRole(role);
    await this.router.navigateByUrl(this.roleService.getHomeRoute(role));
  }
}
