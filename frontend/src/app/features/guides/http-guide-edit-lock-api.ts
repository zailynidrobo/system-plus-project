import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GuideEditLock, NewGuideEditLock } from '../../shared/models/guide-edit-lock';
import { falla } from '../academic-program/http-errores';
import { GuideEditLockApi } from './guide-edit-lock-api';

@Injectable()
export class HttpGuideEditLockApi extends GuideEditLockApi {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/academic/guide-edit-locks`;

  override listar(): Observable<GuideEditLock[]> {
    return this.http.get<GuideEditLock[]>(this.base).pipe(catchError(falla()));
  }

  override crear(data: NewGuideEditLock): Observable<GuideEditLock> {
    return this.http.post<GuideEditLock>(this.base, data).pipe(catchError(falla()));
  }

  override eliminar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`).pipe(catchError(falla()));
  }
}
