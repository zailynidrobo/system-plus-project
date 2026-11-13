import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import type { KeycloakJwtPayload } from '../auth/keycloak.strategy.js';
import { Roles } from '../auth/roles.decorator.js';
import { UpdateSuggestionSettingsDto } from './dto/update-suggestion-settings.dto.js';
import { actorFromToken } from './suggestion-actor.js';
import { SuggestionSettingsService } from './suggestion-settings.service.js';

/** HE-09-HU-01 · Tiempo límite de respuesta a sugerencias. */
@Controller('academic/settings/suggestion-deadline')
@Roles('admin')
export class SuggestionSettingsController {
  constructor(private readonly settings: SuggestionSettingsService) {}

  /** El coordinador también lo consulta: es quien debe responder a tiempo. */
  @Get()
  @Roles('admin', 'coordinador')
  get() {
    return this.settings.get();
  }

  @Put()
  update(
    @Body() dto: UpdateSuggestionSettingsDto,
    @Req() request: { user: KeycloakJwtPayload },
  ) {
    return this.settings.update(dto, actorFromToken(request.user));
  }
}
