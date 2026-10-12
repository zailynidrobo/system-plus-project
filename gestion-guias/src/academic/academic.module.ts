import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicGuideRecord } from './entities/academic-guide-record.entity.js';
import { AcademicModuleRecord } from './entities/academic-module-record.entity.js';
import { AcademicCompetencyRecord } from './entities/academic-competency-record.entity.js';
import { GuideFieldConfigRecord } from './entities/guide-field-config-record.entity.js';
import { ModuleTeacherAssignmentRecord } from './entities/module-teacher-assignment-record.entity.js';
import { PersonalizedGuideVersionRecord } from './entities/personalized-guide-version-record.entity.js';
import { GuideSupportMaterialRecord } from './entities/guide-support-material-record.entity.js';
import { AcademicController } from './academic.controller.js';
import { AcademicService } from './academic.service.js';
import { GuideDocumentExportService } from './guide-document-export.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AcademicModuleRecord,
      AcademicCompetencyRecord,
      GuideFieldConfigRecord,
      AcademicGuideRecord,
      PersonalizedGuideVersionRecord,
      ModuleTeacherAssignmentRecord,
      GuideSupportMaterialRecord,
    ]),
  ],
  controllers: [AcademicController],
  providers: [AcademicService, GuideDocumentExportService],
})
export class AcademicModule {}
