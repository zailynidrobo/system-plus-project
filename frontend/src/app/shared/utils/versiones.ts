import { Guide, GuideEvent } from '../models/guide';
import { GuideContent, GuideValue } from '../models/guide-field';
import { GuideVersionDetail, HistorialVersiones, ResumenVersiones } from '../models/guide-version';
import { Suggestion } from '../models/suggestion';

const texto = (v: GuideValue | undefined) => (v === null || v === undefined ? '' : String(v).trim());

// arma las versiones con los eventos y las sugerencias aprobadas, solo lo usa el mock
// los borradores muestran el contenido de la primera publicacion porque el mock no guardo el de ellos
export function construirVersiones(guia: Guide, eventos: GuideEvent[], aprobadas: Suggestion[]): GuideVersionDetail[] {
  const ordenados = [...eventos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const previos = ordenados.filter((e) => e.titulo !== 'Guía publicada' && !e.titulo.startsWith('Sugerencia '));
  const decididas = aprobadas
    .filter((s) => s.decidedAt)
    .sort((a, b) => (a.decidedAt ?? '').localeCompare(b.decidedAt ?? ''));

  const base = { fields: guia.fields, structureVersion: guia.structureVersion };

  const publicadas: GuideVersionDetail[] = [];
  if (guia.status === 'Publicada') {
    const contenidos: GuideContent[] = [];
    let siguiente: GuideContent = structuredClone(guia.content);
    for (let i = decididas.length - 1; i >= 0; i--) {
      contenidos[i + 1] = structuredClone(siguiente);
      siguiente = { ...siguiente, [decididas[i].fieldKey]: structuredClone(decididas[i].currentValue) };
    }
    contenidos[0] = siguiente;

    publicadas.push({
      ...base,
      version: decididas.length === 0 ? guia.version : 'v1.0',
      estado: 'Anterior',
      descripcion: 'Primera publicación oficial de la guía.',
      autor: guia.publishedBy?.name ?? '',
      fecha: guia.publishedAt ?? guia.createdAt,
      publicacion: true,
      content: contenidos[0],
      publicadaEl: guia.publishedAt,
      publicadaPor: guia.publishedBy?.name ?? null,
    });
    decididas.forEach((s, i) => {
      publicadas.push({
        ...base,
        version: s.resultingVersion ?? guia.version,
        estado: 'Anterior',
        descripcion: `Sugerencia ${s.code} de ${s.teacherName}: cambio en «${s.fieldLabel}».`,
        autor: s.decidedBy?.name ?? '',
        fecha: s.decidedAt ?? guia.updatedAt,
        publicacion: true,
        content: contenidos[i + 1],
        publicadaEl: s.decidedAt,
        publicadaPor: s.decidedBy?.name ?? null,
      });
    });
    publicadas[publicadas.length - 1].estado = 'Vigente';
  }

  const contenidoBorradores = publicadas[0]?.content ?? guia.content;
  const borradores: GuideVersionDetail[] = previos.map((e, i) => ({
    ...base,
    version: `v0.${i + 1}`,
    estado: 'Borrador',
    descripcion: i === 0 ? `Creación de la guía con estructura v${guia.structureVersion}.` : `${e.titulo}.`,
    autor: e.autor,
    fecha: e.fecha,
    publicacion: false,
    content: structuredClone(contenidoBorradores),
    publicadaEl: null,
    publicadaPor: null,
  }));

  return [...borradores, ...publicadas].reverse();
}

export function resumirVersiones(versiones: GuideVersionDetail[]): HistorialVersiones {
  const resumen: ResumenVersiones = {
    registradas: versiones.length,
    publicaciones: versiones.filter((v) => v.publicacion).length,
    editores: new Set(versiones.map((v) => v.autor)).size,
    ultimaModificacion: versiones.reduce((max, v) => (v.fecha > max ? v.fecha : max), ''),
  };
  return {
    items: versiones.map((v) => ({
      version: v.version,
      estado: v.estado,
      descripcion: v.descripcion,
      autor: v.autor,
      fecha: v.fecha,
      publicacion: v.publicacion,
    })),
    resumen,
  };
}

export interface Diferencia {
  inicio: string;
  cambio: string;
  fin: string;
}

// marca lo que cambio entre dos textos, palabra por palabra
export function diferencia(antes: string, despues: string): Diferencia {
  if (antes === despues) return { inicio: despues, cambio: '', fin: '' };
  const a = antes.split(/(\s+)/);
  const d = despues.split(/(\s+)/);
  let i = 0;
  while (i < a.length && i < d.length && a[i] === d[i]) i++;
  let j = 0;
  while (j < a.length - i && j < d.length - i && a[a.length - 1 - j] === d[d.length - 1 - j]) j++;
  return {
    inicio: d.slice(0, i).join(''),
    cambio: d.slice(i, d.length - j).join(''),
    fin: d.slice(d.length - j).join(''),
  };
}

export { texto as textoDeValor };
