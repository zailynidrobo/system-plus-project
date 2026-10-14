import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum Role {
  ADMIN = 'admin',
  COORDINADOR = 'coordinador',
  DOCENTE = 'docente',
  DOCENTE_AUTORIZADO = 'docente_autorizado',
}

@Entity('application_users')
@Index('UQ_application_users_email', ['email'], { unique: true })
@Index('UQ_application_users_keycloak_id', ['keycloakUserId'], {
  unique: true,
})
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  keycloakUserId: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 254 })
  email: string;

  @Column({ type: 'varchar', length: 100 })
  password: string;

  @Column({ type: 'enum', enum: Role, default: Role.DOCENTE })
  role: Role;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
  createdAt?: string;
}
