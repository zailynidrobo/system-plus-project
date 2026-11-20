import JSZip from 'jszip';
import type { GuideContent, GuideField } from './academic.entities.js';

/**
 * Arma el Word de una guía (base o versión docente) a partir de sus datos, sin plantilla:
 * encabezado con el logo, ficha resumen, una sección por cada campo de texto con contenido
 * y el control del documento. El PDF se obtiene convirtiendo este mismo Word.
 */
export interface GuiaDocx {
  /** Código que se muestra arriba a la derecha y en el pie (p. ej. GB-BD-01). */
  codigo: string;
  /** Línea pequeña bajo el código (p. ej. "Versión 1.1" o "Basada en GB-BD-01 v1.1"). */
  detalleCodigo: string;
  /** Etiqueta de estado (p. ej. "Publicada" o "Versión docente"). */
  etiqueta: string;
  titulo: string;
  subtitulo: string;
  programa: string;
  /** Datos de la ficha resumen, además de los campos cortos de la guía. */
  ficha: Array<{ label: string; value: string }>;
  fields: GuideField[];
  content: GuideContent;
  /** Contenido de la guía base, solo en una versión docente: marca lo adaptado y el complemento. */
  base?: GuideContent;
  historial: Array<{
    version: string;
    fecha: string;
    responsable: string;
    cambio: string;
  }>;
  generado: string;
}

const COLOR = {
  azul: '23306B',
  rojo: 'C8372D',
  gris: '5B6275',
  grisClaro: '7A8091',
  borde: 'D8DBE4',
  fondo: 'F6F7FA',
  fondoComplemento: 'FBF3F2',
  texto: '1F2433',
} as const;

/** Ancho útil de una hoja carta con márgenes de 0,75": 12240 - 2 x 1080. */
const ANCHO = 10080;
/** Logo horizontal oficial (1600 x 469 px) de 2" de ancho, con su proporción. */
const LOGO_ANCHO_EMU = 1828800;
const LOGO_ALTO_EMU = Math.round((LOGO_ANCHO_EMU * 469) / 1600);

export async function construirGuiaDocx(
  guia: GuiaDocx,
  logo: Buffer,
): Promise<Buffer> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', TIPOS);
  zip.file('_rels/.rels', RELS);
  zip.file('word/_rels/document.xml.rels', RELS_DOCUMENTO);
  zip.file('word/_rels/header1.xml.rels', RELS_ENCABEZADO);
  zip.file('word/styles.xml', ESTILOS);
  zip.file('word/settings.xml', AJUSTES);
  zip.file('word/media/logo.png', logo);
  zip.file('word/header1.xml', encabezado(guia));
  zip.file('word/footer1.xml', pie(guia));
  zip.file('word/document.xml', documento(guia));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// ---------- Contenido ----------

