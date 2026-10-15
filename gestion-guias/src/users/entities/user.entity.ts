import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

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
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  keycloakUserId: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 254 })
  email: string;
  /** null si la cuenta existe en Keycloak pero no tiene ningún rol de la app. */
  role: Role | null;
  isActive: boolean;
  createdAt?: string;
}

