import { Controller, Get, Param, Query } from '@nestjs/common';
import { Roles } from '../../auth/roles.decorator.js';
import { Role } from '../../users/entities/user.entity.js';
import { AuditActionsService } from './audit-actions.service.js';
import { ListAuditActionsQuery } from './dto/list-audit-actions.query.js';

/** Registro de acciones de los usuarios (HE-08-HU-01). Solo el administrador lo consulta. */
@Controller('audit/actions')
@Roles(Role.ADMIN)
export class AuditActionsController {
  constructor(private readonly actions: AuditActionsService) {}

  @Get()
  findAll(@Query() query: ListAuditActionsQuery) {
    return this.actions.findAll(query);
  }

  // Antes que `:id` para que "filters" no se lea como el id de un evento.
  @Get('filters')
  filterOptions() {
    return this.actions.filterOptions();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.actions.findOne(id);
  }
}
