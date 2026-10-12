import { AcademicModule, Persona, Program } from '../../shared/models/academic-module';
import { Competency, CompetencyRevision } from '../../shared/models/competency';
import { formatCompetencyCode } from '../../shared/utils/curricular';

export const PROGRAMA: Program = { id: 1, code: 'TS', name: 'Técnico en Sistemas', campus: 'Sede Piendamó' };

/** Docente asignado a un módulo (en el backend: PUT /academic/modules/:moduleId/teachers/:teacherId). */
export interface AsignacionDocente {
  teacherId: number;
  moduleId: number;
}

// Laura Muñoz (id 7) es la coordinadora del programa en los datos semilla.
export const COORDINADORA: Persona = { id: 7, name: 'Laura Muñoz' };

interface SemillaModulo {
  name: string;
  prefix: string;
  description: string;
  createdAt: string;
  updatedAt?: string;
  competencias: string[];
}

// Módulos y competencias tal como aparecen en los frames de HE-02 (PanelCoordinador,
// detalle de POO, duplicado de Bases de Datos) y HE-04.
const SEMILLAS: SemillaModulo[] = [
  {
    name: 'Fundamentos de programación',
    prefix: 'FP',
    description: 'Desarrolla la lógica de programación mediante algoritmos, estructuras de control y buenas prácticas de codificación.',
    createdAt: '2026-02-02T08:00:00-05:00',
    competencias: [
      'Analizar problemas y representarlos mediante algoritmos y diagramas de flujo.',
      'Aplicar estructuras de control secuenciales, condicionales y repetitivas.',
      'Utilizar variables, tipos de datos y operadores en programas básicos.',
      'Depurar programas identificando y corrigiendo errores lógicos.',
    ],
  },
  {
    name: 'Programación Orientada a Objetos',
    prefix: 'POO',
    description: 'Desarrolla soluciones de software mediante clases, objetos, herencia, polimorfismo y patrones básicos de diseño.',
    createdAt: '2026-02-02T08:10:00-05:00',
    updatedAt: '2026-09-18T10:21:00-05:00',
    competencias: [
      'Modelar soluciones de software mediante clases, objetos y relaciones.',
      'Implementar encapsulamiento, herencia y polimorfismo en aplicaciones.',
      'Aplicar colecciones, excepciones y persistencia básica de datos.',
      'Construir pruebas unitarias para validar el comportamiento del software.',
    ],
  },
  {
    name: 'Bases de Datos',
    prefix: 'BD',
    description: 'Diseña, consulta y administra bases de datos relacionales aplicando integridad, normalización y seguridad de la información.',
    createdAt: '2026-02-02T08:20:00-05:00',
    competencias: [
      'Modelar bases de datos relacionales a partir de requerimientos de información.',
      'Aplicar normalización para garantizar la integridad de los datos.',
      'Construir consultas SQL para insertar, actualizar y consultar información.',
      'Implementar mecanismos de seguridad y respaldo de la información.',
    ],
  },
  {
    name: 'Redes y conectividad',
    prefix: 'RC',
    description: 'Instala, configura y verifica redes de área local y sus servicios básicos.',
    createdAt: '2026-02-03T09:00:00-05:00',
    competencias: [
      'Instalar y certificar cableado estructurado según la normativa vigente.',
      'Configurar direccionamiento IP y servicios básicos de red.',
      'Diagnosticar fallas de conectividad en redes de área local.',
    ],
  },
  {
    name: 'Mantenimiento de equipos',
    prefix: 'ME',
    description: 'Realiza el diagnóstico y el mantenimiento preventivo y correctivo de equipos de cómputo.',
    createdAt: '2026-02-03T09:10:00-05:00',
    competencias: [
      'Diagnosticar el estado de los componentes de hardware de un equipo de cómputo.',
      'Ejecutar mantenimiento preventivo siguiendo protocolos de seguridad.',
      'Realizar mantenimiento correctivo y reemplazo de componentes.',
      'Instalar y configurar sistemas operativos y controladores.',
    ],
  },
  {
    name: 'Seguridad informática y soporte',
    prefix: 'SIS',
    description: 'Aplica prácticas de protección de la información, diagnóstico preventivo y soporte técnico en entornos informáticos.',
    createdAt: '2026-02-03T09:20:00-05:00',
    competencias: [
      'Aplicar políticas de seguridad para proteger la información de la organización.',
      'Configurar copias de respaldo y procedimientos de recuperación.',
      'Atender solicitudes de soporte técnico mediante una mesa de ayuda.',
    ],
  },
];

export function crearModulos(): AcademicModule[] {
  return SEMILLAS.map((s, i) => {
    const sequence = i + 1;
    return {
      id: sequence,
      programId: PROGRAMA.id,
      code: `${PROGRAMA.code}-MOD-${String(sequence).padStart(2, '0')}`,
      sequence,
      name: s.name,
      description: s.description,
      status: 'active',
      competencyPrefix: s.prefix,
      createdBy: COORDINADORA,
      createdAt: s.createdAt,
      updatedBy: COORDINADORA,
      updatedAt: s.updatedAt ?? s.createdAt,
      inactivatedBy: null,
      inactivatedAt: null,
      inactivationReason: null,
    };
  });
}

export function crearCompetencias(): Competency[] {
  let id = 0;
  return SEMILLAS.flatMap((s, i) =>
    s.competencias.map((text, j) => ({
      id: ++id,
      moduleId: i + 1,
      code: formatCompetencyCode(s.prefix, j + 1),
      sequence: j + 1,
      text,
      version: 1,
      createdBy: COORDINADORA,
      createdAt: s.createdAt,
      updatedBy: COORDINADORA,
      updatedAt: s.createdAt,
      deletedBy: null,
      deletedAt: null,
    })),
  );
}

export function crearRevisiones(competencias: Competency[]): CompetencyRevision[] {
  return competencias.map((c) => ({
    competencyId: c.id,
    version: 1,
    text: c.text,
    editedBy: c.createdBy,
    editedAt: c.createdAt,
  }));
}

export function crearAsignaciones(): AsignacionDocente[] {
  return [
    // docente@ (Julián Andrés Ospina): POO y Bases de Datos, como en Figma
    { teacherId: 2, moduleId: 2 },
    { teacherId: 2, moduleId: 3 },
    // autorizado@ (Paola Valencia): también POO, para mostrar que las versiones no se mezclan
    { teacherId: 3, moduleId: 2 },
    { teacherId: 3, moduleId: 4 },
    // Santiago Gómez (docente sin cuenta de prueba) también tiene una versión de POO
    { teacherId: 6, moduleId: 2 },
    // Autores de las sugerencias pendientes de la bandeja de Figma (HE-05)
    { teacherId: 6, moduleId: 3 },
    { teacherId: 4, moduleId: 4 },
  ];
}
