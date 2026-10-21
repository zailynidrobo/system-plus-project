export interface DefaultCurriculumModule {
  name: string;
  prefix: string;
  description: string;
  competencies: string[];
}

export const DEFAULT_CURRICULUM: DefaultCurriculumModule[] = [
  {
    name: 'Fundamentos de programación',
    prefix: 'FP',
    description:
      'Desarrolla la lógica de programación mediante algoritmos, estructuras de control y buenas prácticas de codificación.',
    competencies: [
      'Analizar problemas y representarlos mediante algoritmos y diagramas de flujo.',
      'Aplicar estructuras de control secuenciales, condicionales y repetitivas.',
      'Utilizar variables, tipos de datos y operadores en programas básicos.',
      'Depurar programas identificando y corrigiendo errores lógicos.',
    ],
  },
  {
    name: 'Programación Orientada a Objetos',
    prefix: 'POO',
    description:
      'Desarrolla soluciones de software mediante clases, objetos, herencia, polimorfismo y patrones básicos de diseño.',
    competencies: [
      'Modelar soluciones de software mediante clases, objetos y relaciones.',
      'Implementar encapsulamiento, herencia y polimorfismo en aplicaciones.',
      'Aplicar colecciones, excepciones y persistencia básica de datos.',
      'Construir pruebas unitarias para validar el comportamiento del software.',
    ],
  },
  {
    name: 'Bases de Datos',
    prefix: 'BD',
    description:
      'Diseña, consulta y administra bases de datos relacionales aplicando integridad, normalización y seguridad de la información.',
    competencies: [
      'Modelar bases de datos relacionales a partir de requerimientos de información.',
      'Aplicar normalización para garantizar la integridad de los datos.',
      'Construir consultas SQL para insertar, actualizar y consultar información.',
      'Implementar mecanismos de seguridad y respaldo de la información.',
    ],
  },
  {
    name: 'Redes y conectividad',
    prefix: 'RC',
    description:
      'Instala, configura y verifica redes de área local y sus servicios básicos.',
    competencies: [
      'Instalar y certificar cableado estructurado según la normativa vigente.',
      'Configurar direccionamiento IP y servicios básicos de red.',
      'Diagnosticar fallas de conectividad en redes de área local.',
    ],
  },
  {
    name: 'Mantenimiento de equipos',
    prefix: 'ME',
    description:
      'Realiza el diagnóstico y el mantenimiento preventivo y correctivo de equipos de cómputo.',
    competencies: [
      'Diagnosticar el estado de los componentes de hardware de un equipo de cómputo.',
      'Ejecutar mantenimiento preventivo siguiendo protocolos de seguridad.',
      'Realizar mantenimiento correctivo y reemplazo de componentes.',
      'Instalar y configurar sistemas operativos y controladores.',
    ],
  },
  {
    name: 'Seguridad informática y soporte',
    prefix: 'SIS',
    description:
      'Aplica prácticas de protección de la información, diagnóstico preventivo y soporte técnico en entornos informáticos.',
    competencies: [
      'Aplicar políticas de seguridad para proteger la información de la organización.',
      'Configurar copias de respaldo y procedimientos de recuperación.',
      'Atender solicitudes de soporte técnico mediante una mesa de ayuda.',
    ],
  },
];
