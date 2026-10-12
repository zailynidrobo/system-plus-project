import { GuideDocumentExportService } from './guide-document-export.service.js';
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
  const data = {
    template: 'teacher' as const,
    title: 'GUÍA DOCENTE',
    subtitle: 'Plantilla B · Módulo de prueba',
    metadata: [{ label: 'Módulo', value: 'Ciencias' }],
    reference: {
      title: 'Guía base del módulo',
      fields: [
        {
          key: 'objective',
          label: 'Objetivo institucional',
          type: 'text' as const,
          required: true,
        },
      ],
      content: { objective: 'Comprender los ecosistemas' },
    },
    fields: [
      {
        key: 'lessonPlan',
        label: 'Plan de clases',
        type: 'textarea' as const,
        required: false,
        section: 'Planeación',
      },
    ],
    content: { lessonPlan: 'Clase 1: práctica guiada' },
  };

  it('generates a DOCX using the dynamic sections and values', async () => {
    const output = await service.toDocx(data);

    expect(output.subarray(0, 2).toString()).toBe('PK');
    const archive = await JSZip.loadAsync(output);
    const documentXml = await archive
      .file('word/document.xml')
      ?.async('string');
    expect(documentXml).toContain('GUÍA DOCENTE');
    expect(documentXml).toContain('Comprender los ecosistemas');
    expect(documentXml).toContain('Clase 1: práctica guiada');
  });

  it('fills the provided base-module Word template', async () => {
    const output = await service.toDocx({
      ...data,
      template: 'base',
      title: 'Guía de bases de datos',
      metadata: [
        { label: 'Módulo', value: 'Bases de datos' },
        { label: 'Competencia', value: 'Administrar información' },
      ],
      fields: data.reference.fields,
      content: data.reference.content,
    });
    const archive = await JSZip.loadAsync(output);
    const documentXml = await archive
      .file('word/document.xml')
      ?.async('string');

    expect(documentXml).toContain('Bases de datos');
    expect(documentXml).toContain('Administrar información');
    expect(documentXml).toContain('Guía de bases de datos');
    expect(documentXml).toContain('Comprender los ecosistemas');
    expect(documentXml).not.toContain('Nombre completo del módulo');
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
        expect(documentXml).toContain('Clase 1: práctica guiada');

        const outputDirectory = args[args.indexOf('--outdir') + 1];
        await writeFile(join(outputDirectory, 'guia.pdf'), expectedPdf);
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
