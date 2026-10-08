import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface KeycloakJwtPayload {
  sub: string;
  email?: string;
  preferred_username?: string;
  realm_access?: { roles?: string[] };
  [claim: string]: unknown;
}

@Injectable()
export class KeycloakStrategy extends PassportStrategy(Strategy, 'keycloak-jwt') {
  constructor(config: ConfigService) {
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
    return payload;
  }
}
