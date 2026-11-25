/** Reportes de coordinación (HE-11-HU-02). Misma forma que GET /reports/* del backend. */

export interface GuiasPorModulo {
  moduleCode: string;
  moduleName: string;
  moduleStatus: 'Borrador' | 'Activo' | 'Inactivo';
  total: number;
  published: number;
  drafts: number;
  lastUpdate: string | null;
}

export interface ReporteGuias {
  generatedAt: string;
  totals: { modules: number; guides: number; published: number; drafts: number };
  rows: GuiasPorModulo[];
}

export interface SugerenciasPorModulo {
  moduleCode: string;
  moduleName: string;
  received: number;
  pending: number;
  approved: number;
  rejected: number;
  averageResponseDays: number | null;
  lateDecisions: number;
}

export interface SugerenciaPendiente {
  code: string;
  moduleName: string;
  guideTitle: string;
  field: string;
  teacher: string;
  sentAt: string;
  dueAt: string;
  businessDaysWaiting: number;
  deadline: 'A tiempo' | 'Por vencer' | 'Vencida';
}

export interface ReporteSugerencias {
  generatedAt: string;
  period: { from: string | null; to: string | null };
  totals: {
    received: number;
    pending: number;
    approved: number;
    rejected: number;
    overdue: number;
    averageResponseDays: number | null;
    onTimeRate: number | null;
  };
  byModule: SugerenciasPorModulo[];
  pending: SugerenciaPendiente[];
}

export interface PeriodoReporte {
  desde: string | null;
  hasta: string | null;
}

export type TipoReporte = 'guides' | 'suggestions';
export type FormatoReporte = 'xlsx' | 'pdf';
