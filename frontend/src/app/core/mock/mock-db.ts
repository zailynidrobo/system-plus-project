import { Injectable } from '@angular/core';
import { AcademicModule, Program } from '../../shared/models/academic-module';
import { Competency, CompetencyRevision } from '../../shared/models/competency';
import { Guide, GuideEvent } from '../../shared/models/guide';
import { FieldConfig } from '../../shared/models/guide-field';
import { TeacherVersion } from '../../shared/models/teacher-version';
import {
  AsignacionDocente,
  PROGRAMA,
  crearAsignaciones,
  crearCompetencias,
  crearModulos,
  crearRevisiones,
} from './seed-academic';
import { crearEstructuras, crearEventosGuias, crearGuias } from './seed-guides';
import { crearVersiones } from './seed-versions';
import { NotificacionMock, crearSugerencias, eventosDeSugerencias, notificacionesDeSugerencias } from './seed-suggestions';
import { Suggestion } from '../../shared/models/suggestion';
import { SupportMaterial } from '../../shared/models/support-material';
import { EventoUsuarioMock, UsuarioMock, crearEventosUsuarios, crearUsuarios } from './seed-users';

/**
 * "Base de datos" en memoria compartida por todos los servicios mock, para que los datos
 * sean coherentes entre épicas. Se pierde al recargar la página, igual que en HE-01.
 * Cuando exista el backend, los servicios *-api.ts dejan de usarla.
 */
@Injectable({ providedIn: 'root' })
export class MockDb {
  readonly programa: Program = PROGRAMA;

  // HE-01
  usuarios: UsuarioMock[] = crearUsuarios();
  eventosUsuarios: EventoUsuarioMock[] = crearEventosUsuarios(this.usuarios);

  // HE-02
  modulos: AcademicModule[] = crearModulos();
  competencias: Competency[] = crearCompetencias();
  revisiones: CompetencyRevision[] = crearRevisiones(this.competencias);

  // HE-03
  estructuras: FieldConfig[] = crearEstructuras();
  guias: Guide[] = crearGuias();
  // HE-05 (antes del historial de guías: las aprobadas dejan eventos)
  sugerencias: Suggestion[] = crearSugerencias(this.guias, this.usuarios);
  eventosGuias: GuideEvent[] = [...crearEventosGuias(this.guias), ...eventosDeSugerencias(this.sugerencias)];
  // Campana del docente (las alertas del coordinador se calculan de las pendientes)
  notificaciones: NotificacionMock[] = notificacionesDeSugerencias(this.sugerencias, this.guias);

  // HE-04
  asignaciones: AsignacionDocente[] = crearAsignaciones();
  versiones: TeacherVersion[] = crearVersiones(this.guias);

  // Materiales de apoyo de las guías (empiezan vacíos)
  materiales: (SupportMaterial & { guideId: number; contenido: Blob })[] = [];
}
