import { InjectionToken, Provider, inject } from '@angular/core';
import { AuthProvider } from './auth-provider';
import { MockAuthProvider } from './providers/mock-auth-provider';

/** Implementación de autenticación que usa la app. */
export const AUTH_PROVIDER = new InjectionToken<AuthProvider>('AUTH_PROVIDER', {
  providedIn: 'root',
  factory: () => inject(MockAuthProvider),
});

/**
 * Único punto que decide cómo se autentica la app.
 * Para Keycloak: { provide: AUTH_PROVIDER, useExisting: KeycloakAuthProvider }.
 */
export function provideAuth(): Provider[] {
  return [{ provide: AUTH_PROVIDER, useExisting: MockAuthProvider }];
}
