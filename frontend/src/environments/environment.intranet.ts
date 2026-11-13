/**
 * Configuración para la instalación en la intranet (Docker). Reemplaza a environment.ts
 * al compilar con `ng build --configuration intranet`.
 *
 * El navegador habla solo con Nginx: las pantallas se sirven en "/" y Nginx pasa "/api" a la API.
 * Así funciona con cualquier IP o nombre del servidor sin volver a compilar.
 * El inicio de sesión va por la API ('api'), de modo que Keycloak no necesita quedar expuesto.
 */
export const environment = {
  auth: 'api' as 'api' | 'keycloak' | 'mock',
  api: 'http' as 'http' | 'mock',
  apiAcademico: 'http' as 'http' | 'mock',
  apiUrl: '/api',
  keycloak: {
    url: '/auth',
    realm: 'system-plus',
    clientId: 'system-plus-front',
  },
};
