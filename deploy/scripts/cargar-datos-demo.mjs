// Carga los datos de la demostración: usuarios de cada rol, guías base publicadas, docentes
// asignados, versiones docentes y sugerencias. Todo pasa por la API, con las mismas reglas que
// se aplican desde las pantallas.
//
// Uso (desde la raíz del repositorio, con el sistema ya encendido y el administrador con su
// contraseña definitiva):
//   node deploy/scripts/cargar-datos-demo.mjs --admin-correo CORREO --admin-clave CLAVE
// Opciones:
//   --api URL        dirección de la API (por defecto http://localhost/api, la de Docker;
//                    sin Docker: http://localhost:3000)
//   --clave CLAVE    contraseña que quedará para todos los usuarios de la demostración
//                    (por defecto Segura09@)
//
// Se puede correr más de una vez: lo que ya existe se deja como está.

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce((pares, valor, i, lista) => (valor.startsWith('--') ? [...pares, [valor.slice(2), lista[i + 1]]] : pares), []),
);
const API = (args.api ?? 'http://localhost/api').replace(/\/$/, '');
const ADMIN = { correo: args['admin-correo'], clave: args['admin-clave'] };
const CLAVE = args.clave ?? 'Segura09@';
const CLAVE_INICIAL = 'Inicial-2026-demo';

if (!ADMIN.correo || !ADMIN.clave) {
  console.error('Falta --admin-correo o --admin-clave. Ejemplo:');
  console.error('  node deploy/scripts/cargar-datos-demo.mjs --admin-correo administrador@gmail.com --admin-clave Segura09@');
  process.exit(1);
}

const USUARIOS = [
  { nombre: 'Laura Gómez', correo: 'laura.gomez@gmail.com', rol: 'coordinador' },
  { nombre: 'Valentina Muñoz', correo: 'valentina.munoz@gmail.com', rol: 'coordinador' },
  { nombre: 'Carlos Ruiz', correo: 'carlos.ruiz@gmail.com', rol: 'docente_autorizado' },
  { nombre: 'Diana Torres', correo: 'diana.torres@gmail.com', rol: 'docente_autorizado' },
  { nombre: 'Julián Mendoza', correo: 'julian.mendoza@gmail.com', rol: 'docente_autorizado' },
  { nombre: 'Natalia Rojas', correo: 'natalia.rojas@gmail.com', rol: 'docente' },
  { nombre: 'Felipe Castro', correo: 'felipe.castro@gmail.com', rol: 'docente' },
  { nombre: 'Santiago Herrera', correo: 'santiago.herrera@gmail.com', rol: 'admin' },
  { nombre: 'Camila Ortiz', correo: 'camila.ortiz@gmail.com', rol: 'admin' },
  { nombre: 'Andrés Vargas', correo: 'andres.vargas@gmail.com', rol: 'admin' },
];

