import { inject } from '@angular/core';
import { CanActivateFn, RedirectFunction, Router } from '@angular/router';
import { Auth } from '../auth/auth';
import { homeForRole } from '../auth/role-home';

/** /login solo para quien no tiene sesión; quien ya la tiene va a su inicio. */
export const guestGuard: CanActivateFn = () => {
  const user = inject(Auth).user();
  return user ? inject(Router).createUrlTree([homeForRole(user.rol)]) : true;
};

/** Ruta vacía → inicio según el rol. */
export const redirectToHome: RedirectFunction = () => {
  const user = inject(Auth).user();
  return user ? homeForRole(user.rol) : '/login';
};
