import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { RolePermissionsController } from './role-permissions.controller.js';
import { RolePermissionsService } from './role-permissions.service.js';

@Module({
  imports: [DiscoveryModule],
  controllers: [RolePermissionsController],
  providers: [RolePermissionsService],
})
export class RolePermissionsModule {}
