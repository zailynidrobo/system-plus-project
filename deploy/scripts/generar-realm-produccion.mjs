// Genera keycloak/system-plus-realm.produccion.json a partir del realm de desarrollo.
// Uso (desde la raíz del repositorio): node deploy/scripts/generar-realm-produccion.mjs
//
// El realm de la sala no trae los usuarios de prueba ni el secreto de desarrollo. Keycloak reemplaza
// al importar cada ${VARIABLE} por su valor en el archivo .env del servidor:
//   KEYCLOAK_API_SECRET           secreto del client system-plus-api (lo genera instalar-servidor)
//   ADMIN_CORREO, ADMIN_NOMBRE, ADMIN_APELLIDO   primer administrador del sistema
//   ADMIN_CLAVE_TEMPORAL          su contraseña inicial; el sistema le pide cambiarla al entrar
import { readFileSync, writeFileSync } from 'node:fs';

const ORIGEN = 'keycloak/system-plus-realm.json';
const DESTINO = 'keycloak/system-plus-realm.produccion.json';

const realm = JSON.parse(readFileSync(ORIGEN, 'utf8'));

// Acordada con el cliente: mínimo 8, con mayúscula, minúscula y número.
realm.passwordPolicy = 'length(8) and upperCase(1) and lowerCase(1) and digits(1) and notUsername and notEmail';

for (const client of realm.clients) {
  if (client.clientId === 'system-plus-api') client.secret = '${KEYCLOAK_API_SECRET}';
}

realm.users = [
  // La cuenta de servicio con la que la API administra los usuarios.
  ...realm.users.filter((u) => u.serviceAccountClientId),
  {
    username: '${ADMIN_CORREO}',
    email: '${ADMIN_CORREO}',
    emailVerified: true,
    enabled: true,
    firstName: '${ADMIN_NOMBRE}',
    lastName: '${ADMIN_APELLIDO}',
    credentials: [{ type: 'password', value: '${ADMIN_CLAVE_TEMPORAL}', temporary: true }],
    // Al importar, Keycloak no aplica "temporary": es esta acción la que obliga a cambiarla.
    requiredActions: ['UPDATE_PASSWORD'],
    realmRoles: ['admin'],
  },
];

writeFileSync(DESTINO, JSON.stringify(realm, null, 2) + '\n');
console.log(`Listo: ${DESTINO}`);
