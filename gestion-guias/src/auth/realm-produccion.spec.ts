import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * El realm de la sala se genera desde el de desarrollo (deploy/scripts/generar-realm-produccion.mjs).
 * Si alguien cambia roles o clients en uno y olvida regenerar el otro, esta prueba lo avisa.
 */
const leer = (archivo: string) =>
  JSON.parse(
    readFileSync(
      new URL(`../../../keycloak/${archivo}`, import.meta.url),
      'utf8',
    ),
  ) as Record<string, unknown> & {
    clients: { clientId: string; secret?: string }[];
    users: {
      username: string;
      serviceAccountClientId?: string;
      credentials?: unknown[];
    }[];
  };

describe('Realm de la instalación en la sala', () => {
  const desarrollo = leer('system-plus-realm.json');
  const produccion = leer('system-plus-realm.produccion.json');

  it('no trae usuarios de prueba ni contraseñas conocidas', () => {
    const personas = produccion.users.filter((u) => !u.serviceAccountClientId);
    expect(personas.map((u) => u.username)).toEqual(['${ADMIN_CORREO}']);
    expect(JSON.stringify(produccion)).not.toContain('12345678');
    expect(JSON.stringify(produccion)).not.toContain('@example.com');
  });

  it('toma el secreto de la API del .env del servidor', () => {
    const api = produccion.clients.find(
      (c) => c.clientId === 'system-plus-api',
    );
    expect(api?.secret).toBe('${KEYCLOAK_API_SECRET}');
  });

  it('tiene los mismos roles, clients y reglas que el realm de desarrollo', () => {
    const sinSecretos = (realm: typeof desarrollo) => ({
      ...realm,
      users: undefined,
      passwordPolicy: undefined,
      clients: realm.clients.map((c) => ({ ...c, secret: undefined })),
    });
    expect(sinSecretos(produccion)).toEqual(sinSecretos(desarrollo));
  });
});
