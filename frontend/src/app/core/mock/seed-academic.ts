import { AcademicModule, Persona, Program } from '../../shared/models/academic-module';

export const PROGRAMA: Program = { id: 1, code: 'TS', name: 'Técnico en Sistemas', campus: 'Sede Piendamó' };

/** Docente asignado a un módulo (en el backend: PUT /academic/modules/:moduleId/teachers/:teacherId). */
export interface AsignacionDocente {
  teacherId: number;
  moduleId: number;
}

// Laura Muñoz (id 7) es la coordinadora del programa en los datos semilla.
const COORDINADORA: Persona = { id: 7, name: 'Laura Muñoz' };

function modulo(
  sequence: number,
  name: string,
  competencyPrefix: string,
  description: string,
  createdAt: string,
): AcademicModule {
  return {
    id: sequence,
    programId: PROGRAMA.id,
    code: `${PROGRAMA.code}-MOD-${String(sequence).padStart(2, '0')}`,
    sequence,
    name,
    description,
    status: 'active',
    competencyPrefix,
    createdBy: COORDINADORA,
    createdAt,
    updatedBy: COORDINADORA,
    updatedAt: createdAt,
    inactivatedBy: null,
    inactivatedAt: null,
    inactivationReason: null,
  };
}

// Módulos del plan curricular tal como aparecen en los frames de HE-02 y HE-04.
export function crearModulos(): AcademicModule[] {
  return [
    modulo(1, 'Fundamentos de programación', 'FP', 'Lógica, algoritmos y estructuras básicas de programación.', '2026-02-02T08:00:00-05:00'),
    modulo(2, 'Programación Orientada a Objetos', 'POO', 'Clases, objetos, herencia, encapsulamiento y polimorfismo.', '2026-02-02T08:10:00-05:00'),
    modulo(3, 'Bases de Datos', 'BD', 'Modelado relacional, normalización y consultas SQL.', '2026-02-02T08:20:00-05:00'),
    modulo(4, 'Redes y conectividad', 'RC', 'Cableado estructurado, direccionamiento IP y configuración de redes LAN.', '2026-02-03T09:00:00-05:00'),
    modulo(5, 'Mantenimiento de equipos', 'ME', 'Diagnóstico, mantenimiento preventivo y correctivo de equipos de cómputo.', '2026-02-03T09:10:00-05:00'),
    modulo(6, 'Seguridad informática y soporte', 'SIS', 'Buenas prácticas de seguridad, respaldo de información y mesa de ayuda.', '2026-02-03T09:20:00-05:00'),
  ];
}

export function crearAsignaciones(): AsignacionDocente[] {
  return [
    // docente@ (Julián Andrés Ospina): POO y Bases de Datos, como en Figma
    { teacherId: 2, moduleId: 2 },
    { teacherId: 2, moduleId: 3 },
    // autorizado@ (Paola Valencia): también POO, para mostrar que las versiones no se mezclan
    { teacherId: 3, moduleId: 2 },
    { teacherId: 3, moduleId: 4 },
  ];
}
