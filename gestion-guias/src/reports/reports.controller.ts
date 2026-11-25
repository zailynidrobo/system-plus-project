import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { GuideDocumentExportService } from '../academic/guide-document-export.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { construirXlsx } from './reporte-xlsx.js';
import { hojasGuias, hojasSugerencias } from './reportes-documento.js';
import { ReportsService } from './reports.service.js';

const REPORTES = {
  guias: 'guias-por-modulo',
  sugerencias: 'sugerencias',
} as const;

/** Reportes de coordinación: en pantalla o descargados en Excel o PDF. */
@Controller('reports')
@Roles('coordinador')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly exportador: GuideDocumentExportService,
  ) {}

  @Get('guides')
  guides() {
    return this.reports.guidesReport();
  }

  @Get('suggestions')
  suggestions(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reports.suggestionsReport({ from, to });
  }

  @Get(':report/export')
  async export(
    @Param('report') report: string,
    @Query('format') format: string,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res() response: Response,
  ) {
    if (format !== 'xlsx' && format !== 'pdf') {
      throw new BadRequestException('El formato debe ser xlsx o pdf');
    }
    let hojas;
    let nombre: string;
    if (report === 'guides') {
      hojas = hojasGuias(await this.reports.guidesReport());
      nombre = REPORTES.guias;
    } else if (report === 'suggestions') {
      hojas = hojasSugerencias(
        await this.reports.suggestionsReport({ from, to }),
      );
      nombre = REPORTES.sugerencias;
    } else {
      throw new BadRequestException('El reporte debe ser guides o suggestions');
    }
    const xlsx = await construirXlsx(hojas);
    const archivo =
      format === 'xlsx'
        ? xlsx
        : await this.exportador.convertirAPdf(xlsx, 'xlsx');
    const hoy = new Date().toISOString().slice(0, 10);
    response.setHeader(
      'Content-Type',
      format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="reporte-${nombre}-${hoy}.${format}"`,
    );
    response.send(archivo);
  }
}
