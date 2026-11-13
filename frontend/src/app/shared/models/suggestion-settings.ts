/** HE-09-HU-01 · Tiempo límite de respuesta a sugerencias (días hábiles). */
export interface SuggestionSettings {
  dueBusinessDays: number;
  dueSoonBusinessDays: number;
  /** 'admin': lo configuró el administrador. 'env': rigen los valores de instalación. */
  source: 'admin' | 'env';
  updatedAt: string | null;
  updatedByName: string | null;
}

export type SuggestionSettingsChange = Pick<SuggestionSettings, 'dueBusinessDays' | 'dueSoonBusinessDays'>;

export const PLAZO_MAXIMO_DIAS = 60;
