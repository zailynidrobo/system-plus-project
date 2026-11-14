import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { SessionRevocationService } from '../users/session-revocation.service.js';

export interface KeycloakJwtPayload {
  sub: string;
  email?: string;
  preferred_username?: string;
  realm_access?: { roles?: string[] };
  [claim: string]: unknown;
}

@Injectable()
export class KeycloakStrategy extends PassportStrategy(Strategy, 'keycloak-jwt') {
  constructor(
    config: ConfigService,
    private readonly revocation: SessionRevocationService,
  ) {
    const issuer = config.get<string>('KEYCLOAK_ISSUER_URL');
    const audience = config.get<string>('KEYCLOAK_AUDIENCE');

    if (!issuer || !audience) {
      throw new Error(
        'KEYCLOAK_ISSUER_URL and KEYCLOAK_AUDIENCE must be configured before starting the API',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${issuer.replace(/\/+$/, '')}/protocol/openid-connect/certs`,
      }),
      issuer,
      audience,
      algorithms: ['RS256'],
    });
  }

  validate(payload: KeycloakJwtPayload): KeycloakJwtPayload {
    // Rechaza los tokens emitidos antes de un cambio de rol o de una desactivación (DEF-02, DEF-04).
    const motivo = this.revocation.motivo(payload.sub, typeof payload.iat === 'number' ? payload.iat : undefined);
    if (motivo) throw new UnauthorizedException({ code: motivo, message: this.revocation.mensaje(motivo) });
    return payload;
  }
}
