export type Role =
  | 'ADMINISTRADOR'
  | 'COORDINADOR'
  | 'DOCENTE'
  | 'DOCENTE_AUTORIZADO';

export const ROLE_LABELS: Record<Role, string> = {
  ADMINISTRADOR: 'Administrador',
  COORDINADOR: 'Coordinador Académico',
  DOCENTE: 'Docente',
  DOCENTE_AUTORIZADO: 'Docente Autorizado',
};

export interface User {
  id: number;
  nombre: string;
  correo: string;
  rol: Role;
  activo: boolean;
  ultimoAcceso?: string;
}

export interface LoginRequest {
  correo: string;
  contrasena: string;
}

export interface LoginResponse {
  token: string;
  usuario: User;
}