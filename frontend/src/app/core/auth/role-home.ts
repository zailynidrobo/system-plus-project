import { Role } from '../../shared/models/user';

/** Pantalla de inicio de cada rol, después del login y en la ruta vacía. */
const INICIO_POR_ROL: Record<Role, string> = {
  ADMINISTRADOR: '/inicio',
  COORDINADOR: '/inicio',
  DOCENTE: '/inicio',
  DOCENTE_AUTORIZADO: '/inicio',
};

export function homeForRole(rol: Role): string {
  return INICIO_POR_ROL[rol];
}
