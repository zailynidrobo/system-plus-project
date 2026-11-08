import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicGuideRecord } from '../../academic/entities/academic-guide-record.entity.js';
import { PersonalizedGuideVersionRecord } from '../../academic/entities/personalized-guide-version-record.entity.js';
import { Competency } from '../../academic-program/entities/competency.entity.js';
import { CurricularModule } from '../../academic-program/entities/curricular-module.entity.js';
import { CLOCK, systemClock } from '../../suggestions/clock.js';
import { SuggestionRecord } from '../../suggestions/entities/suggestion-record.entity.js';
import { UsersModule } from '../../users/users.module.js';
import { AuditActionsController } from './audit-actions.controller.js';
import { AuditActionsService } from './audit-actions.service.js';
import { AuditContextResolver } from './audit-context.resolver.js';
import { AuditEventRecord } from './audit-event.entity.js';
import { AuditForbiddenFilter } from './audit-forbidden.filter.js';
import { AuditInterceptor } from './audit.interceptor.js';
import { AuditLogService } from './audit-log.service.js';
import { SessionAuditService } from './session-audit.service.js';

/**
 * HE-08-HU-01 · Registro de acciones de los usuarios. El interceptor y el filtro son globales:
 * registran las acciones de todos los módulos sin tocar sus controladores.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuditEventRecord,
      CurricularModule,
      Competency,
      AcademicGuideRecord,
      PersonalizedGuideVersionRecord,
      SuggestionRecord,
    ]),
    // Nombre, correo y rol de quien cierra sesión (el refresh token solo trae el id).
    UsersModule,
  ],
  controllers: [AuditActionsController],
  providers: [
    { provide: CLOCK, useValue: systemClock },
    AuditLogService,
    AuditContextResolver,
    AuditActionsService,
    SessionAuditService,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_FILTER, useClass: AuditForbiddenFilter },
  ],
  // AuthController registra el inicio y cierre de sesión.
  exports: [SessionAuditService],
})
export class AuditActionsModule {}
