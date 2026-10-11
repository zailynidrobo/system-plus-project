import { Role } from '../../../shared/models/user';

export interface NavItem {
  label: string;
  icon: string;
  /** null = sin HU todavía: se muestra deshabilitado ("Próximamente"). */
  route: string | null;
}

export type RecuadroLateral = 'entorno' | 'programa' | 'modulos';

export interface NavConfig {
  seccion: string;
  items: NavItem[];
  recuadro: RecuadroLateral;
}

// Textos, íconos y orden según Figma: PanelDeAdministrador (HE-01),
// PanelCoordinador (HE-02, 204:4077) y Guías asignadas (HE-04, 4002:26).
const ADMINISTRADOR: NavConfig = {
  seccion: 'Administración',
  recuadro: 'entorno',
  items: [
    { label: 'Inicio', icon: 'dashboard', route: null },
    { label: 'Usuarios', icon: 'users', route: '/usuarios' },
    { label: 'Roles y permisos', icon: 'shield-check', route: null },
    { label: 'Auditoría', icon: 'scroll', route: null },
  ],
};

const COORDINADOR: NavConfig = {
  seccion: 'Gestión académica',
  recuadro: 'programa',
  items: [
    { label: 'Inicio', icon: 'dashboard', route: null },
    { label: 'Programa académico', icon: 'book-open', route: '/modulos' },
    { label: 'Guías de aprendizaje', icon: 'notebook-tabs', route: null },
    { label: 'Reportes', icon: 'chart-no-axes-column', route: null },
  ],
};

const DOCENTE: NavConfig = {
  seccion: 'Mi espacio docente',
  recuadro: 'modulos',
  items: [
    { label: 'Inicio', icon: 'dashboard', route: null },
    { label: 'Guías base', icon: 'book-open', route: '/mis-modulos' },
    { label: 'Mis versiones', icon: 'folder', route: null },
    { label: 'Mis sugerencias', icon: 'message-square', route: null },
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
