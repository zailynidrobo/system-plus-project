import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicModule } from '../academic/academic.module.js';
import { AcademicGuideRecord } from '../academic/entities/academic-guide-record.entity.js';
import { CurricularModule } from '../academic-program/entities/curricular-module.entity.js';
import { CLOCK, systemClock } from '../suggestions/clock.js';
import { SuggestionRecord } from '../suggestions/entities/suggestion-record.entity.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

/** HE-11-HU-02 · Reportes de coordinación: guías por módulo y sugerencias con sus tiempos. */
@Module({
  imports: [
    AcademicModule,
    TypeOrmModule.forFeature([
      CurricularModule,
      AcademicGuideRecord,
      SuggestionRecord,
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService, { provide: CLOCK, useValue: systemClock }],
})
export class ReportsModule {}
