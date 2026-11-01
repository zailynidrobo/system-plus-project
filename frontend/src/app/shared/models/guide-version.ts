import { GuideContent, GuideField } from './guide-field';

// vigente es la que ven los docentes
export type EstadoVersion = 'Vigente' | 'Anterior' | 'Borrador';

export interface GuideVersionItem {
  version: string;
  estado: EstadoVersion;
  descripcion: string;
  autor: string;
  fecha: string;
  publicacion: boolean;
}

export interface ResumenVersiones {
  registradas: number;
  publicaciones: number;
  editores: number;
  ultimaModificacion: string;
}

export interface HistorialVersiones {
  // de la mas nueva a la mas vieja
  items: GuideVersionItem[];
  resumen: ResumenVersiones;
}

export interface GuideVersionDetail extends GuideVersionItem {
  fields: GuideField[];
  content: GuideContent;
  structureVersion: number;
  publicadaEl: string | null;
  publicadaPor: string | null;
}
