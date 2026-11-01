import { Controller, Get, Param, Patch, Req } from '@nestjs/common';
import type { KeycloakJwtPayload } from '../auth/keycloak.strategy.js';
import { Roles } from '../auth/roles.decorator.js';
import { NotificationsService } from './notifications.service.js';
import { actorFromToken } from './suggestion-actor.js';

/** La campana del encabezado. La consulta la puede hacer cualquier usuario con sesión. */
@Controller('academic/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Req() request: { user: KeycloakJwtPayload }) {
    return this.notifications.listFor(actorFromToken(request.user));
  }

  @Patch('read-all')
  @Roles('docente', 'docente_autorizado')
  markAllRead(@Req() request: { user: KeycloakJwtPayload }) {
    return this.notifications.markAllRead(request.user.sub);
  }

  @Patch(':id/read')
  @Roles('docente', 'docente_autorizado')
  markRead(
    @Param('id') id: string,
    @Req() request: { user: KeycloakJwtPayload },
  ) {
    return this.notifications.markRead(id, request.user.sub);
  }
}
