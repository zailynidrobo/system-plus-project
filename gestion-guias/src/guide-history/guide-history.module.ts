import { Module } from '@nestjs/common';
import { AcademicModule } from '../academic/academic.module.js';
import { GuideHistoryController } from './guide-history.controller.js';

/**
 * HE-07 - Historial de versiones. Módulo independiente: usa las guías base solo a través de los servicios
 * públicos que exporta AcademicModule (RNF-32).
 */
@Module({
  imports: [AcademicModule],
  controllers: [GuideHistoryController],
})
export class GuideHistoryModule {}
