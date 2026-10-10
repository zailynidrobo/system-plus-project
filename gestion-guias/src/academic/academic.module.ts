import { Module } from '@nestjs/common';
import { AcademicController } from './academic.controller.js';
import { AcademicService } from './academic.service.js';
import { GuideDocumentExportService } from './guide-document-export.service.js';

@Module({
  controllers: [AcademicController],
  providers: [AcademicService, GuideDocumentExportService],
})
export class AcademicModule {}
