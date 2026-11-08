import { Controller, Get, Param } from '@nestjs/common';
import { Roles } from '../../auth/roles.decorator.js';
import { Role } from '../../users/entities/user.entity.js';
import { RolePermissionsService } from './role-permissions.service.js';

/** Auditoría de permisos (HE-08-HU-02). Solo el administrador la consulta. */
@Controller('audit/permissions')
@Roles(Role.ADMIN)
export class RolePermissionsController {
  constructor(private readonly permissions: RolePermissionsService) {}

  @Get()
  findAll() {
    return this.permissions.findAll();
  }

  @Get(':role')
  findOne(@Param('role') role: string) {
    return this.permissions.findOne(role);
  }
}
