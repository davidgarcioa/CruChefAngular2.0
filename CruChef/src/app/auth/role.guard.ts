import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AppRole, RoleService } from './role.service';

export const roleGuard: CanActivateFn = (route) => {
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const router = inject(Router);
  const roleService = inject(RoleService);
  const expectedRole = route.data['role'] as AppRole | undefined;
  const currentRole = roleService.getRole();

  if (!currentRole) {
    return router.createUrlTree(['/select-role']);
  }

  if (expectedRole && currentRole !== expectedRole) {
    return router.createUrlTree([roleService.getHomeRoute(currentRole)]);
  }

  return true;
};
