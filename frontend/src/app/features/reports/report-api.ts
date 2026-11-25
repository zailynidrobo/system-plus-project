import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { MOCK_LATENCY, simular } from '../../core/mock/latency';
import { ApiError } from '../../shared/models/api-error';
import {
  FormatoReporte,
  PeriodoReporte,
  ReporteGuias,
  ReporteSugerencias,
  TipoReporte,
} from '../../shared/models/reportes';

/**
 * Reportes de coordinación con datos de prueba. Con api = 'http' se usa HttpReportApi, que
 * tiene la misma API pública y habla con /reports del backend.
 */
@Injectable({ providedIn: 'root' })
export class ReportApi {
  private ms = inject(MOCK_LATENCY);

  guias(): Observable<ReporteGuias> {
    return simular(this.ms, () => ({
      generatedAt: new Date().toISOString(),
      totals: { modules: 2, guides: 3, published: 2, drafts: 1 },
      rows: [
        {
          moduleCode: 'TS-MOD-04',
          moduleName: 'Informática básica',
          moduleStatus: 'Activo',
          total: 2,
          published: 1,
          drafts: 1,
          lastUpdate: new Date().toISOString(),
        },
        {
          moduleCode: 'TS-MOD-05',
          moduleName: 'Programación',
          moduleStatus: 'Activo',
          total: 1,
          published: 1,
          drafts: 0,
          lastUpdate: new Date().toISOString(),
        },
      ],
    }));
  }

  sugerencias(periodo: PeriodoReporte): Observable<ReporteSugerencias> {
    return simular(this.ms, () => ({
      generatedAt: new Date().toISOString(),
      period: { from: periodo.desde, to: periodo.hasta },
      totals: {
        received: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        overdue: 0,
        averageResponseDays: null,
        onTimeRate: null,
      },
      byModule: [],
      pending: [],
    }));
  }

  descargar(
    _tipo: TipoReporte,
    _formato: FormatoReporte,
    _periodo: PeriodoReporte,
  ): Observable<Blob> {
    return throwError(() => new ApiError('NO_DISPONIBLE'));
  }
}
