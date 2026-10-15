import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { KeycloakAuthGuard } from './keycloak-auth.guard.js';
import { KeycloakRolesGuard } from './keycloak-roles.guard.js';
import { KeycloakStrategy } from './keycloak.strategy.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'keycloak-jwt' })],
  providers: [
    KeycloakStrategy,
    { provide: APP_GUARD, useClass: KeycloakAuthGuard },
    { provide: APP_GUARD, useClass: KeycloakRolesGuard },
  ],
})
export class AuthModule {}
