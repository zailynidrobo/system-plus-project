import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { KeycloakAuthGuard } from './keycloak-auth.guard.js';
import { KeycloakRolesGuard } from './keycloak-roles.guard.js';
import { KeycloakStrategy } from './keycloak.strategy.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'keycloak-jwt' }), UsersModule],
  providers: [
    KeycloakStrategy,
    AuthService,
    { provide: APP_GUARD, useClass: KeycloakAuthGuard },
    { provide: APP_GUARD, useClass: KeycloakRolesGuard },
  ],
  controllers: [AuthController],
})
export class AuthModule {}
