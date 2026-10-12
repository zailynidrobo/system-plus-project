import { Guide, GuideEvent } from '../../shared/models/guide';
import { GuideValue } from '../../shared/models/guide-field';
import { Suggestion, SuggestionStatus } from '../../shared/models/suggestion';
import { formatSuggestionCode, sumarDiasHabiles } from '../../shared/utils/sugerencias';
import { COORDINADORA } from './seed-academic';
import { UsuarioMock } from './seed-users';

interface SemillaSugerencia {
  numero: number;
  teacherId: number;
  guideCode: string;
  fieldKey: string;
  /** Valor anterior cuando ya se aprobó (en la guía quedó el propuesto). */
  anterior?: string;
  propuesto: GuideValue;
  justification: string;
  createdAt: string;
  status: SuggestionStatus;
  decidedAt?: string;
  rejectReason?: string;
  feedback?: string;
  resultingVersion?: string;
}

/** Fecha relativa a hoy, para que las pendientes se vean recientes como en Figma ("Hoy, 10:20 a. m."). */
function haceDias(dias: number, hora: number, minuto: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(hora, minuto, 0, 0);
  // si la hora aún no llega hoy, se usa hace una hora
  return d.getTime() > Date.now() ? new Date(Date.now() - 3_600_000).toISOString() : d.toISOString();
}

// Bandeja de Figma (HE-05-HU-02, 5003:514): SUG-011 a SUG-014 pendientes. docente@ tiene SUG-014
// pendiente, SUG-009 aprobada y SUG-006 rechazada (HE-05-HU-01-CA-02, 5003:322).
function semillas(): SemillaSugerencia[] {
  return [
    {
      numero: 6, teacherId: 2, guideCode: 'GB-BD-02', fieldKey: 'intensidad', propuesto: '60 horas · 15 semanas',
      justification: 'Los talleres de normalización necesitan más horas de práctica guiada en el laboratorio.',
      createdAt: '2026-09-08T09:10:00-05:00', status: 'Rechazada', decidedAt: '2026-09-10T15:30:00-05:00',
      rejectReason: 'No se ajusta a la intensidad horaria del módulo',
      feedback: 'Gracias, Julián. El plan de estudios fija 40 horas para el módulo. Puedes reforzar la práctica en tu versión personalizada.',
    },
    {
      numero: 9, teacherId: 2, guideCode: 'GB-BD-02', fieldKey: 'recursos', anterior: 'Manual de PostgreSQL.',
      propuesto: 'Manual de PostgreSQL. Guía de modelado entidad-relación.',
      justification: 'La guía de modelado ayuda a los estudiantes a preparar el modelo entidad-relación antes de normalizar.',
      createdAt: '2026-09-15T08:30:00-05:00', status: 'Aprobada', decidedAt: '2026-09-18T11:00:00-05:00', resultingVersion: 'v2.1',
    },
    {
      numero: 11, teacherId: 4, guideCode: 'GB-RC-01', fieldKey: 'intensidad', propuesto: '80 horas · 20 semanas',
      justification: 'Las prácticas de certificación de puntos de red requieren más horas de laboratorio.',
      createdAt: haceDias(5, 16, 15), status: 'Pendiente',
    },
    {
      numero: 12, teacherId: 6, guideCode: 'GB-BD-02', fieldKey: 'metodologia', propuesto: 'Aula invertida',
      justification: 'En las unidades 2 y 3 los estudiantes rinden más si revisan la teoría antes de la clase práctica.',
      createdAt: haceDias(3, 9, 40), status: 'Pendiente',
    },
    {
      numero: 13, teacherId: 3, guideCode: 'GB-POO-01', fieldKey: 'recursos',
      propuesto: 'Documentación oficial de Java SE. Guía institucional de diagramas UML. Curso gratuito de Java en la plataforma oficial de Oracle.',
      justification: 'El curso gratuito sirve como refuerzo autónomo para quienes no traen bases de programación.',
      createdAt: haceDias(1, 15, 5), status: 'Pendiente',
    },
    {
      numero: 14, teacherId: 2, guideCode: 'GB-POO-01', fieldKey: 'criterios',
      propuesto: 'Evidencia de producto: aplicación CRUD con mínimo 3 clases relacionadas por herencia. Evidencia de conocimiento: cuestionario sobre diagramas UML de clases. Evidencia de desempeño: sustentación oral de 10 minutos.',
      justification: 'En el semestre 2026-1 detectamos entregas copiadas; la sustentación permite evaluar la comprensión real.',
      createdAt: haceDias(0, 10, 20), status: 'Pendiente',
    },
  ];
}

export function crearSugerencias(guias: Guide[], usuarios: UsuarioMock[]): Suggestion[] {
  return semillas().map((s, i) => {
    const guia = guias.find((g) => g.code === s.guideCode)!;
    const campo = guia.fields.find((f) => f.key === s.fieldKey)!;
    const actual = s.anterior ?? guia.content[s.fieldKey] ?? null;
    return {
      id: i + 1,
      code: formatSuggestionCode(s.numero),
      guideId: guia.id,
      fieldKey: s.fieldKey,
      fieldLabel: campo.label,
      teacherId: s.teacherId,
      teacherName: usuarios.find((u) => u.id === s.teacherId)?.nombre ?? '',
      currentValue: actual,
      proposedValue: s.propuesto,
      justification: s.justification,
      baseVersion: s.resultingVersion ? 'v2.0' : guia.version,
      status: s.status,
      createdAt: s.createdAt,
      dueAt: sumarDiasHabiles(s.createdAt, 5),
      decidedAt: s.decidedAt ?? null,
      decidedBy: s.decidedAt ? COORDINADORA : null,
      rejectReason: s.rejectReason ?? null,
      feedback: s.feedback ?? null,
      resultingVersion: s.resultingVersion ?? null,
    };
  });
}

/** Eventos del historial de la guía que dejan las sugerencias aprobadas. */
export function eventosDeSugerencias(sugerencias: Suggestion[]): GuideEvent[] {
  return sugerencias
    .filter((s) => s.status === 'Aprobada')
    .map((s) => ({
      guideId: s.guideId,
      titulo: `Sugerencia ${s.code} aprobada · ${s.fieldLabel} (${s.resultingVersion})`,
      autor: s.decidedBy?.name ?? '',
      fecha: s.decidedAt ?? s.createdAt,
    }));
}
