export type Role =
  | 'ADMINISTRADOR'
  | 'COORDINADOR'
  | 'DOCENTE'
  | 'DOCENTE_AUTORIZADO';

export interface User {
  id: number;
  nombre: string;
  correo: string;
  rol: Role;
  activo: boolean;
}

export interface LoginRequest {
  correo: string;
  contrasena: string;
}

export interface LoginResponse {
  token: string;
  usuario: User;
}