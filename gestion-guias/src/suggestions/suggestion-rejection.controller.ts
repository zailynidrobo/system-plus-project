import { Body, Controller, Param, Patch, Req } from '@nestjs/common';
import type { KeycloakJwtPayload } from '../auth/keycloak.strategy.js';
import { Roles } from '../auth/roles.decorator.js';
import { RejectSuggestionDto } from './dto/reject-suggestion.dto.js';
import { actorFromToken } from './suggestion-actor.js';
import { SuggestionRejectionService } from './suggestion-rejection.service.js';

/** HE-05-HU-04 · Rechazar con motivo y retroalimentación. */
@Controller('academic/suggestions')
@Roles('coordinador')
export class SuggestionRejectionController {
  constructor(private readonly rejection: SuggestionRejectionService) {}

  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectSuggestionDto,
    @Req() request: { user: KeycloakJwtPayload },
  ) {
    return this.rejection.reject(id, dto, actorFromToken(request.user));
  }
}
