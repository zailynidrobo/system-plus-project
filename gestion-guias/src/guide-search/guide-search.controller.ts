import { Controller, Get, Query, Req } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import { KeycloakJwtPayload } from '../auth/keycloak.strategy.js';
import { AcademicService } from '../academic/academic.service.js';
import { ListGuidesQuery } from '../academic/dto/list-guides.query.js';

/** HE-06 - Consulta y búsqueda de guías con filtros, y resumen de guías por estado. */
@Controller('academic')
export class GuideSearchController {
  constructor(
    private readonly academicService: AcademicService,
  ) {}

  @Get('guides')
  @Roles('coordinador', 'docente', 'docente_autorizado')
  findAllGuides(
    @Query() query: ListGuidesQuery,
    @Req() request: { user: KeycloakJwtPayload },
  ) {
    return this.academicService.findGuidesForUser(
      query,
      request.user.sub,
      request.user.realm_access?.roles ?? [],
    );
  }

  @Get('guides/summary')
  @Roles('coordinador', 'docente', 'docente_autorizado')
  getGuidesSummary(@Req() request: { user: KeycloakJwtPayload }) {
    return this.academicService.getGuidesSummaryForUser(
      request.user.sub,
      request.user.realm_access?.roles ?? [],
    );
  }
}
