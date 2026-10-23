import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { mapKeycloakRole } from '../../core/auth/role-mapping';
import { Role } from '../../shared/models/user';
import { AcademicIds } from './academic-ids';
import { falla } from './http-errores';

/** Docente que coordinación puede asignar a un módulo. `id` es el UUID de Keycloak. */
export interface DocenteAsignable {
  id: string;
  nombre: string;
  correo: string;
  rol: Role;
}

interface DocenteResponse {
  id: string;
  name: string;
  email: string;
  role: string | null;
}

/**
 * Asignación de docentes a módulos (HE-04). Solo existe contra el backend: con `apiAcademico = 'mock'`
 * la pantalla que lo usa no se muestra.
 *   GET /academic/teachers · GET/PUT/DELETE /academic/modules/:moduleId/teachers[/:teacherId]
 */
@Injectable({ providedIn: 'root' })
export class TeacherAssignmentApi {
  private http = inject(HttpClient);
  private ids = inject(AcademicIds);
  private base = `${environment.apiUrl}/academic`;

  /** Docentes y docentes autorizados activos. */
  docentes(): Observable<DocenteAsignable[]> {
    return this.http.get<DocenteResponse[]>(`${this.base}/teachers`).pipe(
      map((lista) =>
        lista.flatMap((d) => {
          const rol = d.role ? mapKeycloakRole(d.role) : null;
          return rol ? [{ id: d.id, nombre: d.name, correo: d.email, rol }] : [];
        }),
      ),
      catchError(falla()),
    );
  }

  /** UUID de los docentes asignados al módulo. */
  asignados(moduleId: number): Observable<string[]> {
    return this.ids.modulo(moduleId).pipe(
      switchMap((uuid) => this.http.get<string[]>(`${this.base}/modules/${uuid}/teachers`)),
      catchError(falla()),
    );
  }

  asignar(moduleId: number, teacherId: string): Observable<unknown> {
    return this.ids.modulo(moduleId).pipe(
      switchMap((uuid) => this.http.put(`${this.base}/modules/${uuid}/teachers/${teacherId}`, {})),
      catchError(falla()),
    );
  }

  quitar(moduleId: number, teacherId: string): Observable<unknown> {
    return this.ids.modulo(moduleId).pipe(
      switchMap((uuid) => this.http.delete(`${this.base}/modules/${uuid}/teachers/${teacherId}`)),
      catchError(falla()),
    );
  }
}
