export interface DefaultCurriculumModule {
  name: string;
  prefix: string;
  description: string;
  competencies: string[];
}

/**
 * Módulos y competencias reales del Técnico en Sistemas de System Plus Piendamó (noviembre de 2026).
 * Al arrancar, la API crea los que falten; nunca borra ni cambia los que ya existen, así que una
 * base de datos con información conserva sus módulos. El coordinador puede editarlos en la aplicación.
 */
export const DEFAULT_CURRICULUM: DefaultCurriculumModule[] = [
  {
    name: 'Aplicaciones móviles',
    prefix: 'APM',
    description:
      'Desarrolla aplicaciones con Python y Kivy que integran sensores y actuadores, hasta un producto mínimo viable.',
    competencies: [
      'Fundamentos / Python',
      'Kivy',
      'Sensores y actuadores',
      'Integración hardware y software',
      'Proyecto',
      'MVP / Lanzamiento',
    ],
  },
  {
    name: 'Ensamble y mantenimiento',
    prefix: 'ENS',
    description:
      'Identifica las partes del computador, lo ensambla, instala su software y diagnostica y repara fallas.',
    competencies: [
      'Partes',
      'Ensamble estándar',
      'Sistemas operativos',
      'Redes y multimedia',
      'Instalación de software',
      'Diagnóstico y reparación',
    ],
  },
  {
    name: 'Excel avanzado',
    prefix: 'EXC',
    description:
      'Usa funciones, manejo de datos y macros de Excel para automatizar tareas y construir modelos financieros.',
    competencies: [
      'Fundamentos',
      'Funciones',
      'Manejo de datos',
      'Grabadora de macros',
      'Macros con VB',
      'Modelos financieros',
    ],
  },
  {
    name: 'Informática básica',
    prefix: 'INF',
    description:
      'Maneja el sistema operativo, las herramientas de ofimática e internet para el trabajo diario.',
    competencies: [
      'Windows',
      'Word',
      'Excel',
      'PowerPoint',
      'Access',
      'Internet',
    ],
  },
  {
    name: 'Programación',
    prefix: 'PRG',
    description:
      'Desarrolla aplicaciones web y móviles con Visual Basic, HTML, CSS, frameworks de diseño y JavaScript.',
    competencies: [
      'Visual Basic como aplicativo de Excel',
      'HTML-CSS',
      'Bootstrap',
      'Materialize',
      'JavaScript',
      'Apps móviles Android',
    ],
  },
  {
    name: 'Redes Windows',
    prefix: 'RED',
    description:
      'Diseña, construye, configura y administra redes de área local con equipos Windows.',
    competencies: [
      'Teoría general',
      'Direcciones IP',
      'Cisco Packet Tracer',
      'Configuración',
      'Construcción',
      'Administración',
    ],
  },
  {
    name: 'Emprendimiento',
    prefix: 'EMP',
    description:
      'Formula y valida ideas de negocio relacionadas con la tecnología. Coordinación registra sus competencias.',
    competencies: [],
  },
];
