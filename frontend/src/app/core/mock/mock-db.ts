import { Injectable } from '@angular/core';
import { AcademicModule, Program } from '../../shared/models/academic-module';
import { AsignacionDocente, PROGRAMA, crearAsignaciones, crearModulos } from './seed-academic';
import { UsuarioMock, crearUsuarios } from './seed-users';

/**
 * "Base de datos" en memoria compartida por todos los servicios mock, para que los datos
 * sean coherentes entre épicas. Se pierde al recargar la página, igual que en HE-01.
 * Cuando exista el backend, los servicios *-api.ts dejan de usarla.
 */
@Injectable({ providedIn: 'root' })
export class MockDb {
  readonly programa: Program = PROGRAMA;
  usuarios: UsuarioMock[] = crearUsuarios();
  modulos: AcademicModule[] = crearModulos();
  asignaciones: AsignacionDocente[] = crearAsignaciones();
}
