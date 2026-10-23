import { Module } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';
import { TeachersController } from './teachers.controller.js';
import { KeycloakAdminService } from './keycloak-admin.service.js';

@Module({
  controllers: [UsersController, TeachersController],
  providers: [UsersService, KeycloakAdminService],
  exports: [UsersService],
})
export class UsersModule {}
