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
import { GuideEditLock } from '../../shared/models/guide-edit-lock';
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
  bloqueosEdicion: Omit<GuideEditLock, 'active'>[] = [
    {
      id: 'bloqueo-2026-1',
      name: 'Cierre de semestre 2026-1',
      startsAt: '2026-06-01T05:00:00.000Z',
      endsAt: '2026-06-16T04:59:00.000Z',
      reason: 'La edición de guías está bloqueada por cierre de semestre. Podrás consultar las guías, pero no modificarlas hasta el 15 de junio.',
      createdBy: { id: '4', name: 'Diana Marcela Ruiz' },
      createdAt: '2026-05-20T15:00:00.000Z',
    },
  ];
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