function documento(guia: GuiaDocx): string {
  const cortos = guia.fields.filter(
    (f) => f.type !== 'textarea' && texto(guia.content[f.key]),
  );
  const largos = guia.fields.filter(
    (f) => f.type === 'textarea' && texto(guia.content[f.key]),
  );

  const cuerpo = [
    parrafo(run(guia.titulo, { tam: 34, negrita: true, color: COLOR.azul }), {
      antes: 120,
      despues: 20,
    }),
    parrafo(run(guia.subtitulo, { tam: 20, color: COLOR.gris }), {
      despues: 200,
    }),
    ficha([
      ...guia.ficha,
      ...cortos.map((f) => ({
        label: f.label,
        value:
          texto(guia.content[f.key]) + (adaptado(guia, f) ? ' (adaptado)' : ''),
      })),
    ]),
    ...largos.flatMap((f, i) => seccion(i + 1, f, guia)),
    ...seccionControl(largos.length + 1, guia),
    parrafo(
      run(`Documento generado por System Plus el ${guia.generado}.`, {
        tam: 16,
        color: COLOR.grisClaro,
      }),
      {
        antes: 160,
      },
    ),
  ].join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${NS}><w:body>${cuerpo}<w:sectPr><w:headerReference w:type="default" r:id="rIdEncabezado"/><w:footerReference w:type="default" r:id="rIdPie"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1900" w:right="1080" w:bottom="1200" w:left="1080" w:header="500" w:footer="500" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}

function seccion(numero: number, campo: GuideField, guia: GuiaDocx): string[] {
  const valor = texto(guia.content[campo.key]);
  const base = guia.base ? texto(guia.base[campo.key]) : '';
  const partes = [titulo(numero, campo.label)];

  if (guia.base && base && valor !== base && valor.startsWith(base)) {
    // Docente autorizado: texto base intacto y su complemento aparte.
    partes.push(...lineas(base));
    partes.push(complemento(valor.slice(base.length).trim()));
  } else {
    if (adaptado(guia, campo)) {
      partes.push(
        parrafo(
          run('Adaptado por el docente', {
            tam: 16,
            color: COLOR.rojo,
            cursiva: true,
          }),
          { despues: 40 },
        ),
      );
    }
    partes.push(...lineas(valor));
  }
  return partes;
}

function seccionControl(numero: number, guia: GuiaDocx): string[] {
  if (!guia.historial.length) return [];
  const anchos = [1500, 1700, 3000, 3880];
  const filas = [
    filaTabla(['Versión', 'Fecha', 'Responsable', 'Cambio'], anchos, {
      encabezado: true,
    }),
    ...guia.historial.map((h) =>
      filaTabla([h.version, h.fecha, h.responsable, h.cambio], anchos),
    ),
  ];
  return [
    titulo(numero, 'Control del documento'),
    tabla(anchos, filas.join(''), { bordesInternos: true }),
  ];
}

function adaptado(guia: GuiaDocx, campo: GuideField): boolean {
  if (!guia.base) return false;
  const base = texto(guia.base[campo.key]);
  const valor = texto(guia.content[campo.key]);
  return Boolean(base) && valor !== base && !valor.startsWith(base);
}

function titulo(numero: number, etiqueta: string): string {
  return `<w:p><w:pPr><w:keepNext/><w:spacing w:before="280" w:after="100"/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="3" w:color="${COLOR.borde}"/></w:pBdr></w:pPr>${run(`${numero}  `, { tam: 22, negrita: true, color: COLOR.rojo })}${run(etiqueta, { tam: 22, negrita: true, color: COLOR.azul })}</w:p>`;
}

function lineas(valor: string): string[] {
  return valor
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => parrafo(run(l), { despues: 60, interlineado: 290 }));
}

function complemento(valor: string): string {
  const bloque = `<w:pPr><w:shd w:val="clear" w:color="auto" w:fill="${COLOR.fondoComplemento}"/><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="${COLOR.rojo}"/></w:pBdr><w:ind w:left="180"/><w:spacing w:before="0" w:after="0"/></w:pPr>`;
  const etiqueta = `<w:p>${bloque.replace('w:before="0"', 'w:before="80"')}${run('COMPLEMENTO DEL DOCENTE', { tam: 15, color: COLOR.rojo, espaciado: 10 })}</w:p>`;
  const textos = valor
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map(
      (l, i, todas) =>
        `<w:p>${i === todas.length - 1 ? bloque.replace('w:after="0"', 'w:after="80"') : bloque}${run(l.trim())}</w:p>`,
    );
  return etiqueta + textos.join('');
}

function ficha(datos: Array<{ label: string; value: string }>): string {
  const columnas = 3;
  const ancho = Math.floor(ANCHO / columnas);
  const anchos = Array(columnas).fill(ancho) as number[];
  const filas: string[] = [];
  for (let i = 0; i < datos.length; i += columnas) {
    const celdas = datos.slice(i, i + columnas);
    while (celdas.length < columnas) celdas.push({ label: '', value: '' });
    filas.push(
      `<w:tr><w:trPr><w:cantSplit/></w:trPr>${celdas
        .map(
          (c) =>
            `<w:tc><w:tcPr><w:tcW w:w="${ancho}" w:type="dxa"/><w:tcMar><w:top w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:left w:w="140" w:type="dxa"/><w:right w:w="140" w:type="dxa"/></w:tcMar></w:tcPr>${parrafo(
              run(c.label.toUpperCase(), {
                tam: 14,
                color: COLOR.grisClaro,
                espaciado: 10,
              }),
              { despues: 20 },
            )}${parrafo(run(c.value), { despues: 0 })}</w:tc>`,
        )
        .join('')}</w:tr>`,
    );
  }
  return (
    tabla(anchos, filas.join(''), {
      bordesInternos: true,
      fondo: COLOR.fondo,
    }) + parrafo('', { despues: 60 })
  );
}