// Guías base por módulo (prefijo) y número de competencia. publicar: false deja un borrador.
const GUIAS = [
  {
    modulo: 'FP', competencia: 1, publicar: true,
    contenido: {
      intensidad: '40 horas · 10 semanas', evaluacion: 'Por evidencias', metodologia: 'Taller práctico guiado',
      objetivos: '1. Analizar problemas cotidianos y descomponerlos en pasos.\n2. Representar soluciones con algoritmos y diagramas de flujo.\n3. Verificar algoritmos con pruebas de escritorio.',
      criterios: 'Evidencia de desempeño: resolución guiada de ejercicios en clase.\nEvidencia de producto: cuaderno de algoritmos con 10 problemas resueltos.\nEvidencia de conocimiento: prueba escrita sobre diagramas de flujo.',
      recursos: 'PSeInt. Joyanes, L. Fundamentos de programación. Guías del instructor.',
    },
  },
  {
    modulo: 'FP', competencia: 2, publicar: true,
    contenido: {
      intensidad: '40 horas · 10 semanas', evaluacion: 'Mixta', metodologia: 'Aprendizaje basado en problemas',
      objetivos: '1. Aplicar estructuras condicionales para tomar decisiones en un programa.\n2. Usar ciclos para procesar listas de datos.',
      criterios: 'Evidencia de producto: programa de cálculo de notas con condicionales y ciclos.\nEvidencia de conocimiento: cuestionario sobre estructuras de control.',
      recursos: 'PSeInt y Python 3. Ejercicios de la guía.',
    },
  },
  {
    modulo: 'FP', competencia: 3, publicar: false,
    contenido: {
      intensidad: '20 horas · 5 semanas', evaluacion: 'Por evidencias', metodologia: 'Aula invertida',
      objetivos: '1. Declarar variables con el tipo de dato adecuado.\n2. Construir expresiones con operadores aritméticos y lógicos.',
      criterios: 'Evidencia de producto: calculadora básica en consola.',
    },
  },
  {
    modulo: 'POO', competencia: 1, publicar: true,
    contenido: {
      intensidad: '60 horas · 15 semanas', evaluacion: 'Por proyecto', metodologia: 'Aprendizaje basado en proyectos (ABP)',
      objetivos: '1. Identificar clases, atributos y métodos a partir de un caso real.\n2. Modelar relaciones entre clases con diagramas UML.',
      criterios: 'Evidencia de producto: diagrama de clases del proyecto de aula.\nEvidencia de desempeño: sustentación del modelo ante el grupo.',
      recursos: 'Java 21, IntelliJ IDEA Community, draw.io.',
    },
  },
  {
    modulo: 'POO', competencia: 2, publicar: true,
    contenido: {
      intensidad: '60 horas · 15 semanas', evaluacion: 'Mixta', metodologia: 'Estudio de caso',
      objetivos: '1. Aplicar encapsulamiento con modificadores de acceso.\n2. Reutilizar código mediante herencia y polimorfismo.',
      criterios: 'Evidencia de producto: aplicación de inventario con herencia.\nEvidencia de conocimiento: prueba sobre polimorfismo.',
      recursos: 'Java 21. Deitel, P. Cómo programar en Java.',
    },
  },
  {
    modulo: 'BD', competencia: 1, publicar: true,
    contenido: {
      intensidad: '40 horas · 10 semanas', evaluacion: 'Por proyecto', metodologia: 'Aprendizaje basado en proyectos (ABP)',
      objetivos: '1. Construir el modelo entidad-relación de un negocio local.\n2. Normalizar tablas hasta tercera forma normal.',
      criterios: 'Evidencia de producto: modelo entidad-relación y script de creación.\nEvidencia de desempeño: revisión del modelo en parejas.',
      recursos: 'PostgreSQL, DBeaver, guía de normalización.',
    },
  },
  {
    modulo: 'BD', competencia: 2, publicar: true,
    contenido: {
      intensidad: '40 horas · 10 semanas', evaluacion: 'Por evidencias', metodologia: 'Taller práctico guiado',
      objetivos: '1. Consultar información con SELECT, filtros y uniones.\n2. Resumir datos con funciones de agregación.',
      criterios: 'Evidencia de producto: banco de 20 consultas resueltas.\nEvidencia de conocimiento: prueba práctica de consultas.',
      recursos: 'PostgreSQL y base de datos de práctica de la institución.',
    },
  },
  {
    modulo: 'RC', competencia: 1, publicar: true,
    contenido: {
      intensidad: '40 horas · 10 semanas', evaluacion: 'Por evidencias', metodologia: 'Taller práctico guiado',
      objetivos: '1. Identificar los componentes de una red de área local.\n2. Elaborar y certificar cableado estructurado.',
      criterios: 'Evidencia de desempeño: ponchado y prueba de cables directos y cruzados.\nEvidencia de producto: plano de la red de la sala.',
      recursos: 'Kit de ponchado, probador de cable, Cisco Packet Tracer.',
    },
  },
];

// Módulos que se asignan a cada docente.
const ASIGNACIONES = {
  'carlos.ruiz@gmail.com': ['POO', 'BD'],
  'diana.torres@gmail.com': ['FP', 'RC'],
  'julian.mendoza@gmail.com': ['BD'],
  'natalia.rojas@gmail.com': ['FP', 'POO'],
  'felipe.castro@gmail.com': ['BD', 'RC'],
};

// Versiones docentes: guía (módulo + competencia), nombre y campos adaptados.
const VERSIONES = [
  {
    docente: 'natalia.rojas@gmail.com', modulo: 'FP', competencia: 1, nombre: 'Grupo 10-1 · Jornada mañana',
    cambios: { evaluacion: 'Mixta', metodologia: 'Aprendizaje basado en problemas' },
  },
  {
    docente: 'carlos.ruiz@gmail.com', modulo: 'POO', competencia: 1, nombre: 'Grupo 11-2 · Jornada tarde',
    // Docente autorizado: el texto base se conserva y se agrega el complemento.
    complementos: { objetivos: '3. Aplicar el modelo al proyecto de la tienda escolar.' },
    cambios: { evaluacion: 'Mixta' },
  },
  {
    docente: 'felipe.castro@gmail.com', modulo: 'BD', competencia: 1, nombre: 'Grupo 11-1 · Jornada mañana',
    cambios: { metodologia: 'Estudio de caso' },
  },
];

