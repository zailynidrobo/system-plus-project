import { SuggestionStatus } from '../../shared/models/suggestion';

/** Pill e ícono por estado, como en Figma: Pendiente dorado, Aprobada verde, Rechazada rojo. */
export const PILL_ESTADO: Record<SuggestionStatus, string> = {
  Pendiente: 'ui-pill--gold',
  Aprobada: 'ui-pill--ok',
  Rechazada: 'ui-pill--off',
};

export const ICONO_ESTADO: Record<SuggestionStatus, string> = {
  Pendiente: 'clock',
  Aprobada: 'circle-check',
  Rechazada: 'circle-x',
};

/** "Julián Andrés Ospina" → "JO" */
export function iniciales(nombre: string): string {
  const p = nombre.split(' ').filter(Boolean);
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

/** "Julián Andrés Ospina" → "Julián Ospina" */
export function nombreCorto(nombre: string): string {
  const p = nombre.split(' ').filter(Boolean);
  return p.length > 1 ? `${p[0]} ${p[p.length - 1]}` : nombre;
}