function filaTabla(
  valores: string[],
  anchos: number[],
  opciones: { encabezado?: boolean } = {},
): string {
  const celdas = valores
    .map((v, i) => {
      const relleno = opciones.encabezado
        ? `<w:shd w:val="clear" w:color="auto" w:fill="${COLOR.azul}"/>`
        : '';
      const contenido = opciones.encabezado
        ? run(v, { tam: 17, negrita: true, color: 'FFFFFF' })
        : run(v, { tam: 17 });
      return `<w:tc><w:tcPr><w:tcW w:w="${anchos[i]}" w:type="dxa"/>${relleno}<w:tcMar><w:top w:w="70" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar></w:tcPr>${parrafo(contenido, { despues: 0 })}</w:tc>`;
    })
    .join('');
  const repetir = opciones.encabezado ? '<w:tblHeader/>' : '';
  return `<w:tr><w:trPr><w:cantSplit/>${repetir}</w:trPr>${celdas}</w:tr>`;
}

function tabla(
  anchos: number[],
  filas: string,
  opciones: {
    bordesInternos?: boolean;
    fondo?: string;
    sinBordes?: boolean;
  } = {},
): string {
  const borde = (lado: string) =>
    opciones.sinBordes
      ? `<w:${lado} w:val="nil"/>`
      : `<w:${lado} w:val="single" w:sz="4" w:space="0" w:color="${COLOR.borde}"/>`;
  const internos = opciones.bordesInternos && !opciones.sinBordes;
  const bordes = `<w:tblBorders>${borde('top')}${borde('left')}${borde('bottom')}${borde('right')}${
    internos
      ? borde('insideH') + borde('insideV')
      : '<w:insideH w:val="nil"/><w:insideV w:val="nil"/>'
  }</w:tblBorders>`;
  const fondo = opciones.fondo
    ? `<w:shd w:val="clear" w:color="auto" w:fill="${opciones.fondo}"/>`
    : '';
  const total = anchos.reduce((a, b) => a + b, 0);
  return `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/><w:tblLayout w:type="fixed"/>${bordes}${fondo}<w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${anchos
    .map((a) => `<w:gridCol w:w="${a}"/>`)
    .join('')}</w:tblGrid>${filas}</w:tbl>`;
}

// ---------- Encabezado y pie ----------

function encabezado(guia: GuiaDocx): string {
  const anchos = [3100, 3680, 3300];
  const logo = `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${LOGO_ANCHO_EMU}" cy="${LOGO_ALTO_EMU}"/><wp:docPr id="1" name="Logo System Plus"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${LOGO_ANCHO_EMU}" cy="${LOGO_ALTO_EMU}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  const celda = (ancho: number, contenido: string) =>
    `<w:tc><w:tcPr><w:tcW w:w="${ancho}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${contenido}</w:tc>`;
  const fila = `<w:tr>${celda(anchos[0], parrafo(logo, { despues: 0 }))}${celda(
    anchos[1],
    parrafo(
      run('Sede Piendamó', { tam: 20, negrita: true, color: COLOR.azul }),
      { despues: 20 },
    ) +
      parrafo(run(guia.programa, { tam: 17, color: COLOR.gris }), {
        despues: 0,
      }),
  )}${celda(
    anchos[2],
    parrafo(run(guia.codigo, { tam: 20, negrita: true, color: COLOR.azul }), {
      despues: 10,
      alineacion: 'right',
    }) +
      parrafo(run(guia.detalleCodigo, { tam: 16, color: COLOR.gris }), {
        despues: 10,
        alineacion: 'right',
      }) +
      parrafo(run(guia.etiqueta, { tam: 16, negrita: true, color: '2E7D4F' }), {
        despues: 0,
        alineacion: 'right',
      }),
  )}</w:tr>`;
  const linea = `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="18" w:space="1" w:color="${COLOR.rojo}"/></w:pBdr><w:spacing w:before="0" w:after="0"/><w:rPr><w:sz w:val="4"/></w:rPr></w:pPr></w:p>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr ${NS}>${tabla(anchos, fila, { sinBordes: true })}${linea}</w:hdr>`;
}

