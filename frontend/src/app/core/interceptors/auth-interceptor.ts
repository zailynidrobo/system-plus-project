import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Auth } from '../auth/auth';

/** Rutas de la API que abren, renuevan o cierran la sesión: no llevan token. */
const RUTAS_DE_SESION = `${environment.apiUrl}/auth/`;

/**
 * Agrega el token a cada petición, renovándolo antes si está por vencer. Si la sesión ya no se
 * puede renovar, o la API responde 401, borra la sesión y lleva al login con un aviso.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.startsWith(RUTAS_DE_SESION)) return next(req);

  const auth = inject(Auth);
  const router = inject(Router);
  const habiaSesion = auth.isLoggedIn();

  const sesionTerminada = () => {
    auth.logout();
    void router.navigate(['/login'], { queryParams: { motivo: 'sesion-vencida' } });
  };

  return auth.tokenVigente().pipe(
    switchMap((token) => {
      if (!token) {
        if (habiaSesion) sesionTerminada();
        return next(req);
      }
      return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })).pipe(
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 401 && auth.isLoggedIn()) {
            sesionTerminada();
          }
          return throwError(() => error);
        }),
      );
    }),
  );
};
