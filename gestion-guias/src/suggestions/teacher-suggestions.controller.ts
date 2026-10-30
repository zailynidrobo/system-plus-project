import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { KeycloakJwtPayload } from '../auth/keycloak.strategy.js';
import { Roles } from '../auth/roles.decorator.js';
import { CreateSuggestionDto } from './dto/create-suggestion.dto.js';
import { actorFromToken } from './suggestion-actor.js';
import { SuggestionSubmissionService } from './suggestion-submission.service.js';

/**
 * HE-05-HU-01 · Rutas del docente. Se registra antes que la bandeja del coordinador para que
 * `suggestions/mine` no la capture `suggestions/:id`.
 */
@Controller('academic')
@Roles('docente', 'docente_autorizado')
export class TeacherSuggestionsController {
  constructor(private readonly submission: SuggestionSubmissionService) {}

  @Post('guides/:guideId/suggestions')
  create(
    @Param('guideId') guideId: string,
    @Body() dto: CreateSuggestionDto,
    @Req() request: { user: KeycloakJwtPayload },
  ) {
    return this.submission.create(guideId, dto, actorFromToken(request.user));
  }

  @Get('suggestions/mine')
  findMine(@Req() request: { user: KeycloakJwtPayload }) {
    return this.submission.findMine(request.user.sub);
  }

  @Get('suggestions/mine/:id')
  findMineOne(
    @Param('id') id: string,
    @Req() request: { user: KeycloakJwtPayload },
  ) {
    return this.submission.findMineOne(id, request.user.sub);
  }
}