function pie(guia: GuiaDocx): string {
  const campo = (instruccion: string) =>
    `<w:r><w:rPr><w:sz w:val="15"/><w:color w:val="${COLOR.grisClaro}"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:sz w:val="15"/><w:color w:val="${COLOR.grisClaro}"/></w:rPr><w:instrText xml:space="preserve"> ${instruccion} </w:instrText></w:r><w:r><w:rPr><w:sz w:val="15"/><w:color w:val="${COLOR.grisClaro}"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr><w:sz w:val="15"/><w:color w:val="${COLOR.grisClaro}"/></w:rPr><w:t>1</w:t></w:r><w:r><w:rPr><w:sz w:val="15"/><w:color w:val="${COLOR.grisClaro}"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>`;
  const estilo = { tam: 15, color: COLOR.grisClaro };
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr ${NS}><w:p><w:pPr><w:pBdr><w:top w:val="single" w:sz="4" w:space="4" w:color="${COLOR.borde}"/></w:pBdr><w:tabs><w:tab w:val="right" w:pos="${ANCHO}"/></w:tabs><w:spacing w:after="0"/></w:pPr>${run(
    `System Plus Piendamó · ${guia.titulo} · ${guia.codigo}`,
    estilo,
  )}<w:r><w:tab/></w:r>${run('Página ', estilo)}${campo('PAGE')}${run(' de ', estilo)}${campo('NUMPAGES')}</w:p></w:ftr>`;
}

// ---------- Utilidades XML ----------

interface Formato {
  tam?: number;
  negrita?: boolean;
  cursiva?: boolean;
  color?: string;
  espaciado?: number;
}

function run(valor: string, formato: Formato = {}): string {
  const propiedades = [
    formato.negrita ? '<w:b/>' : '',
    formato.cursiva ? '<w:i/>' : '',
    formato.color ? `<w:color w:val="${formato.color}"/>` : '',
    formato.espaciado ? `<w:spacing w:val="${formato.espaciado}"/>` : '',
    formato.tam
      ? `<w:sz w:val="${formato.tam}"/><w:szCs w:val="${formato.tam}"/>`
      : '',
  ].join('');
  return `<w:r>${propiedades ? `<w:rPr>${propiedades}</w:rPr>` : ''}<w:t xml:space="preserve">${escapar(valor)}</w:t></w:r>`;
}

function parrafo(
  contenido: string,
  opciones: {
    antes?: number;
    despues?: number;
    interlineado?: number;
    alineacion?: 'right' | 'center';
  } = {},
): string {
  const espacio = `<w:spacing w:before="${opciones.antes ?? 0}" w:after="${opciones.despues ?? 80}"${
    opciones.interlineado
      ? ` w:line="${opciones.interlineado}" w:lineRule="auto"`
      : ''
  }/>`;
  const alineacion = opciones.alineacion
    ? `<w:jc w:val="${opciones.alineacion}"/>`
    : '';
  return `<w:p><w:pPr>${espacio}${alineacion}</w:pPr>${contenido}</w:p>`;
}

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (Array.isArray(valor))
    return valor
      .map((v) => texto(v))
      .filter(Boolean)
      .join('\n');
  return String(valor).trim();
}

function escapar(valor: string): string {
  return valor
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';

const TIPOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

const RELS_DOCUMENTO = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdEstilos" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdAjustes" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rIdEncabezado" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rIdPie" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`;

const RELS_ENCABEZADO = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/></Relationships>`;

const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:color w:val="${COLOR.texto}"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="es-CO"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="table" w:default="1" w:styleId="TablaNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`;

const AJUSTES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/></w:settings>`;
