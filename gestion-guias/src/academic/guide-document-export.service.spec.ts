import {
  GuideDocumentExportService,
  type GuideDocumentData,
} from './guide-document-export.service.js';
import JSZip from 'jszip';
import { join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { vi } from 'vitest';

const mockExecFile = vi.hoisted(() =>
  vi.fn<
    (
      executable: string,
      args: string[],
      options: { timeout: number },
      callback: (error: NodeJS.ErrnoException | null) => void,
    ) => void
  >(),
);

vi.mock('node:child_process', async (importOriginal) => {
  const childProcess =
    await importOriginal<typeof import('node:child_process')>();
  return { ...childProcess, execFile: mockExecFile };
});

describe('GuideDocumentExportService', () => {
  const service = new GuideDocumentExportService();
  const data: GuideDocumentData = {
    nombreArchivo: 'Grupo B - GB-BD-01',
    codigo: 'Grupo B',
    detalleCodigo: 'Basada en GB-BD-01 v1.1',
    etiqueta: 'Versión docente',
    titulo: 'Guía de aprendizaje · Bases de Datos',
    subtitulo: 'BD-01 · Diseña modelos de datos',
    programa: 'Técnico en Sistemas',
    ficha: [
      { label: 'Docente', value: 'Ana Gómez' },
      { label: 'Grupo', value: 'Grupo B' },
    ],
    fields: [
      {
        key: 'evaluacion',
        label: 'Tipo de evaluación',
        type: 'select',
        required: true,
        options: ['Por proyecto', 'Mixta'],
      },
      {
        key: 'objetivos',
        label: 'Objetivos de aprendizaje',
        type: 'textarea',
        required: true,
      },
      {
        key: 'metodologia',
        label: 'Metodología',
        type: 'textarea',
        required: false,
      },
      { key: 'recursos', label: 'Recursos', type: 'textarea', required: false },
    ],
    content: {
      evaluacion: 'Mixta',
      objetivos:
        'Comprender los ecosistemas\n\nIncluye un caso local <empresa & cia>.',
      metodologia: 'Clase 1: práctica guiada',
      recursos: '',
    },
    base: {
      evaluacion: 'Por proyecto',
      objetivos: 'Comprender los ecosistemas',
      metodologia: 'Clase magistral',
    },
    historial: [
      {
        version: 'Base 1.1',
        fecha: '16 nov 2026',
        responsable: 'Laura Gómez',
        cambio: 'Sugerencia aprobada',
      },
    ],
    generado: '18 nov 2026',
  };

  async function partes() {
    const archive = await JSZip.loadAsync(await service.toDocx(data));
    const leer = (ruta: string) =>
      archive.file(ruta)?.async('string') ?? Promise.resolve('');
    return {
      archive,
      documento: await leer('word/document.xml'),
      encabezado: await leer('word/header1.xml'),
      pie: await leer('word/footer1.xml'),
    };
  }

  it('arma el Word con la ficha, una sección por campo de texto y el control del documento', async () => {
    const { documento } = await partes();
    expect(documento).toContain('Guía de aprendizaje · Bases de Datos');
    expect(documento).toContain('Ana Gómez');
    expect(documento).toContain('Mixta (adaptado)');
    expect(documento).toContain('1  ');
    expect(documento).toContain('Objetivos de aprendizaje');
    expect(documento).toContain('Clase 1: práctica guiada');
    expect(documento).toContain('Adaptado por el docente');
    expect(documento).toContain('Control del documento');
    expect(documento).toContain('Sugerencia aprobada');
    // Sin textos de ayuda de plantilla ni secciones vacías.
    expect(documento).not.toContain('Recursos');
    expect(documento).not.toContain('Ej.:');
  });

  it('separa el texto base del complemento del docente autorizado y escapa el texto', async () => {
    const { documento } = await partes();
    expect(documento).toContain('COMPLEMENTO DEL DOCENTE');
    expect(documento).toContain(
      'Incluye un caso local &lt;empresa &amp; cia&gt;.',
    );
  });

  it('pone el logo oficial como PNG real, con su proporción, y el código en encabezado y pie', async () => {
    const { archive, encabezado, pie } = await partes();
    expect(encabezado).toContain('Sede Piendamó');
    expect(encabezado).toContain('Basada en GB-BD-01 v1.1');
    expect(encabezado).toContain('cx="1828800" cy="536067"');
    expect(pie).toContain('NUMPAGES');
    const logo = await archive.file('word/media/logo.png')?.async('nodebuffer');
    expect(logo?.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
  });

  it('generates a PDF using the institutional snapshot and editable fields', async () => {
    const expectedPdf = Buffer.from('%PDF-1.7\nconverted document');
    mockExecFile.mockImplementation((_executable, args, _options, callback) => {
      void (async () => {
        const inputPath = args[args.length - 1];
        const archive = await JSZip.loadAsync(await readFile(inputPath));
        const documentXml = await archive
          .file('word/document.xml')
          ?.async('string');
        expect(documentXml).toContain('Comprender los ecosistemas');

        const outputDirectory = args[args.indexOf('--outdir') + 1];
        await writeFile(join(outputDirectory, 'documento.pdf'), expectedPdf);
      })().then(
        () => callback(null),
        (error: unknown) =>
          callback(
            error instanceof Error
              ? error
              : new Error('No se pudo simular la conversión'),
          ),
      );
    });

    const output = await service.toPdf(data);

    expect(output).toEqual(expectedPdf);
    expect(mockExecFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['--headless', '--convert-to', 'pdf']),
      expect.objectContaining({ timeout: 120_000 }),
      expect.any(Function),
    );
  });

  it('explains when LibreOffice is not installed or configured', async () => {
    mockExecFile.mockImplementationOnce(
      (_executable, _args, _options, callback) => {
        callback(Object.assign(new Error('not found'), { code: 'ENOENT' }));
      },
    );

    await expect(service.toPdf(data)).rejects.toThrow(
      'No se encontró LibreOffice. Instálalo o configura LIBREOFFICE_PATH con la ruta a soffice.exe.',
    );
  });
});
