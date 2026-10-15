import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Program } from './entities/program.entity.js';
import { CurricularModule } from './entities/curricular-module.entity.js';
import { Competency } from './entities/competency.entity.js';
import { CompetencyRevision } from './entities/competency-revision.entity.js';
import {
  EmptyGuideStatsProvider,
  GuideStatsProvider,
} from './guide-stats.provider.js';
import { CurricularModulesService } from './services/curricular-modules.service.js';
import { CompetenciesService } from './services/competencies.service.js';
import { ProgramsService } from './services/programs.service.js';
import { ProgramsController } from './controllers/programs.controller.js';
import { CurricularModulesController } from './controllers/curricular-modules.controller.js';
import { CompetenciesController } from './controllers/competencies.controller.js';

/** HE-02 — Gestión del programa académico (componente "Programa, módulos y competencias"). */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Program,
      CurricularModule,
      Competency,
      CompetencyRevision,
    ]),
  ],
  providers: [
    ProgramsService,
    CurricularModulesService,
    CompetenciesService,
    // Reemplazar por la implementación real cuando el componente de guías (HE-03) persista sus datos.
    { provide: GuideStatsProvider, useClass: EmptyGuideStatsProvider },
  ],
  controllers: [
    ProgramsController,
    CurricularModulesController,
    CompetenciesController,
  ],
  // Expuestos para HE-03: validar módulos disponibles y resolver versiones de competencias.
  exports: [ProgramsService, CurricularModulesService, CompetenciesService],
})
export class AcademicProgramModule {}
