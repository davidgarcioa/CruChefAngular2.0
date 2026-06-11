import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';
import { AppRole, RoleService } from './role.service';

export const roleGuard: CanActivateFn = async (route) => {
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const router = inject(Router);
  const authService = inject(AuthService);
  const roleService = inject(RoleService);
  const expectedRole = route.data['role'] as AppRole | undefined;
  let allowedRoles = roleService.getAllowedRoles();

  try {
    allowedRoles = await authService.getAllowedRoles();
    roleService.setAllowedRoles(allowedRoles);
  } catch {
    return router.createUrlTree(['/login']);
  }

  if (expectedRole && !allowedRoles.includes(expectedRole)) {
    return router.createUrlTree([roleService.getAllowedHomeRoute()]);
  }

  const currentRole = roleService.getRole();

  if (!currentRole) {
    if (allowedRoles.length === 1) {
      roleService.setRole(allowedRoles[0]);
      return expectedRole === allowedRoles[0]
        ? true
        : router.createUrlTree([roleService.getHomeRoute(allowedRoles[0])]);
    }

    return router.createUrlTree(['/select-role']);
  }

  if (!allowedRoles.includes(currentRole)) {
    roleService.clearRole();
    roleService.setAllowedRoles(allowedRoles);
    return router.createUrlTree([roleService.getAllowedHomeRoute()]);
  }

  if (expectedRole && currentRole !== expectedRole) {
    return router.createUrlTree([roleService.getHomeRoute(currentRole)]);
  }

  return true;
};
