import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';

/** Nombre en español de cada campo que reciben los DTO, para los mensajes de validación (DEF-10). */
const CAMPOS: Record<string, string> = {
  name: 'nombre', email: 'correo electrónico', password: 'contraseña', currentPassword: 'contraseña actual',
  newPassword: 'contraseña nueva', refreshToken: 'token de sesión', role: 'rol', description: 'descripción',
  title: 'título', content: 'contenido', competencyId: 'competencia', moduleId: 'módulo', fields: 'campos',
  fieldKey: 'campo', key: 'clave', label: 'etiqueta', help: 'ayuda', section: 'sección', type: 'tipo',
  options: 'opciones', required: 'obligatorio', maxLength: 'longitud máxima', teacherEditable: 'editable por el docente',
  draft: 'borrador', proposedValue: 'cambio propuesto', justification: 'justificación', neededBy: 'fecha requerida',
  reason: 'motivo', feedback: 'comentario', message: 'mensaje', startsAt: 'fecha de inicio', endsAt: 'fecha de fin',
  dueBusinessDays: 'días hábiles de plazo', dueSoonBusinessDays: 'días hábiles de aviso', expectedUpdatedAt: 'fecha de la versión editada',
  text: 'texto', code: 'código', hours: 'intensidad horaria', roles: 'roles',
};

/** Orden en que se elige el motivo cuando un campo incumple varias reglas: primero lo más básico. */
const PRIORIDAD = ['isDefined', 'isNotEmpty', 'isString', 'isInt', 'isNumber', 'isBoolean', 'isArray', 'isObject',
  'isEmail', 'isUUID', 'isDateString', 'isEnum', 'isIn', 'matches', 'minLength', 'maxLength', 'min', 'max', 'arrayMinSize'];

const TRADUCCION: Record<string, (campo: string, e: ValidationError) => string> = {
  isDefined: (c) => `El campo ${c} es obligatorio`,
  isNotEmpty: (c) => `El campo ${c} es obligatorio`,
  isString: (c) => `El campo ${c} debe ser un texto`,
  isInt: (c) => `El campo ${c} debe ser un número entero`,
  isNumber: (c) => `El campo ${c} debe ser un número`,
  isBoolean: (c) => `El campo ${c} debe ser verdadero o falso`,
  isArray: (c) => `El campo ${c} debe ser una lista`,
  isObject: (c) => `El campo ${c} no tiene el formato esperado`,
  isEmail: (c) => `El campo ${c} no tiene un formato de correo válido`,
  isUUID: (c) => `El campo ${c} no es un identificador válido`,
  isDateString: (c) => `El campo ${c} debe ser una fecha válida`,
  isEnum: (c) => `El valor del campo ${c} no es una opción válida`,
  isIn: (c) => `El valor del campo ${c} no es una opción válida`,
  matches: (c) => `El campo ${c} no tiene el formato esperado`,
  minLength: (c, e) => `El campo ${c} es demasiado corto${limite(e, 'minLength', ' (mínimo ', ' caracteres)')}`,
  maxLength: (c, e) => `El campo ${c} es demasiado largo${limite(e, 'maxLength', ' (máximo ', ' caracteres)')}`,
  min: (c, e) => `El campo ${c} es menor que el permitido${limite(e, 'min', ' (mínimo ', ')')}`,
  max: (c, e) => `El campo ${c} supera el máximo permitido${limite(e, 'max', ' (máximo ', ')')}`,
  arrayMinSize: (c) => `El campo ${c} debe tener al menos un elemento`,
  whitelistValidation: (c) => `El campo ${c} no está permitido`,
};

function limite(e: ValidationError, regla: string, antes: string, despues: string): string {
  const numero = /(\d+)/.exec(e.constraints?.[regla] ?? '')?.[1];
  return numero ? `${antes}${numero}${despues}` : '';
}

/** Los mensajes por defecto de class-validator empiezan por el nombre del campo, en inglés. */
function esMensajePorDefecto(mensaje: string, propiedad: string): boolean {
  return mensaje.startsWith(`${propiedad} `) || mensaje.startsWith(`each value in ${propiedad}`) || mensaje.startsWith('property ');
}

/** Un mensaje en español por campo, con el motivo (RNF-15, DEF-10). */
export function mensajesDeValidacion(errores: ValidationError[], prefijo = ''): string[] {
  const mensajes: string[] = [];
  for (const error of errores) {
    const ruta = prefijo ? `${prefijo}.${error.property}` : error.property;
    if (error.constraints) {
      const reglas = Object.keys(error.constraints);
      const regla = PRIORIDAD.find((r) => reglas.includes(r)) ?? reglas[0];
      const original = error.constraints[regla];
      const campo = CAMPOS[error.property] ?? error.property;
      const traducir = TRADUCCION[regla];
      mensajes.push(esMensajePorDefecto(original, error.property) && traducir ? traducir(campo, error) : original);
    }
    if (error.children?.length) mensajes.push(...mensajesDeValidacion(error.children, ruta));
  }
  return mensajes;
}

/** ValidationPipe de toda la API: descarta campos desconocidos y responde en español. */
export function crearValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    exceptionFactory: (errores) =>
      new BadRequestException({ statusCode: 400, error: 'Bad Request', message: mensajesDeValidacion(errores) }),
  });
}
