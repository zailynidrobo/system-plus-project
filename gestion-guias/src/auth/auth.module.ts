import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { KeycloakAuthGuard } from './keycloak-auth.guard.js';
import { KeycloakRolesGuard } from './keycloak-roles.guard.js';
import { KeycloakStrategy } from './keycloak.strategy.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { UsersModule } from '../users/users.module.js';
import { AuditActionsModule } from '../audit/actions/audit-actions.module.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'keycloak-jwt' }),
    UsersModule,
    // Inicio y cierre de sesión en el registro de auditoría (HE-08-HU-01).
    AuditActionsModule,
  ],
  providers: [
    KeycloakStrategy,
    AuthService,
    { provide: APP_GUARD, useClass: KeycloakAuthGuard },
    { provide: APP_GUARD, useClass: KeycloakRolesGuard },
  ],
  controllers: [AuthController],
})
export class AuthModule {}
