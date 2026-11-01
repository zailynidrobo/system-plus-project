import { FieldConfig, GuideContent, GuideField } from '../../shared/models/guide-field';
import { Guide, GuideEvent } from '../../shared/models/guide';
import { COORDINADORA } from './seed-academic';

/**
 * Estructura institucional por defecto: 6 campos, 5 obligatorios (Figma HE-03 "Estructura v3 · POO").
 * Los primeros campos que no son de texto largo se muestran en "Datos de identificación";
 * el resto en "Contenido pedagógico".
 */
export function camposPorDefecto(): GuideField[] {
  return [
    {
      key: 'intensidad',
      label: 'Intensidad horaria',
      type: 'select',
      required: true,
      options: ['20 horas · 5 semanas', '40 horas · 10 semanas', '60 horas · 15 semanas', '80 horas · 20 semanas'],
      teacherEditable: false,
    },
    {
      key: 'evaluacion',
      label: 'Tipo de evaluación',
      type: 'select',
      required: true,
      options: ['Por evidencias', 'Por proyecto', 'Mixta'],
      teacherEditable: true,
    },
    {
      key: 'objetivos',
      label: 'Objetivos de aprendizaje',
      type: 'textarea',
      required: true,
      maxLength: 500,
      teacherEditable: true,
    },
    {
      key: 'metodologia',
      label: 'Metodología y estrategias didácticas',
      type: 'select',
      required: true,
      options: [
        'Aprendizaje basado en proyectos (ABP)',
        'Aprendizaje basado en problemas',
        'Estudio de caso',
        'Aula invertida',
        'Taller práctico guiado',
        'Clase magistral participativa',
      ],
      teacherEditable: true,
    },
    {
      key: 'criterios',
      label: 'Criterios de evaluación y evidencias',
      type: 'textarea',
      required: true,
      maxLength: 500,
      help: 'Describe las evidencias de desempeño, producto y conocimiento...',
      teacherEditable: true,
    },
    {
      key: 'recursos',
      label: 'Recursos y bibliografía',
      type: 'textarea',
      required: false,
      teacherEditable: true,
    },
  ];
}

export function crearEstructuras(): FieldConfig[] {
  return [
    // POO tiene la estructura v3 que muestra Figma; los demás módulos usan la v1
    { moduleId: 2, competencyId: null, fields: camposPorDefecto(), version: 3, updatedAt: '2026-10-02T10:00:00-05:00', updatedBy: COORDINADORA.name },
    ...[1, 3, 4, 5, 6].map((moduleId) => ({
      moduleId,
      competencyId: null,
      fields: camposPorDefecto(),
      version: 1,
      updatedAt: '2026-02-10T10:00:00-05:00',
      updatedBy: COORDINADORA.name,
    })),
  ];
}

interface SemillaGuia {
  code: string;
  moduleId: number;
  competencyId: number;
  title: string;
  publicada: boolean;
  fecha: string;
  version?: string;
  /** Primera publicación, cuando la versión vigente salió después (por una sugerencia aprobada). */
  publicadaEl?: string;
  estructura?: number;
  content: GuideContent;
}

const contenido = (intensidad: string, evaluacion: string, objetivos: string, metodologia: string, criterios: string, recursos = ''): GuideContent =>
  ({ intensidad, evaluacion, objetivos, metodologia, criterios, recursos });

