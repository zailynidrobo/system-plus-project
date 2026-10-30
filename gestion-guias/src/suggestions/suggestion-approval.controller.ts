import { Controller, Param, Patch, Req } from '@nestjs/common';
import type { KeycloakJwtPayload } from '../auth/keycloak.strategy.js';
import { Roles } from '../auth/roles.decorator.js';
import { actorFromToken } from './suggestion-actor.js';
import { SuggestionApprovalService } from './suggestion-approval.service.js';

/** HE-05-HU-03 · Aprobar una sugerencia. */
@Controller('academic/suggestions')
@Roles('coordinador')
export class SuggestionApprovalController {
  constructor(private readonly approval: SuggestionApprovalService) {}

  @Patch(':id/approve')
  approve(
    @Param('id') id: string,
    @Req() request: { user: KeycloakJwtPayload },
  ) {
    return this.approval.approve(id, actorFromToken(request.user));
  }
}
