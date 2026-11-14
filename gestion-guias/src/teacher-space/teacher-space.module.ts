import { Module } from '@nestjs/common';
import { AcademicModule } from '../academic/academic.module.js';
import { TeacherSpaceController } from './teacher-space.controller.js';

/**
 * HE-04 - Espacio docente. Módulo independiente: usa las guías base solo a través de los servicios
 * públicos que exporta AcademicModule (RNF-32).
 */
@Module({
  imports: [AcademicModule],
  controllers: [TeacherSpaceController],
})
export class TeacherSpaceModule {}
