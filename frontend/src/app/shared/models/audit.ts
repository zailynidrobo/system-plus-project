import { Role } from './user';

export type ResultadoAuditoria = 'success' | 'denied' | 'failed';

export const RESULTADOS: Record<ResultadoAuditoria, string> = {
  success: 'Exitosa',
  denied: 'Denegada',
  failed: 'Fallida',
};

export interface UsuarioAuditoria {
  id: string | null;
  name: string | null;
  email: string | null;
  role: Role | null;
  roleLabel: string | null;
}

export interface EventoAuditoria {
  id: string;
  occurredAt: string;
  user: UsuarioAuditoria;
  area: string;
  action: string;
  result: ResultadoAuditoria;
  statusCode: number;
  ip: string | null;
  entity: { type: string; id: string | null; label: string | null } | null;
  module: { id: string; name: string } | null;
}

export interface DetalleEventoAuditoria extends EventoAuditoria {
  method: string;
  route: string;
  path: string;
  userAgent: string | null;
  details: Record<string, unknown> | null;
}

export interface FiltroAuditoria {
  busqueda: string;
  userId: string | null;
  moduleId: string | null;
  area: string | null;
  resultado: ResultadoAuditoria | 'TODOS';
  /** AAAA-MM-DD en hora de Bogotá, vacío = sin límite. */
  desde: string;
  hasta: string;
  pagina: number;
  porPagina: number;
}

export interface PaginaAuditoria {
  items: EventoAuditoria[];
  total: number;
}

export interface OpcionesAuditoria {
  users: { id: string; name: string; email: string }[];
  modules: { id: string; name: string }[];
  areas: string[];
}

export interface PermisoDeRol {
  area: string;
  action: string;
  method: string;
  path: string;
}

export interface ResumenDeRol {
  role: Role;
  label: string;
  totalPermissions: number;
  areas: string[];
}

export interface DetalleDeRol {
  role: Role;
  label: string;
  totalPermissions: number;
  permissions: PermisoDeRol[];
}
