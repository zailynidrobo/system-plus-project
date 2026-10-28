/**
 * Nombre completo: al menos dos palabras (nombre y apellido). Keycloak exige el apellido y, sin él,
 * la cuenta no puede iniciar sesión.
 */
export const FULL_NAME_PATTERN = /^\s*\S+(\s+\S+)+\s*$/;
export const FULL_NAME_MESSAGE = 'El nombre debe incluir nombre y apellido';

/**
 * La API maneja un solo campo `name`; Keycloak guarda nombre y apellido por separado.
 * La primera palabra es el nombre y el resto el apellido.
 */
export function splitName(name: string): {
  firstName: string;
  lastName?: string;
} {
  const [firstName, ...rest] = name.trim().split(/\s+/);
  const lastName = rest.join(' ');
  return lastName ? { firstName, lastName } : { firstName };
}

export function joinName(user: {
  firstName?: string;
  lastName?: string;
  username: string;
}): string {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username
  );
}
