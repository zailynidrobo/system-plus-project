// Formatos de fecha que usa Figma: "14 feb 2026", "07 oct 2026 · 10:14 a. m."
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "07 oct 2026" */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

/** "10:14 a. m." */
export function hora(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const h = d.getHours();
  const sufijo = h < 12 ? 'a. m.' : 'p. m.';
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${sufijo}`;
}

/** "07 oct 2026 · 10:14 a. m." */
export function fechaHora(iso: string | null | undefined): string {
  return iso ? `${fechaCorta(iso)} · ${hora(iso)}` : '';
}

export function ahoraIso(): string {
  return new Date().toISOString();
}

/** "hace 5 s", "hace 3 min", "hoy, 10:12 a. m." o "12 jun 2026". */
export function haceCuanto(iso: string | null | undefined, ahora = Date.now()): string {
  if (!iso) return '';
  const segundos = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 1000));
  if (segundos < 60) return `hace ${segundos} s`;
  if (segundos < 3600) return `hace ${Math.floor(segundos / 60)} min`;
  if (new Date(iso).toDateString() === new Date(ahora).toDateString()) return `hoy, ${hora(iso)}`;
  return fechaCorta(iso);
}
