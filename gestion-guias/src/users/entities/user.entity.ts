export enum Role {
  ADMIN = 'admin',
  COORDINADOR = 'coordinador',
  DOCENTE = 'docente',
  DOCENTE_AUTORIZADO = 'docente_autorizado',
}

/**
 * Usuario tal como lo expone la API. Los datos viven en Keycloak (los roles son roles de
 * realm con los mismos nombres de `Role`); la API no guarda usuarios ni contraseñas.
 */
export class User {
  id: string;
  name: string;
  email: string;
  /** null si la cuenta existe en Keycloak pero no tiene ningún rol de la app. */
  role: Role | null;
  isActive: boolean;
  createdAt?: string;
}