// Guías del listado de Figma (HE-03) y de HE-04. Las de POO y Bases de Datos están publicadas
// porque docente@ está asignado a esos módulos; GB-SIS-01 queda en borrador.
const SEMILLAS: SemillaGuia[] = [
  {
    code: 'GB-FP-01', moduleId: 1, competencyId: 1, title: 'Guía base · Fundamentos de programación', publicada: true, fecha: '2026-09-12T08:40:00-05:00',
    content: contenido('40 horas · 10 semanas', 'Por evidencias',
      'Resolver problemas sencillos mediante algoritmos representados en pseudocódigo y diagramas de flujo.',
      'Taller práctico guiado',
      'Evidencia de producto: algoritmos resueltos en pseudocódigo. Evidencia de conocimiento: prueba escrita sobre estructuras de control.'),
  },
  {
    code: 'GB-POO-01', moduleId: 2, competencyId: 5, title: 'Guía base · Programación Orientada a Objetos', publicada: true, fecha: '2026-10-07T09:31:00-05:00', estructura: 3,
    content: contenido('40 horas · 10 semanas', 'Por evidencias',
      'Aplicar los principios de encapsulamiento, herencia y polimorfismo en el desarrollo de aplicaciones de escritorio con Java.',
      'Aprendizaje basado en proyectos (ABP)',
      'Evidencia de producto: aplicación CRUD con mínimo 3 clases relacionadas por herencia. Evidencia de conocimiento: cuestionario sobre diagramas UML de clases.',
      'Documentación oficial de Java SE. Guía institucional de diagramas UML.'),
  },
  {
    code: 'GB-POO-02', moduleId: 2, competencyId: 8, title: 'Pruebas de clases de dominio', publicada: true, fecha: '2026-09-25T10:00:00-05:00', estructura: 3,
    content: contenido('20 horas · 5 semanas', 'Por proyecto',
      'Construir pruebas unitarias que validen el comportamiento de las clases de dominio.',
      'Taller práctico guiado',
      'Evidencia de producto: suite de pruebas con cobertura de los casos principales.'),
  },
  {
    code: 'GB-POO-03', moduleId: 2, competencyId: 8, title: 'Validación de servicios', publicada: true, fecha: '2026-09-28T10:00:00-05:00', estructura: 3,
    content: contenido('20 horas · 5 semanas', 'Mixta',
      'Verificar mediante pruebas automatizadas el funcionamiento de los servicios de la aplicación.',
      'Estudio de caso',
      'Evidencia de desempeño: ejecución de pruebas sobre un servicio real. Evidencia de conocimiento: informe de resultados.'),
  },
  {
    code: 'GB-BD-02', moduleId: 3, competencyId: 10, title: 'Guía base · Bases de Datos', publicada: true, fecha: '2026-09-18T11:00:00-05:00', publicadaEl: '2026-09-02T09:00:00-05:00', version: 'v2.1',
    content: contenido('40 horas · 10 semanas', 'Por evidencias',
      'Aplicar la normalización hasta tercera forma normal para diseñar bases de datos relacionales íntegras.',
      'Aprendizaje basado en problemas',
      'Evidencia de producto: modelo entidad-relación normalizado. Evidencia de conocimiento: taller de formas normales.',
      'Manual de PostgreSQL. Guía de modelado entidad-relación.'),
  },
  {
    code: 'GB-RC-01', moduleId: 4, competencyId: 13, title: 'Guía base · Redes y conectividad', publicada: true, fecha: '2026-09-18T14:10:00-05:00',
    content: contenido('60 horas · 15 semanas', 'Por evidencias',
      'Instalar y certificar puntos de red de cableado estructurado según la norma vigente.',
      'Taller práctico guiado',
      'Evidencia de desempeño: certificación de un punto de red. Evidencia de producto: plano de la red instalada.'),
  },
  {
    code: 'GB-SIS-01', moduleId: 6, competencyId: 20, title: 'Guía base · Seguridad informática', publicada: false, fecha: '2026-09-16T11:02:00-05:00',
    content: contenido('40 horas · 10 semanas', 'Mixta',
      'Aplicar políticas básicas de seguridad para proteger la información de una organización.',
      'Estudio de caso',
      ''),
  },
  {
    code: 'GB-ME-01', moduleId: 5, competencyId: 17, title: 'Guía base · Mantenimiento de equipos', publicada: true, fecha: '2026-09-10T15:55:00-05:00',
    content: contenido('40 horas · 10 semanas', 'Por evidencias',
      'Ejecutar el mantenimiento preventivo de equipos de cómputo siguiendo los protocolos de seguridad.',
      'Taller práctico guiado',
      'Evidencia de desempeño: mantenimiento preventivo documentado en la ficha técnica.'),
  },
];

export function crearGuias(): Guide[] {
  return SEMILLAS.map((s, i) => ({
    id: i + 1,
    code: s.code,
    moduleId: s.moduleId,
    competencyId: s.competencyId,
    title: s.title,
    status: s.publicada ? 'Publicada' : 'Borrador',
    content: s.content,
    fields: camposPorDefecto(),
    structureVersion: s.estructura ?? 1,
    version: s.publicada ? (s.version ?? 'v1.0') : 'v0',
    createdAt: s.publicadaEl ?? s.fecha,
    createdBy: COORDINADORA,
    updatedAt: s.fecha,
    updatedBy: COORDINADORA,
    publishedAt: s.publicada ? (s.publicadaEl ?? s.fecha) : null,
    publishedBy: s.publicada ? COORDINADORA : null,
  }));
}

export function crearEventosGuias(guias: Guide[]): GuideEvent[] {
  return guias.flatMap((g) => {
    const eventos: GuideEvent[] = [{ guideId: g.id, titulo: 'Guía creada como borrador', autor: COORDINADORA.name, fecha: g.createdAt }];
    if (g.publishedAt) eventos.push({ guideId: g.id, titulo: 'Guía publicada', autor: COORDINADORA.name, fecha: g.publishedAt });
    return eventos;
  });
}
