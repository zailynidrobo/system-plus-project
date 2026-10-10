import { GuideDocumentExportService } from './guide-document-export.service.js';

describe('GuideDocumentExportService', () => {
  const service = new GuideDocumentExportService();
  const data = {
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
  });

  it('generates a PDF using the institutional snapshot and editable fields', async () => {
    const output = await service.toPdf(data);

    expect(output.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
