import type { GuideField } from './academic.entities.js';

export const DEFAULT_GUIDE_FIELDS: GuideField[] = [
  {
    key: 'intensidad',
    label: 'Intensidad horaria',
    type: 'select',
    required: true,
    teacherEditable: false,
    options: [
      '20 horas · 5 semanas',
      '40 horas · 10 semanas',
      '60 horas · 15 semanas',
      '80 horas · 20 semanas',
    ],
  },
  {
    key: 'evaluacion',
    label: 'Tipo de evaluación',
    type: 'select',
    required: true,
    teacherEditable: true,
    options: ['Por evidencias', 'Por proyecto', 'Mixta'],
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
    teacherEditable: true,
    options: [
      'Aprendizaje basado en proyectos (ABP)',
      'Aprendizaje basado en problemas',
      'Estudio de caso',
      'Aula invertida',
      'Taller práctico guiado',
      'Clase magistral participativa',
    ],
  },
  {
    key: 'criterios',
    label: 'Criterios de evaluación y evidencias',
    type: 'textarea',
    required: true,
    maxLength: 500,
    help: 'Describe las evidencias de desempeño, producto y conocimiento…',
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
