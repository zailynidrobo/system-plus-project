import { FindOperator, Raw } from 'typeorm';

// Búsqueda que ignora mayúsculas y tildes: "programacion" encuentra "Programación".
// Se usa translate() de PostgreSQL para no depender de la extensión unaccent.
const CON_TILDE = 'áàäâãéèëêíìïîóòöôõúùüûñç';
const SIN_TILDE = 'aaaaaeeeeiiiiooooouuuunc';

let secuencia = 0;

/** Quita tildes y pasa a minúsculas, igual que hace la base con sqlSinTildes. */
export function normalizarBusqueda(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Expresión SQL de la columna sin tildes y en minúsculas. */
export function sqlSinTildes(expresion: string): string {
  return `translate(lower(${expresion}), '${CON_TILDE}', '${SIN_TILDE}')`;
}

/** Patrón LIKE "contiene" con los comodines del usuario escapados. */
export function patronContiene(texto: string): string {
  return `%${normalizarBusqueda(texto.trim()).replace(/[\\%_]/g, '\\$&')}%`;
}

/** Condición para find/where de TypeORM: la columna contiene el texto, sin importar tildes. */
export function contieneSinTildes(texto: string): FindOperator<string> {
  const parametro = `busqueda_${++secuencia}`;
  return Raw((columna) => `${sqlSinTildes(columna)} LIKE :${parametro}`, {
    [parametro]: patronContiene(texto),
  });
}
