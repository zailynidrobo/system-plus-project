import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicModule } from '../academic/academic.module.js';
import { AcademicGuideRecord } from '../academic/entities/academic-guide-record.entity.js';
import { GuideEventRecord } from '../academic/entities/guide-event-record.entity.js';
import { ModuleTeacherAssignmentRecord } from '../academic/entities/module-teacher-assignment-record.entity.js';
import { PersonalizedGuideVersionRecord } from '../academic/entities/personalized-guide-version-record.entity.js';
import { CurricularModule } from '../academic-program/entities/curricular-module.entity.js';
import { CLOCK, systemClock } from './clock.js';
import { SuggestionRecord } from './entities/suggestion-record.entity.js';
import { UserNotificationRecord } from './entities/user-notification-record.entity.js';
import { SuggestionApprovalController } from './suggestion-approval.controller.js';
import { SuggestionApprovalService } from './suggestion-approval.service.js';
import { SuggestionInboxController } from './suggestion-inbox.controller.js';
import { SuggestionInboxService } from './suggestion-inbox.service.js';
import { SuggestionRejectionController } from './suggestion-rejection.controller.js';
import { SuggestionRejectionService } from './suggestion-rejection.service.js';
import { SUGGESTION_RULES, loadSuggestionRules } from './suggestion-rules.js';
import { SuggestionSubmissionService } from './suggestion-submission.service.js';
import { SuggestionViewsService } from './suggestion-views.service.js';
import { TeacherSuggestionsController } from './teacher-suggestions.controller.js';

/**
 * HE-05 · Sugerencias de cambio sobre la guía base y la campana de notificaciones.
 * Reutiliza las guías, asignaciones y versiones docentes de HE-03/HE-04 (src/academic).
 */
@Module({
  imports: [
    AcademicModule,
    TypeOrmModule.forFeature([
      SuggestionRecord,
      UserNotificationRecord,
      AcademicGuideRecord,
      GuideEventRecord,
      ModuleTeacherAssignmentRecord,
      PersonalizedGuideVersionRecord,
      CurricularModule,
    ]),
  ],
  // TeacherSuggestionsController va primero: `suggestions/mine` antes que `suggestions/:id`.
  controllers: [
    TeacherSuggestionsController,
    SuggestionInboxController,
    SuggestionApprovalController,
    SuggestionRejectionController,
  ],
  providers: [
    { provide: CLOCK, useValue: systemClock },
    {
      provide: SUGGESTION_RULES,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        loadSuggestionRules((name) => config.get<string>(name)),
    },
    SuggestionViewsService,
    SuggestionSubmissionService,
    SuggestionInboxService,
    SuggestionApprovalService,
    SuggestionRejectionService,
  ],
})
export class SuggestionsModule {}
