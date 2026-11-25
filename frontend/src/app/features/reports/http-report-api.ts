import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  FormatoReporte,
  PeriodoReporte,
  ReporteGuias,
  ReporteSugerencias,
  TipoReporte,
} from '../../shared/models/reportes';
import { falla } from '../academic-program/http-errores';
import { ReportApi } from './report-api';

const parametros = (p: PeriodoReporte, extra: Record<string, string> = {}) => {
  let params = new HttpParams({ fromObject: extra });
  if (p.desde) params = params.set('from', p.desde);
  if (p.hasta) params = params.set('to', p.hasta);
  return params;
};

/** Misma API pública que ReportApi, contra /reports del backend. Solo coordinación. */
@Injectable()
export class HttpReportApi implements Pick<ReportApi, keyof ReportApi> {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/reports`;

  guias(): Observable<ReporteGuias> {
    return this.http.get<ReporteGuias>(`${this.base}/guides`).pipe(catchError(falla()));
  }

  sugerencias(periodo: PeriodoReporte): Observable<ReporteSugerencias> {
    return this.http
      .get<ReporteSugerencias>(`${this.base}/suggestions`, { params: parametros(periodo) })
      .pipe(catchError(falla()));
  }

  descargar(tipo: TipoReporte, formato: FormatoReporte, periodo: PeriodoReporte): Observable<Blob> {
    return this.http
      .get(`${this.base}/${tipo}/export`, {
        params: parametros(tipo === 'suggestions' ? periodo : { desde: null, hasta: null }, {
          format: formato,
        }),
        responseType: 'blob',
      })
      .pipe(catchError(falla()));
  }
}
