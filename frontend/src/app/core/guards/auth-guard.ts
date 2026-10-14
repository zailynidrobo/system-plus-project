import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { Auth } from '../auth/auth';

// Se usa también como canActivateChild: en cada navegación relee al usuario, así un cambio
// de rol se aplica sin volver a iniciar sesión y un usuario desactivado pierde el acceso.
export const authGuard: CanActivateFn & CanActivateChildFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return router.createUrlTree(['/login']);

  return auth.refrescar().pipe(map((u) => (u ? true : router.createUrlTree(['/login']))));
};
