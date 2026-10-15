import { Guide } from '../../shared/models/guide';
import { TeacherVersion } from '../../shared/models/teacher-version';

interface SemillaVersion {
  teacherId: number;
  guideCode: string;
  name: string;
  createdAt: string;
  /** Campos adaptados: clave → [valor, fecha de guardado]. */
  cambios: Record<string, [string, string]>;
}

// docente@ ya tiene una versión de GB-POO-01 (Figma: "Ya tienes tu versión") y ninguna de GB-BD-02.
// Paola Valencia y Santiago Gómez tienen las suyas en POO: sirven para comprobar el aislamiento.
const SEMILLAS: SemillaVersion[] = [
  {
    teacherId: 2,
    guideCode: 'GB-POO-01',
    name: 'POO · Grupo 2026-1',
    createdAt: '2026-10-08T08:15:00-05:00',
    cambios: {
      evaluacion: ['Mixta', '2026-10-08T09:02:00-05:00'],
      criterios: [
        'Evidencia de producto: aplicación CRUD con mínimo 3 clases relacionadas por herencia. Evidencia de conocimiento: cuestionario sobre diagramas UML de clases. Se suma una sustentación oral de 10 minutos.',
        '2026-10-09T16:20:00-05:00',
      ],
    },
  },
  {
    teacherId: 3,
    guideCode: 'GB-POO-01',
    name: 'POO · Grupo nocturno',
    createdAt: '2026-10-08T19:40:00-05:00',
    cambios: { metodologia: ['Aula invertida', '2026-10-08T20:05:00-05:00'] },
  },
  {
    teacherId: 6,
    guideCode: 'GB-POO-01',
    name: 'POO · Grupo 2026-2 · Mañana',
    createdAt: '2026-10-09T07:30:00-05:00',
    cambios: {},
  },
  {
    teacherId: 3,
    guideCode: 'GB-RC-01',
    name: 'Redes · Grupo 2026-2',
    createdAt: '2026-09-20T10:00:00-05:00',
    cambios: { evaluacion: ['Mixta', '2026-09-20T10:30:00-05:00'] },
  },
];

export function crearVersiones(guias: Guide[]): TeacherVersion[] {
  return SEMILLAS.map((s, i) => {
    const guia = guias.find((g) => g.code === s.guideCode)!;
    const content = structuredClone(guia.content);
    const fieldUpdatedAt: Record<string, string> = {};
    for (const [key, [valor, fecha]] of Object.entries(s.cambios)) {
      content[key] = valor;
      fieldUpdatedAt[key] = fecha;
    }
    const fechas = Object.values(fieldUpdatedAt).sort();
    const ultima = Object.entries(fieldUpdatedAt).sort((a, b) => b[1].localeCompare(a[1]))[0];
    return {
      id: i + 1,
      guideId: guia.id,
      teacherId: s.teacherId,
      name: s.name,
      content,
      fields: structuredClone(guia.fields),
      baseContent: structuredClone(guia.content),
      baseVersion: guia.version,
      structureVersion: guia.structureVersion,
      fieldUpdatedAt,
      lastField: ultima?.[0] ?? null,
      createdAt: s.createdAt,
      updatedAt: fechas[fechas.length - 1] ?? s.createdAt,
    };
  });
}
