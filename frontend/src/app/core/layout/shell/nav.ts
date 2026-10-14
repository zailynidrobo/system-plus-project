import { Role } from '../../../shared/models/user';

export interface NavItem {
  label: string;
  icon: string;
  /** null = sin HU todavía: se muestra deshabilitado ("Próximamente"). */
  route: string | null;
  /** Contador al lado del texto (sugerencias pendientes del coordinador). */
  badge?: 'sugerencias';
}

export type RecuadroLateral = 'entorno' | 'programa' | 'modulos';

export interface NavConfig {
  seccion: string;
  items: NavItem[];
  recuadro: RecuadroLateral;
}

// Textos, íconos y orden según Figma: PanelDeAdministrador (HE-01),
// PanelCoordinador (HE-02, 204:4077), Guías asignadas (HE-04, 4002:26) y Sugerencias (HE-05, 5003:514).
const ADMINISTRADOR: NavConfig = {
  seccion: 'Administración',
  recuadro: 'entorno',
  items: [
    { label: 'Inicio', icon: 'dashboard', route: null },
    { label: 'Usuarios', icon: 'users', route: '/usuarios' },
    { label: 'Roles y permisos', icon: 'shield-check', route: '/roles' },
    { label: 'Auditoría', icon: 'scroll', route: null },
  ],
};

const COORDINADOR: NavConfig = {
  seccion: 'Gestión académica',
  recuadro: 'programa',
  items: [
    { label: 'Inicio', icon: 'dashboard', route: null },
    { label: 'Programa académico', icon: 'book-open', route: '/modulos' },
    { label: 'Guías de aprendizaje', icon: 'notebook-tabs', route: '/guias' },
    { label: 'Sugerencias', icon: 'message-square', route: '/sugerencias', badge: 'sugerencias' },
    { label: 'Reportes', icon: 'chart-no-axes-column', route: null },
  ],
};

const DOCENTE: NavConfig = {
  seccion: 'Mi espacio docente',
  recuadro: 'modulos',
  items: [
    { label: 'Inicio', icon: 'dashboard', route: null },
    { label: 'Guías base', icon: 'book-open', route: '/mis-modulos' },
    { label: 'Mis versiones', icon: 'folder', route: '/mis-versiones' },
    { label: 'Mis sugerencias', icon: 'message-square', route: '/mis-sugerencias' },
  ],
};

const NAV_POR_ROL: Record<Role, NavConfig> = {
  ADMINISTRADOR,
  COORDINADOR,
  DOCENTE,
  DOCENTE_AUTORIZADO: DOCENTE,
};

export function navPara(rol: Role): NavConfig {
  return NAV_POR_ROL[rol];
}
