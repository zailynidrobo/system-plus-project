import { BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import type { AcademicService } from './academic.service.js';
import type { GuideDocumentExportService } from './guide-document-export.service.js';

type DatosDocumento = Awaited<ReturnType<AcademicService['getGuideDocumentData']>>;

/** Genera la guía en DOCX o PDF y la envía como descarga. Lo usan guías base, historial y espacio docente. */
export async function enviarDocumento(
  exportador: GuideDocumentExportService,
  datos: DatosDocumento,
  formato: string,
  nombreArchivo: string,
  response: Response,
): Promise<void> {
  if (formato !== 'docx' && formato !== 'pdf') throw new BadRequestException('El formato debe ser docx o pdf');
  const archivo = formato === 'docx' ? await exportador.toDocx(datos) : await exportador.toPdf(datos);
  response.setHeader(
    'Content-Type',
    formato === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  );
  response.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}.${formato}"`);
  response.send(archivo);
}