// Sugerencias de mejora a la guía base. aprobar: true la aprueba la coordinadora (crea la v1.1).
const SUGERENCIAS = [
  {
    docente: 'carlos.ruiz@gmail.com', modulo: 'POO', competencia: 2, campo: 'recursos', aprobar: true,
    valor: 'Java 21. Deitel, P. Cómo programar en Java. Curso gratuito de Java del SENA.',
    justificacion: 'El curso del SENA complementa la guía y los estudiantes pueden seguirlo en casa.',
  },
  {
    docente: 'natalia.rojas@gmail.com', modulo: 'FP', competencia: 1, campo: 'evaluacion', valor: 'Mixta',
    justificacion: 'Los grupos de la mañana avanzan mejor combinando evidencias y un miniproyecto final.',
  },
  {
    docente: 'felipe.castro@gmail.com', modulo: 'BD', competencia: 2, campo: 'metodologia', valor: 'Estudio de caso',
    justificacion: 'Un caso real de la cooperativa del pueblo motiva más que los ejercicios sueltos.',
  },
];

// ---------------------------------------------------------------------------------------------

async function llamar(metodo, ruta, { token, cuerpo } = {}) {
  const respuesta = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: {
      ...(cuerpo !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await respuesta.text();
  let datos = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = texto;
  }
  if (!respuesta.ok) {
    const error = new Error(`${metodo} ${ruta} -> ${respuesta.status} ${datos?.code ?? ''} ${datos?.message ?? texto}`);
    error.estado = respuesta.status;
    error.codigo = datos?.code;
    throw error;
  }
  return datos;
}

async function entrar(correo, clave) {
  const sesion = await llamar('POST', '/auth/login', { cuerpo: { email: correo, password: clave } });
  return sesion.accessToken;
}

function lista(datos) {
  return Array.isArray(datos) ? datos : (datos?.items ?? datos?.data ?? []);
}

async function prepararUsuarios(tokenAdmin) {
  const existentes = new Map(lista(await llamar('GET', '/users', { token: tokenAdmin })).map((u) => [u.email.toLowerCase(), u]));
  const ids = {};
  for (const u of USUARIOS) {
    const ya = existentes.get(u.correo);
    if (ya) {
      ids[u.correo] = ya.id;
      console.log(`  = ${u.nombre} ya existía`);
      continue;
    }
    const creado = await llamar('POST', '/users', {
      token: tokenAdmin,
      cuerpo: { name: u.nombre, email: u.correo, role: u.rol, password: CLAVE_INICIAL },
    });
    ids[u.correo] = creado.id;
    // La cuenta nace con contraseña temporal; se cambia por la de la demostración.
    await llamar('POST', '/auth/temporary-password', {
      cuerpo: { email: u.correo, currentPassword: CLAVE_INICIAL, newPassword: CLAVE },
    });
    console.log(`  + ${u.nombre} (${u.rol})`);
  }
  return ids;
}

async function cargarModulos(token) {
  const [programa] = lista(await llamar('GET', '/programs', { token }));
  const modulos = lista(await llamar('GET', `/programs/${programa.id}/modules`, { token }));
  const porPrefijo = {};
  for (const m of modulos) {
    const competencias = lista(await llamar('GET', `/modules/${m.id}/competencies`, { token }));
    porPrefijo[m.competencyPrefix] = { ...m, competencias };
  }
  return porPrefijo;
}

function competenciaDe(modulos, prefijo, numero) {
  const modulo = modulos[prefijo];
  if (!modulo) throw new Error(`No existe el módulo ${prefijo}`);
  const competencia = modulo.competencias[numero - 1];
  if (!competencia) throw new Error(`El módulo ${prefijo} no tiene la competencia ${numero}`);
  return { modulo, competencia };
}

async function prepararGuias(token, modulos) {
  const guias = {};
  for (const g of GUIAS) {
    const { modulo, competencia } = competenciaDe(modulos, g.modulo, g.competencia);
    const existentes = lista(
      await llamar('GET', `/academic/guides?moduleId=${modulo.id}&competencyId=${competencia.id}`, { token }),
    );
    let guia = existentes[0];
    if (guia) {
      console.log(`  = Guía de ${g.modulo} competencia ${g.competencia} ya existía`);
    } else {
      guia = await llamar('POST', '/academic/guides', {
        token,
        cuerpo: { moduleId: modulo.id, competencyId: competencia.id, content: g.contenido },
      });
      if (g.publicar) guia = await llamar('PATCH', `/academic/guides/${guia.id}/publish`, { token });
      console.log(`  + Guía de ${modulo.name}, competencia ${g.competencia} (${g.publicar ? 'publicada' : 'borrador'})`);
    }
    guias[`${g.modulo}-${g.competencia}`] = guia;
  }
  return guias;
}

async function asignarDocentes(token, modulos, ids) {
  for (const [correo, prefijos] of Object.entries(ASIGNACIONES)) {
    for (const p of prefijos) {
      await llamar('PUT', `/academic/modules/${modulos[p].id}/teachers/${ids[correo]}`, { token });
    }
    console.log(`  + ${correo}: ${prefijos.join(', ')}`);
  }
}

async function crearVersiones(guias) {
  for (const v of VERSIONES) {
    const token = await entrar(v.docente, CLAVE);
    const guia = guias[`${v.modulo}-${v.competencia}`];
    const propias = lista(await llamar('GET', '/academic/personalized-versions', { token }));
    if (propias.some((p) => p.name === v.nombre)) {
      console.log(`  = Versión "${v.nombre}" ya existía`);
      continue;
    }
    const version = await llamar('POST', `/academic/guides/${guia.id}/personalized-versions`, {
      token,
      cuerpo: { name: v.nombre },
    });
    const contenido = { ...v.cambios };
    for (const [campo, texto] of Object.entries(v.complementos ?? {})) {
      contenido[campo] = `${String(guia.content[campo]).trim()}\n\n${texto}`;
    }
    await llamar('PATCH', `/academic/personalized-versions/${version.id}`, { token, cuerpo: { content: contenido } });
    console.log(`  + ${v.docente}: "${v.nombre}"`);
  }
}

function enDias(dias) {
  const fecha = new Date(Date.now() + dias * 86_400_000);
  return fecha.toISOString().slice(0, 10);
}

async function crearSugerencias(tokenCoordinacion, guias) {
  for (const s of SUGERENCIAS) {
    const token = await entrar(s.docente, CLAVE);
    const guia = guias[`${s.modulo}-${s.competencia}`];
    let sugerencia;
    try {
      sugerencia = await llamar('POST', `/academic/guides/${guia.id}/suggestions`, {
        token,
        cuerpo: { fieldKey: s.campo, proposedValue: s.valor, justification: s.justificacion, neededBy: enDias(21) },
      });
    } catch (error) {
      if (['SUGGESTION_ALREADY_PENDING', 'ALREADY_PENDING', 'NO_CHANGES'].includes(error.codigo)) {
        console.log(`  = Sugerencia de ${s.docente} ya existía`);
        continue;
      }
      throw error;
    }
    if (s.aprobar) {
      await llamar('PATCH', `/academic/suggestions/${sugerencia.id}/approve`, { token: tokenCoordinacion, cuerpo: {} });
    }
    console.log(`  + ${s.docente} sugiere cambiar "${s.campo}" (${s.aprobar ? 'aprobada' : 'pendiente'})`);
  }
}

async function main() {
  console.log(`API: ${API}`);
  console.log('1. Usuarios');
  const tokenAdmin = await entrar(ADMIN.correo, ADMIN.clave);
  const ids = await prepararUsuarios(tokenAdmin);

  console.log('2. Guías base (coordinadora Laura Gómez)');
  const tokenCoordinacion = await entrar('laura.gomez@gmail.com', CLAVE);
  const modulos = await cargarModulos(tokenCoordinacion);
  const guias = await prepararGuias(tokenCoordinacion, modulos);

  console.log('3. Docentes asignados a módulos');
  await asignarDocentes(tokenCoordinacion, modulos, ids);

  console.log('4. Versiones de los docentes');
  await crearVersiones(guias);

  console.log('5. Sugerencias');
  await crearSugerencias(tokenCoordinacion, guias);

  console.log(`\nListo. Todos los usuarios de la demostración entran con la contraseña ${CLAVE}`);
}

main().catch((error) => {
  console.error(`\nNo se pudo terminar la carga: ${error.message}`);
  if (error.cause) console.error(error.cause.message ?? error.cause);
  console.error('Revisa que el sistema esté encendido y que el correo y la contraseña del administrador sean correctos.');
  process.exit(1);
});
