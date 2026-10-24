import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, switchMap, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiError } from '../../../shared/models/api-error';
import { SupportMaterial } from '../../../shared/models/support-material';
import { AcademicIds } from '../../academic-program/academic-ids';
import { falla } from '../../academic-program/http-errores';
import { ContratoSupportMaterialApi, validarArchivo } from './support-material-api';

/** Materiales de apoyo contra el backend (/academic/guides/:id/support-materials). */
@Injectable()
export class HttpSupportMaterialApi implements ContratoSupportMaterialApi {
  private http = inject(HttpClient);
  private ids = inject(AcademicIds);

  private url(guideUuid: string): string {
    return `${environment.apiUrl}/academic/guides/${guideUuid}/support-materials`;
  }

  listar(guideId: number): Observable<SupportMaterial[]> {
    return this.ids.guia(guideId).pipe(
      switchMap((uuid) => this.http.get<SupportMaterial[]>(this.url(uuid))),
      catchError(falla()),
    );
  }

  subir(guideId: number, archivo: File): Observable<SupportMaterial> {
    const error = validarArchivo(archivo);
    if (error) return throwError(() => new ApiError(error));
    const datos = new FormData();
    datos.append('file', archivo, archivo.name);
    return this.ids.guia(guideId).pipe(
      switchMap((uuid) => this.http.post<SupportMaterial>(this.url(uuid), datos)),
      catchError(falla()),
    );
  }

  descargar(guideId: number, materialId: string): Observable<Blob> {
    return this.ids.guia(guideId).pipe(
      switchMap((uuid) =>
        this.http.get(`${this.url(uuid)}/${materialId}/download`, { responseType: 'blob' }),
      ),
      catchError(falla()),
    );
  }

  eliminar(guideId: number, materialId: string): Observable<void> {
    return this.ids.guia(guideId).pipe(
      switchMap((uuid) => this.http.delete(`${this.url(uuid)}/${materialId}`)),
      map(() => undefined),
      catchError(falla()),
    );
  }
}
