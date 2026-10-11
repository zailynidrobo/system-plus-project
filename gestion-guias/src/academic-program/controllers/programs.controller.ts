import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ProgramsService } from '../services/programs.service.js';

@Controller('programs')
export class ProgramsController {
  constructor(private readonly programs: ProgramsService) {}

  @Get()
  findAll() {
    return this.programs.findAll();
  }

  /** Tarjetas del encabezado: plan curricular, módulos activos y guías publicadas. */
  @Get(':programId')
  getSummary(@Param('programId', ParseUUIDPipe) programId: string) {
    return this.programs.getSummary(programId);
  }
}
