import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../auth/auth.service';
import { isAdminEmail } from './admin.config';

export const adminGuard: CanActivateFn = async () => {
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const authService = inject(AuthService);
  const router = inject(Router);
  const user = await authService.getVerifiedUser();

  return isAdminEmail(user?.email) ? true : router.createUrlTree(['/select-role']);
};
