/**
 * Configuración de la app.
 *
 * auth: 'keycloak' → inicio de sesión real por redirección a Keycloak (requiere Keycloak en Docker).
 *       'mock'     → login simulado con los usuarios de prueba (no necesita backend ni Keycloak).
 *
 * Los datos de keycloak deben coincidir con el realm y el client creados en Keycloak.
 */
export const environment = {
  auth: 'keycloak' as 'keycloak' | 'mock',
  keycloak: {
    url: 'http://localhost:8080',
    realm: 'system-plus',
    clientId: 'system-plus-front',
  },
};
