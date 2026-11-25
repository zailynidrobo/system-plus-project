import type { Hoja } from './reporte-xlsx.js';
import type { GuidesReport, SuggestionsReport } from './reports.types.js';

const fecha = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(iso))
    : '';
const fechaHora = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
const fechaIso = (iso: string | null) =>
  iso ? iso.split('-').reverse().join('/') : null;
const dias = (valor: number | null) => (valor === null ? 'Sin decisiones' : valor);

export function hojasGuias(r: GuidesReport): Hoja[] {
  return [
    {
      nombre: 'Guías por módulo',
      encabezado: [
        'System Plus · Reporte de guías por módulo y estado',
        `Generado el ${fechaHora(r.generatedAt)}`,
      ],
      resumen: [
        ['Módulos', r.totals.modules],
        ['Guías', r.totals.guides],
        ['Publicadas', r.totals.published],
        ['Borradores', r.totals.drafts],
      ],
      columnas: [
        { titulo: 'Código', ancho: 12 },
        { titulo: 'Módulo', ancho: 40 },
        { titulo: 'Estado del módulo', ancho: 18 },
        { titulo: 'Guías', ancho: 10, numero: true },
        { titulo: 'Publicadas', ancho: 12, numero: true },
        { titulo: 'Borradores', ancho: 12, numero: true },
        { titulo: 'Última actualización', ancho: 20 },
      ],
      filas: r.rows.map((m) => [
        m.moduleCode,
        m.moduleName,
        m.moduleStatus,
        m.total,
        m.published,
        m.drafts,
        fecha(m.lastUpdate),
      ]),
      vacio: 'Aún no hay módulos registrados.',
    },
  ];
}

export function hojasSugerencias(r: SuggestionsReport): Hoja[] {
  const desde = fechaIso(r.period.from);
  const hasta = fechaIso(r.period.to);
  const periodo =
    desde && hasta
      ? `Período: ${desde} a ${hasta}`
      : desde
        ? `Desde el ${desde}`
        : hasta
          ? `Hasta el ${hasta}`
          : 'Período: todo el historial';
  const encabezado = (titulo: string) => [
    `System Plus · ${titulo}`,
    periodo,
    `Generado el ${fechaHora(r.generatedAt)}`,
  ];
  return [
    {
      nombre: 'Por módulo',
      encabezado: encabezado('Reporte de sugerencias y tiempos de respuesta'),
      resumen: [
        ['Recibidas', r.totals.received],
        ['Pendientes', r.totals.pending],
        ['Vencidas sin responder', r.totals.overdue],
        ['Aprobadas', r.totals.approved],
        ['Rechazadas', r.totals.rejected],
        ['Promedio de respuesta (días hábiles)', dias(r.totals.averageResponseDays)],
        [
          'Respondidas dentro del plazo',
          r.totals.onTimeRate === null
            ? 'Sin decisiones'
            : `${r.totals.onTimeRate} %`,
        ],
      ],
      columnas: [
        { titulo: 'Código', ancho: 12 },
        { titulo: 'Módulo', ancho: 36 },
        { titulo: 'Recibidas', ancho: 11, numero: true },
        { titulo: 'Pendientes', ancho: 11, numero: true },
        { titulo: 'Aprobadas', ancho: 11, numero: true },
        { titulo: 'Rechazadas', ancho: 11, numero: true },
        {
          titulo: 'Promedio respuesta (días háb.)',
          ancho: 18,
          numero: true,
        },
        { titulo: 'Respondidas fuera de plazo', ancho: 16, numero: true },
      ],
      filas: r.byModule.map((m) => [
        m.moduleCode,
        m.moduleName,
        m.received,
        m.pending,
        m.approved,
        m.rejected,
        m.averageResponseDays,
        m.lateDecisions,
      ]),
      vacio: 'No hay sugerencias en este período.',
    },
    {
      nombre: 'Pendientes',
      encabezado: encabezado('Sugerencias pendientes por responder'),
      columnas: [
        { titulo: 'Código', ancho: 12 },
        { titulo: 'Módulo', ancho: 26 },
        { titulo: 'Guía', ancho: 30 },
        { titulo: 'Campo', ancho: 20 },
        { titulo: 'Docente', ancho: 24 },
        { titulo: 'Enviada', ancho: 12 },
        { titulo: 'Vence', ancho: 12 },
        { titulo: 'Días hábiles esperando', ancho: 14, numero: true },
        { titulo: 'Plazo', ancho: 12 },
      ],
      filas: r.pending.map((s) => [
        s.code,
        s.moduleName,
        s.guideTitle,
        s.field,
        s.teacher,
        fecha(s.sentAt),
        fecha(s.dueAt),
        s.businessDaysWaiting,
        s.deadline,
      ]),
      vacio: 'No hay sugerencias pendientes en este período.',
    },
  ];
}
