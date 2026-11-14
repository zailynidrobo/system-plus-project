import { Module } from '@nestjs/common';
import { AcademicModule } from '../academic/academic.module.js';
import { GuideSearchController } from './guide-search.controller.js';

/**
 * HE-06 - Consulta y búsqueda de guías. Módulo independiente: usa las guías base solo a través de los servicios
 * públicos que exporta AcademicModule (RNF-32).
 */
@Module({
  imports: [AcademicModule],
  controllers: [GuideSearchController],
})
export class GuideSearchModule {}
