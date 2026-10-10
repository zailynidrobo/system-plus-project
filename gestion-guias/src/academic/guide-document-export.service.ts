import { Injectable } from '@nestjs/common';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import PDFDocument from 'pdfkit';
import { GuideContent, GuideField } from './academic.entities.js';

export interface GuideDocumentData {
  title: string;
  subtitle: string;
  metadata: Array<{ label: string; value: unknown }>;
  fields: GuideField[];
  content: GuideContent;
  reference?: {
    title: string;
    fields: GuideField[];
    content: GuideContent;
  };
}

@Injectable()
export class GuideDocumentExportService {
  async toDocx(data: GuideDocumentData) {
    const paragraphs = this.toParagraphs(data);
    return Packer.toBuffer(
      new Document({ sections: [{ children: paragraphs }] }),
    );
  }

  toPdf(data: GuideDocumentData) {
    return new Promise<Buffer>((resolve, reject) => {
      const document = new PDFDocument({ size: 'A4', margin: 54 });
      const chunks: Buffer[] = [];
      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.once('error', reject);
      document.once('end', () => resolve(Buffer.concat(chunks)));

      document
        .font('Helvetica-Bold')
        .fontSize(18)
        .text(data.title, { align: 'center' })
        .moveDown(0.35)
        .font('Helvetica')
        .fontSize(10)
        .text(data.subtitle, { align: 'center' })
        .moveDown();

      for (const item of data.metadata) {
        document
          .font('Helvetica-Bold')
          .text(`${item.label}: `, { continued: true })
          .font('Helvetica')
          .text(this.displayValue(item.value));
      }

      if (data.reference) {
        this.writePdfFields(
          document,
          `Referencia institucional · ${data.reference.title}`,
          data.reference.fields,
          data.reference.content,
        );
      }

      this.writePdfFields(document, 'Contenido', data.fields, data.content);
      document.end();
    });
  }

  private toParagraphs(data: GuideDocumentData) {
    const paragraphs = [
      new Paragraph({
        text: data.title,
        heading: HeadingLevel.TITLE,
        alignment: 'center',
      }),
      new Paragraph({
        text: data.subtitle,
        alignment: 'center',
        spacing: { after: 240 },
      }),
    ];

    for (const item of data.metadata) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${item.label}: `, bold: true }),
            new TextRun(this.displayValue(item.value)),
          ],
        }),
      );
    }

    if (data.reference) {
      paragraphs.push(
        ...this.fieldsToParagraphs(
          `Referencia institucional · ${data.reference.title}`,
          data.reference.fields,
          data.reference.content,
        ),
      );
    }
    paragraphs.push(
      ...this.fieldsToParagraphs('Contenido', data.fields, data.content),
    );
    return paragraphs;
  }

  private fieldsToParagraphs(
    title: string,
    fields: GuideField[],
    content: GuideContent,
  ) {
    const paragraphs = [
      new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }),
    ];
    const groups = new Map<string, GuideField[]>();
    for (const field of fields) {
      const section = field.section?.trim() || 'General';
      const group = groups.get(section) ?? [];
      group.push(field);
      groups.set(section, group);
    }

    for (const [section, sectionFields] of groups) {
      paragraphs.push(
        new Paragraph({ text: section, heading: HeadingLevel.HEADING_2 }),
      );
      for (const field of sectionFields) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${field.label}: `, bold: true }),
              new TextRun(this.displayValue(content[field.key])),
            ],
            spacing: { after: 100 },
          }),
        );
      }
    }
    return paragraphs;
  }

  private writePdfFields(
    document: PDFKit.PDFDocument,
    title: string,
    fields: GuideField[],
    content: GuideContent,
  ) {
    document
      .moveDown()
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(title)
      .moveDown(0.35);
    const groups = new Map<string, GuideField[]>();
    for (const field of fields) {
      const section = field.section?.trim() || 'General';
      const group = groups.get(section) ?? [];
      group.push(field);
      groups.set(section, group);
    }

    for (const [section, sectionFields] of groups) {
      document.font('Helvetica-Bold').fontSize(11).text(section).moveDown(0.2);
      for (const field of sectionFields) {
        document
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(`${field.label}: `, { continued: true })
          .font('Helvetica')
          .text(this.displayValue(content[field.key]), { paragraphGap: 5 });
      }
      document.moveDown(0.35);
    }
  }

  private displayValue(value: unknown): string {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean')
      return String(value);
    return JSON.stringify(value);
  }
}
