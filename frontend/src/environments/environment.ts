/**
 * Configuración de la app.
 *
 * auth: 'api'      -> formulario propio con validación real contra Keycloak a través de la API.
 *       'keycloak' -> inicio de sesión real por redirección a Keycloak (requiere Keycloak en Docker).
 *       'mock'     -> login simulado con los usuarios de prueba (no necesita backend ni Keycloak).
 *
 * api:  'http'     -> la pantalla de usuarios (HE-01) usa el backend real en apiUrl.
 *       'mock'     -> usa los usuarios simulados en memoria (no necesita backend).
 *
 * apiAcademico: 'http' -> programa académico y guías base usan el backend real.
 *               'mock' -> módulos y competencias simulados en memoria.
 *
 * Los datos de keycloak deben coincidir con el realm y el client creados en Keycloak.
 */
export const environment = {
  auth: 'api' as 'api' | 'keycloak' | 'mock',
  api: 'http' as 'http' | 'mock',
  apiAcademico: 'http' as 'http' | 'mock',
  apiUrl: 'http://localhost:3000',
  keycloak: {
    url: 'http://localhost:8080',
    realm: 'system-plus',
    clientId: 'system-plus-front',
  },
};
