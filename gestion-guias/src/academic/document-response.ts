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
  response.setHeader(
    'Content-Disposition',
    `attachment; filename="${nombreArchivoDesdeDatos(datos, nombreArchivo)}.${formato}"`,
  );
  response.send(archivo);
}

function nombreArchivoDesdeDatos(
  datos: DatosDocumento,
  fallback: string,
): string {
  const metadata = (label: string) =>
    datos.metadata.find((item) => item.label.toLowerCase() === label.toLowerCase())?.value;
  const partes = [
    metadata('Nombre de la guía') ?? datos.title,
    metadata('Versión'),
  ].filter((value): value is string | number => typeof value === 'string' || typeof value === 'number');
  const nombre = partes
    .join(' - ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return nombre || fallback;
}
