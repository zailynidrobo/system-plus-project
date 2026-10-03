import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../auth/auth';
import { Role } from '../../shared/models/user';

export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(Auth);
  const router = inject(Router);
  const roles = (route.data['roles'] ?? []) as Role[];

  if (!auth.isLoggedIn()) return router.createUrlTree(['/login']);
  // Pendiente: página de "sin accseo
  return auth.hasRole(roles) ? true : router.createUrlTree(['/login']);
};