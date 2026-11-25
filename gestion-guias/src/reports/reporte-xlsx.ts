import JSZip from 'jszip';

/**
 * Arma un Excel (.xlsx) sin librerías externas: el formato es un ZIP de XML, igual que el
 * Word de las guías. El PDF del reporte se obtiene convirtiendo este mismo Excel con LibreOffice.
 */
export interface Columna {
  titulo: string;
  ancho: number;
  numero?: boolean;
}

export interface Hoja {
  nombre: string;
  /** Primera línea: título; las siguientes: subtítulos (fecha, período). */
  encabezado: string[];
  /** Pares etiqueta-valor que se muestran antes de la tabla. */
  resumen?: Array<[string, string | number]>;
  columnas: Columna[];
  filas: Array<Array<string | number | null>>;
  /** Texto cuando la tabla no tiene filas. */
  vacio?: string;
}

const ESTILO = {
  normal: 0,
  titulo: 1,
  subtitulo: 2,
  cabecera: 3,
  celda: 4,
  numero: 5,
  etiqueta: 6,
} as const;

const escapar = (texto: string) =>
  texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Caracteres de control no válidos en XML.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

const letra = (indice: number) => {
  let n = indice + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

function celda(
  fila: number,
  columna: number,
  valor: string | number | null,
  estilo: number,
) {
  const ref = `${letra(columna)}${fila}`;
  if (valor === null || valor === '') return `<c r="${ref}" s="${estilo}"/>`;
  if (typeof valor === 'number')
    return `<c r="${ref}" s="${estilo}"><v>${valor}</v></c>`;
  return `<c r="${ref}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${escapar(valor)}</t></is></c>`;
}

function hojaXml(hoja: Hoja): string {
  const filas: string[] = [];
  const unir: string[] = [];
  let n = 0;
  const ultima = letra(hoja.columnas.length - 1);
  const fila = (celdas: string[], alto?: number) => {
    n += 1;
    filas.push(
      `<row r="${n}"${alto ? ` ht="${alto}" customHeight="1"` : ''}>${celdas.join('')}</row>`,
    );
  };

  hoja.encabezado.forEach((texto, i) => {
    fila(
      [celda(n + 1, 0, texto, i === 0 ? ESTILO.titulo : ESTILO.subtitulo)],
      i === 0 ? 24 : undefined,
    );
    unir.push(`A${n}:${ultima}${n}`);
  });
  fila([]);
  // Resumen: la etiqueta ocupa las dos primeras columnas y el valor va en la tercera.
  for (const [etiqueta, valor] of hoja.resumen ?? []) {
    fila([
      celda(n + 1, 0, etiqueta, ESTILO.etiqueta),
      celda(n + 1, 1, null, ESTILO.etiqueta),
      celda(
        n + 1,
        2,
        valor,
        typeof valor === 'number' ? ESTILO.numero : ESTILO.celda,
      ),
    ]);
    unir.push(`A${n}:B${n}`);
  }
  if (hoja.resumen?.length) fila([]);
  fila(
    hoja.columnas.map((c, i) => celda(n + 1, i, c.titulo, ESTILO.cabecera)),
    32,
  );
  if (!hoja.filas.length) {
    fila([
      celda(
        n + 1,
        0,
        hoja.vacio ?? 'Sin datos para mostrar.',
        ESTILO.subtitulo,
      ),
    ]);
    unir.push(`A${n}:${ultima}${n}`);
  }
  for (const datos of hoja.filas) {
    fila(
      datos.map((valor, i) =>
        celda(
          n + 1,
          i,
          valor,
          hoja.columnas[i]?.numero ? ESTILO.numero : ESTILO.celda,
        ),
      ),
    );
  }

  const cols = hoja.columnas
    .map(
      (c, i) =>
        `<col min="${i + 1}" max="${i + 1}" width="${c.ancho}" customWidth="1"/>`,
    )
    .join('');
  const merges = unir.length
    ? `<mergeCells count="${unir.length}">${unir.map((r) => `<mergeCell ref="${r}"/>`).join('')}</mergeCells>`
    : '';
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
    `<cols>${cols}</cols><sheetData>${filas.join('')}</sheetData>${merges}` +
    '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>' +
    '<pageSetup paperSize="1" orientation="landscape" fitToWidth="1" fitToHeight="0"/>' +
    '<headerFooter><oddFooter>&amp;LSystem Plus · AthenaDev&amp;RPágina &amp;P de &amp;N</oddFooter></headerFooter>' +
    '</worksheet>'
  );
}

const ESTILOS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="5">' +
  '<font><sz val="10"/><name val="Arial"/></font>' +
  '<font><b/><sz val="14"/><color rgb="FF23306B"/><name val="Arial"/></font>' +
  '<font><i/><sz val="9"/><color rgb="FF5B6275"/><name val="Arial"/></font>' +
  '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>' +
  '<font><b/><sz val="10"/><color rgb="FF1F2433"/><name val="Arial"/></font>' +
  '</fonts>' +
  '<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF23306B"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFEEF0F6"/></patternFill></fill></fills>' +
  '<borders count="2"><border/><border><left style="thin"><color rgb="FFBFC4D1"/></left><right style="thin"><color rgb="FFBFC4D1"/></right>' +
  '<top style="thin"><color rgb="FFBFC4D1"/></top><bottom style="thin"><color rgb="FFBFC4D1"/></bottom></border></borders>' +
  '<cellStyleXfs count="1"><xf/></cellStyleXfs>' +
  '<cellXfs count="7">' +
  '<xf fontId="0"/>' +
  '<xf fontId="1" applyFont="1"/>' +
  '<xf fontId="2" applyFont="1"/>' +
  '<xf fontId="3" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
  '<xf fontId="0" borderId="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '<xf fontId="0" borderId="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>' +
  '<xf fontId="4" fillId="3" borderId="1" applyFont="1" applyFill="1" applyBorder="1"/>' +
  '</cellXfs></styleSheet>';

export async function construirXlsx(hojas: Hoja[]): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      hojas
        .map(
          (_, i) =>
            `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
        )
        .join('') +
      '</Types>',
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>',
  );
  zip.file(
    'xl/workbook.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      hojas
        .map(
          (h, i) =>
            `<sheet name="${escapar(h.nombre.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
        )
        .join('') +
      '</sheets></workbook>',
  );
  zip.file(
    'xl/_rels/workbook.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      hojas
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
        )
        .join('') +
      `<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      '</Relationships>',
  );
  zip.file('xl/styles.xml', ESTILOS);
  hojas.forEach((hoja, i) =>
    zip.file(`xl/worksheets/sheet${i + 1}.xml`, hojaXml(hoja)),
  );
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
