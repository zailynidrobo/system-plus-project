/**
 * La API maneja un solo campo `name`; Keycloak guarda nombre y apellido por separado.
 * La primera palabra es el nombre y el resto el apellido.
 */
export function splitName(name: string): { firstName: string; lastName?: string } {
  const [firstName, ...rest] = name.trim().split(/\s+/);
  const lastName = rest.join(' ');
  return lastName ? { firstName, lastName } : { firstName };
}

export function joinName(user: {
  firstName?: string;
  lastName?: string;
  username: string;
}): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username;
}
