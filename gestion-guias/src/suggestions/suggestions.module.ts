import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicModule } from '../academic/academic.module.js';
import { AcademicGuideRecord } from '../academic/entities/academic-guide-record.entity.js';
import { ModuleTeacherAssignmentRecord } from '../academic/entities/module-teacher-assignment-record.entity.js';
import { CurricularModule } from '../academic-program/entities/curricular-module.entity.js';
import { CLOCK, systemClock } from './clock.js';
import { SuggestionRecord } from './entities/suggestion-record.entity.js';
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
      AcademicGuideRecord,
      ModuleTeacherAssignmentRecord,
      CurricularModule,
    ]),
  ],
  // TeacherSuggestionsController va primero: `suggestions/mine` antes que `suggestions/:id`.
  controllers: [
    TeacherSuggestionsController,
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
  ],
})
export class SuggestionsModule {}
