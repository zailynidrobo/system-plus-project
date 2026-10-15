import { Module } from '@nestjs/common';
import { AcademicController } from './academic.controller.js';
import { AcademicService } from './academic.service.js';

@Module({
  controllers: [AcademicController],
  providers: [AcademicService],
})
export class AcademicModule {}
