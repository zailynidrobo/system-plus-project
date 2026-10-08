export enum Role {
  ADMIN = 'admin',
  COORDINADOR = 'coordinador',
  DOCENTE = 'docente',
  DOCENTE_AUTORIZADO = 'docente_autorizado',
}

export class User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  isActive: boolean;
}