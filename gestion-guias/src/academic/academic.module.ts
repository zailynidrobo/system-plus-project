import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurricularModule } from '../academic-program/entities/curricular-module.entity.js';
import { Competency } from '../academic-program/entities/competency.entity.js';
import { AcademicGuideRecord } from './entities/academic-guide-record.entity.js';
import { GuideFieldConfigRecord } from './entities/guide-field-config-record.entity.js';
import { ModuleTeacherAssignmentRecord } from './entities/module-teacher-assignment-record.entity.js';
import { PersonalizedGuideVersionRecord } from './entities/personalized-guide-version-record.entity.js';
import { GuideSupportMaterialRecord } from './entities/guide-support-material-record.entity.js';
import { AcademicController } from './academic.controller.js';
import { AcademicService } from './academic.service.js';
import { GuideDocumentExportService } from './guide-document-export.service.js';
import { TypeOrmGuideStatsProvider } from './typeorm-guide-stats.provider.js';

/**
 * HE-03/HE-04 — Guías, campos, asignación docente, versiones personalizadas y materiales.
 * Los módulos y competencias son los de HE-02 (`curricular_modules` y `competencies`);
 * este componente solo los consulta para validar y no los administra.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CurricularModule,
      Competency,
      GuideFieldConfigRecord,
      AcademicGuideRecord,
      PersonalizedGuideVersionRecord,
      ModuleTeacherAssignmentRecord,
      GuideSupportMaterialRecord,
    ]),
  ],
  controllers: [AcademicController],
  providers: [
    AcademicService,
    GuideDocumentExportService,
    TypeOrmGuideStatsProvider,
  ],
  // HE-02 lo usa para mostrar cuántas guías tiene cada módulo y competencia.
  exports: [TypeOrmGuideStatsProvider],
})
export class AcademicModule {}
