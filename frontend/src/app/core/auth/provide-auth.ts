import { EnvironmentProviders, InjectionToken, Provider, inject, provideAppInitializer } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthProvider } from './auth-provider';
import { KeycloakAuthProvider } from './providers/keycloak-auth-provider';
import { MockAuthProvider } from './providers/mock-auth-provider';

/** Implementación de autenticación que usa la app (en las pruebas, el login simulado). */
export const AUTH_PROVIDER = new InjectionToken<AuthProvider>('AUTH_PROVIDER', {
  providedIn: 'root',
  factory: () => inject(MockAuthProvider),
});

/**
 * Único punto que decide cómo se autentica la app, según environment.auth:
 * 'keycloak' (login real por redirección) o 'mock' (usuarios de prueba).
 */
export function provideAuth(): (Provider | EnvironmentProviders)[] {
  if (environment.auth === 'keycloak') {
    return [
      { provide: AUTH_PROVIDER, useExisting: KeycloakAuthProvider },
      // La sesión se resuelve antes de que arranque el router, para que los guards ya la conozcan
      provideAppInitializer(() => inject(KeycloakAuthProvider).iniciar()),
    ];
  }
  return [{ provide: AUTH_PROVIDER, useExisting: MockAuthProvider }];
}
