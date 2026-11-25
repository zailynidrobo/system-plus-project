/** Reportes para coordinación académica (HE-11-HU-02 · botón Reportes). */

export interface GuidesByModuleRow {
  moduleCode: string;
  moduleName: string;
  moduleStatus: 'Borrador' | 'Activo' | 'Inactivo';
  total: number;
  published: number;
  drafts: number;
  lastUpdate: string | null;
}

export interface GuidesReport {
  generatedAt: string;
  totals: {
    modules: number;
    guides: number;
    published: number;
    drafts: number;
  };
  rows: GuidesByModuleRow[];
}

export interface SuggestionsByModuleRow {
  moduleCode: string;
  moduleName: string;
  received: number;
  pending: number;
  approved: number;
  rejected: number;
  /** Promedio de días hábiles entre el envío y la decisión; null si no hay decididas. */
  averageResponseDays: number | null;
  /** Decididas después del plazo. */
  lateDecisions: number;
}

export interface PendingSuggestionRow {
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

export interface SuggestionsReport {
  generatedAt: string;
  period: { from: string | null; to: string | null };
  totals: {
    received: number;
    pending: number;
    approved: number;
    rejected: number;
    overdue: number;
    averageResponseDays: number | null;
    /** Porcentaje de decididas dentro del plazo; null si no hay decididas. */
    onTimeRate: number | null;
  };
  byModule: SuggestionsByModuleRow[];
  pending: PendingSuggestionRow[];
}
