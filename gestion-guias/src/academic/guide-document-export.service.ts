import { Injectable } from '@nestjs/common';
import JSZip from 'jszip';
import { execFile as execFileCallback } from 'node:child_process';
import { access, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { GuideContent, GuideField } from './academic.entities.js';

const execFile = promisify(execFileCallback);

const COLORS = {
  primary: '1F4E79',
  accent: '2F75A5',
} as const;

export interface GuideDocumentData {
  template: 'base' | 'teacher';
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
    const templateName =
      data.template === 'base' ? 'guia-base-modulo.docx' : 'guia-docente.docx';
    const template = await readFile(
      fileURLToPath(new URL(`./templates/${templateName}`, import.meta.url)),
    );
    const archive = await JSZip.loadAsync(template);
    const documentFile = archive.file('word/document.xml');
    if (!documentFile) {
      throw new Error(`La plantilla ${templateName} no contiene document.xml`);
    }

    const documentXml = await documentFile.async('string');
    const populatedXml = this.populateTemplate(documentXml, data);
    archive.file('word/document.xml', populatedXml);
    await this.populateLogo(archive);
    for (const fileName of Object.keys(archive.files)) {
      if (!/^word\/header\d+\.xml$/.test(fileName)) continue;
      const header = archive.file(fileName);
      if (!header) continue;
      const headerXml = await header.async('string');
      archive.file(fileName, this.populateHeader(headerXml, data));
    }
    return archive.generateAsync({ type: 'nodebuffer' });
  }

  async toPdf(data: GuideDocumentData) {
    const docx = await this.toDocx(data);
    const tempDirectory = await mkdtemp(join(tmpdir(), 'gestion-guias-'));
    const inputPath = join(tempDirectory, 'guia.docx');
    const outputPath = join(tempDirectory, 'guia.pdf');
    const profilePath = pathToFileURL(join(tempDirectory, 'profile')).href;
    const libreOfficePath =
      process.env.LIBREOFFICE_PATH ??
      (process.platform === 'win32' ? 'soffice.com' : 'soffice');

    try {
      await writeFile(inputPath, docx);
      try {
        const conversion = await execFile(
          libreOfficePath,
          [
            '--headless',
            `-env:UserInstallation=${profilePath}`,
            '--convert-to',
            'pdf',
            '--outdir',
            tempDirectory,
            inputPath,
          ],
          { timeout: 120_000 },
        );
        try {
          await access(outputPath);
        } catch (error) {
          const files = await readdir(tempDirectory).catch(() => []);
          throw new Error(
            `LibreOffice no generó el PDF. Archivos producidos: ${files.join(', ') || 'ninguno'}. ${conversion.stderr || conversion.stdout || 'Sin diagnóstico.'}`,
            { cause: error },
          );
        }
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'ENOENT'
        ) {
          throw new Error(
            'No se encontró LibreOffice. Instálalo o configura LIBREOFFICE_PATH con la ruta a soffice.exe.',
            { cause: error },
          );
        }
        throw error;
      }
      return await readFile(outputPath);
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  }

  private populateTemplate(xml: string, data: GuideDocumentData) {
    const metadata = (label: string) =>
      data.metadata.find(
        (item) => this.normalize(item.label) === this.normalize(label),
      )?.value;
    const fieldValue = (pattern: RegExp) => {
      const field = data.fields.find((item) =>
        pattern.test(this.normalize(`${item.key} ${item.label}`)),
      );
      return field ? data.content[field.key] : undefined;
    };
    const version = metadata('Versión');
    if (version !== undefined) {
      xml = this.replaceParagraphText(xml, /Plantilla\s+[AB]\s*·/i, `${data.subtitle} · Versión: ${this.displayValue(version)}`);
      xml = this.replaceParagraphText(xml, /^Versión\s*:/i, `Versión: ${this.displayValue(version)}`);
    }

    if (data.template === 'base') {
      xml = this.fillRowByLabel(
        xml,
        'Nombre del módulo',
        1,
        metadata('Módulo'),
      );
      xml = this.fillRowByLabel(
        xml,
        'Descripción del módulo',
        1,
        fieldValue(/descripcion|description|presentacion/),
      );
      xml = this.fillRowByLabel(
        xml,
        'Número de clases',
        1,
        fieldValue(/clases|classes/),
      );
      xml = this.fillRowByLabel(
        xml,
        'Duración de cada clase',
        1,
        fieldValue(/duracion.*clase|classduration/),
      );
      xml = this.fillRowByLabel(
        xml,
        'Horas totales',
        1,
        fieldValue(/horas|hours/),
      );
      xml = this.fillRowByLabel(
        xml,
        'Objetivo general del módulo',
        1,
        fieldValue(/objetivo|objective/),
      );
      xml = this.fillRowByLabel(
        xml,
        'Nombre de la competencia',
        1,
        metadata('Competencia'),
      );
      xml = this.fillRowByLabel(
        xml,
        'Nombre del tema general (unidad)',
        1,
        data.title,
      );
      xml = this.fillTopicRows(xml, data.fields, data.content, 8);

      const additionalFields = data.fields.slice(8);
      if (additionalFields.length) {
        xml = this.appendFieldSection(
          xml,
          'Campos adicionales de la guía base',
          additionalFields,
          data.content,
        );
      }

      return this.appendUnmappedMetadata(xml, data.metadata, [
        'Módulo',
        'Competencia',
      ]);
    }

    xml = this.fillRowByLabel(xml, 'Módulo', 1, metadata('Módulo'));
    xml = this.fillRowByLabel(xml, 'Código de nivel', 3, metadata('Código'));
    xml = this.fillRowByLabel(
      xml,
      'Competencia (N.C.L.)',
      1,
      metadata('Competencia'),
    );
    xml = this.fillRowByLabel(xml, 'Tema general', 1, data.title);
    xml = this.fillRowByLabel(xml, 'Guía N.°', 3, metadata('Versión'));
    xml = this.fillRowByLabel(
      xml,
      'Docente autor',
      1,
      metadata('Docente autor'),
    );
    xml = this.fillRowByLabel(
      xml,
      'Clases de esta guía',
      1,
      fieldValue(/clases|classes/),
    );
    xml = this.fillRowByLabel(
      xml,
      'Horas totales',
      3,
      fieldValue(/horas|hours/),
    );
    xml = this.fillRowByLabel(
      xml,
      'Fecha de inicio',
      1,
      metadata('Fecha de inicio'),
    );
    xml = this.fillRowByLabel(
      xml,
      'Fecha de fin',
      3,
      metadata('Fecha de fin'),
    );
    xml = this.fillRowByLabel(
      xml,
      'Visibilidad del material',
      1,
      metadata('Visibilidad del material'),
    );

    const baseFields = data.reference?.fields ?? [];
    const baseContent = data.reference?.content ?? {};
    baseFields.slice(0, 3).forEach((field, index) => {
      xml = this.fillRowByLabel(xml, 'Tema específico', 1, field.label, index);
      xml = this.fillRowByLabel(
        xml,
        'Contenidos',
        1,
        baseContent[field.key],
        index,
      );
      const explanation = data.fields.find((item) => item.key === field.key);
      if (explanation) {
        xml = this.fillRowByLabel(
          xml,
          'Explicación',
          1,
          data.content[explanation.key],
          index,
        );
      }
    });

    if (baseFields.length > 3) {
      xml = this.appendFieldSection(
        xml,
        'Contenidos adicionales de la guía base',
        baseFields.slice(3),
        baseContent,
      );
    }
    if (data.fields.length) {
      xml = this.appendFieldSection(
        xml,
        'Contenido diligenciado por el docente',
        data.fields,
        data.content,
      );
    }
    return this.appendUnmappedMetadata(xml, data.metadata, [
      'Módulo',
      'Competencia',
      'Docente autor',
    ]);
  }

  private replaceParagraphText(xml: string, marker: RegExp, value: string) {
    return xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
      if (!marker.test(this.cellText(paragraph))) return paragraph;
      let replaced = false;
      return paragraph.replace(
        /<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g,
        (textElement) => {
          if (replaced) return textElement.replace(/>[\s\S]*<\/w:t>/, '></w:t>');
          replaced = true;
          const openingTag =
            textElement.match(/^<w:t(?:\s[^>]*)?>/)?.[0] ?? '<w:t>';
          return `${openingTag}${this.escapeXml(value)}</w:t>`;
        },
      );
    });
  }

  private populateHeader(xml: string, data: GuideDocumentData) {
    const version = data.metadata.find(
      (item) => this.normalize(item.label) === this.normalize('Versión'),
    )?.value;
    if (version === undefined || version === null || version === '') return xml;
    return this.replaceParagraphText(
      xml,
      /^\s*Versión\s*:/i,
      `Versión: ${this.displayValue(version)}`,
    );
  }

  private async populateLogo(archive: JSZip) {
    const logoPath = fileURLToPath(
      new URL('./templates/logo-system-plus.png', import.meta.url),
    );
    archive.file('word/media/logo-system-plus.png', await readFile(logoPath));

    const contentTypes = archive.file('[Content_Types].xml');
    if (contentTypes) {
      const xml = await contentTypes.async('string');
      if (!xml.includes('Extension="png"')) {
        archive.file(
          '[Content_Types].xml',
          xml.replace(
            '</Types>',
            '<Default Extension="png" ContentType="image/png"/></Types>',
          ),
        );
      }
    }

    const relationships = archive.file('word/_rels/header1.xml.rels');
    if (relationships) {
      const xml = await relationships.async('string');
      if (!xml.includes('logo-system-plus.png')) {
        const relationship =
          '<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo-system-plus.png"/>';
        archive.file(
          'word/_rels/header1.xml.rels',
          xml.includes('</Relationships>')
            ? xml.replace('</Relationships>', `${relationship}</Relationships>`)
            : xml.replace('/>', `>${relationship}</Relationships>`),
        );
      }
    }

    const header = archive.file('word/header1.xml');
    if (header) {
      const xml = await header.async('string');
      archive.file('word/header1.xml', this.replaceLogoPlaceholder(xml));
    }
  }

  private replaceLogoPlaceholder(xml: string) {
    const drawing = `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="1828800" cy="535000"/><wp:docPr id="1" name="Logo System Plus"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="logo-system-plus.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1828800" cy="535000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
    const withNamespaces = xml.replace(
      '<w:hdr ',
      '<w:hdr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" ',
    );
    return withNamespaces.replace(
      /<w:p\b[\s\S]*?<\/w:p>/g,
      (paragraph) =>
        this.normalize(this.cellText(paragraph)) === 'logo'
          ? paragraph.replace(/<w:r\b[\s\S]*?<\/w:r>/g, '').replace('</w:p>', `${drawing}</w:p>`)
          : paragraph,
    );
  }

  private appendUnmappedMetadata(
    xml: string,
    items: Array<{ label: string; value: unknown }>,
    mappedLabels: string[],
  ) {
    const mapped = new Set(mappedLabels.map((label) => this.normalize(label)));
    const unmapped = items.filter(
      (item) => !mapped.has(this.normalize(item.label)),
    );
    if (!unmapped.length) return xml;

    const paragraphs = [
      `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="${COLORS.primary}"/></w:rPr><w:t>Información adicional</w:t></w:r></w:p>`,
      ...unmapped.map(
        (item) =>
          `<w:p><w:pPr><w:spacing w:after="100"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${this.escapeXml(item.label)}: </w:t></w:r><w:r><w:t>${this.escapeXml(this.displayValue(item.value))}</w:t></w:r></w:p>`,
      ),
    ];
    const sectionProperties = xml.search(/<w:sectPr\b/);
    if (sectionProperties === -1) {
      return xml.replace('</w:body>', `${paragraphs.join('')}</w:body>`);
    }
    return `${xml.slice(0, sectionProperties)}${paragraphs.join('')}${xml.slice(sectionProperties)}`;
  }

  private fillTopicRows(
    xml: string,
    fields: GuideField[],
    content: GuideContent,
    limit: number,
  ) {
    const topicNumbers = [
      '1.1',
      '1.2',
      '1.3',
      '1.4',
      '2.1',
      '2.2',
      '2.3',
      '2.4',
    ];
    for (const [index, field] of fields.slice(0, limit).entries()) {
      const marker = topicNumbers[index];
      xml = this.updateTableRows(xml, (cells) => {
        if (this.cellText(cells[0] ?? '') !== marker) return undefined;
        const updated = [...cells];
        updated[1] = this.replaceCellText(updated[1], field.label);
        updated[2] = this.replaceCellText(
          updated[2],
          this.displayValue(content[field.key]),
        );
        return updated;
      });
    }
    return xml;
  }

  private fillRowByLabel(
    xml: string,
    label: string,
    targetCell: number,
    value: unknown,
    occurrence = 0,
  ) {
    if (value === undefined || value === null || value === '') return xml;
    const normalizedLabel = this.normalize(label);
    let matches = 0;
    return this.updateTableRows(xml, (cells) => {
      const rowLabel = cells.map((cell) => this.normalize(this.cellText(cell)));
      if (!rowLabel.includes(normalizedLabel)) return undefined;
      if (matches++ !== occurrence || !cells[targetCell]) return undefined;
      const updated = [...cells];
      updated[targetCell] = this.replaceCellText(
        updated[targetCell],
        this.displayValue(value),
      );
      return updated;
    });
  }

  private updateTableRows(
    xml: string,
    update: (cells: string[]) => string[] | undefined,
  ) {
    return xml.replace(/<w:tr\b[\s\S]*?<\/w:tr>/g, (row) => {
      const cells = row.match(/<w:tc\b[\s\S]*?<\/w:tc>/g);
      if (!cells) return row;
      const updatedCells = update(cells);
      if (!updatedCells) return row;
      let index = 0;
      return row.replace(
        /<w:tc\b[\s\S]*?<\/w:tc>/g,
        () => updatedCells[index++],
      );
    });
  }

  private replaceCellText(cell: string, value: string) {
    let hasText = false;
    return cell.replace(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g, (textElement) => {
      if (hasText) return textElement.replace(/>[\s\S]*<\/w:t>/, '></w:t>');
      hasText = true;
      const openingTag =
        textElement.match(/^<w:t(?:\s[^>]*)?>/)?.[0] ?? '<w:t>';
      return `${openingTag}${this.escapeXml(value)}</w:t>`;
    });
  }

  private cellText(cell: string) {
    return [...cell.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
      .map((match) => this.unescapeXml(match[1]))
      .join('');
  }

  private appendFieldSection(
    xml: string,
    title: string,
    fields: GuideField[],
    content: GuideContent,
  ) {
    const paragraphs = [
      `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="${COLORS.primary}"/></w:rPr><w:t>${this.escapeXml(title)}</w:t></w:r></w:p>`,
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
        `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="${COLORS.accent}"/></w:rPr><w:t>${this.escapeXml(section)}</w:t></w:r></w:p>`,
      );
      for (const field of sectionFields) {
        paragraphs.push(
          `<w:p><w:pPr><w:spacing w:after="100"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${this.escapeXml(field.label)}: </w:t></w:r><w:r><w:t>${this.escapeXml(this.displayValue(content[field.key]))}</w:t></w:r></w:p>`,
        );
      }
    }
    const sectionProperties = xml.search(/<w:sectPr\b/);
    if (sectionProperties === -1) {
      return xml.replace('</w:body>', `${paragraphs.join('')}</w:body>`);
    }
    return `${xml.slice(0, sectionProperties)}${paragraphs.join('')}${xml.slice(sectionProperties)}`;
  }

  private normalize(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private escapeXml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private unescapeXml(value: string) {
    return value
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');
  }

  private displayValue(value: unknown): string {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean')
      return String(value);
    return JSON.stringify(value);
  }
}
