import { Module } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';
import { TeachersController } from './teachers.controller.js';
import { KeycloakAdminService } from './keycloak-admin.service.js';
import { SessionRevocationService } from './session-revocation.service.js';

@Module({
  controllers: [UsersController, TeachersController],
  providers: [UsersService, KeycloakAdminService, SessionRevocationService],
  exports: [UsersService, KeycloakAdminService, SessionRevocationService],
})
export class UsersModule {}
