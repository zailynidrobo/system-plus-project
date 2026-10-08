import { createSign, generateKeyPairSync } from 'node:crypto';
import { createServer } from 'node:http';

export async function startKeycloakTestServer() {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const keyId = 'test-key';
  const publicJwk = {
    ...publicKey.export({ format: 'jwk' }),
    alg: 'RS256',
    kid: keyId,
    use: 'sig',
  };
  const jwksPath = '/realms/test/protocol/openid-connect/certs';
  const server = createServer((request, response) => {
    if (request.url !== jwksPath) {
      response.writeHead(404).end();
      return;
    }

    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ keys: [publicJwk] }));
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('No se pudo obtener la dirección del servidor JWKS de prueba');
  }

  const issuer = `http://127.0.0.1:${address.port}/realms/test`;
  const audience = 'test-api';

  return {
    issuer,
    audience,
    createToken(roles: string[] = []) {
      const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
      const unsignedToken = [
        encode({ alg: 'RS256', typ: 'JWT', kid: keyId }),
        encode({
          iss: issuer,
          aud: audience,
          sub: 'test-user',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 300,
          realm_access: { roles },
        }),
      ].join('.');
      const signer = createSign('RSA-SHA256');
      signer.update(unsignedToken);
      signer.end();
      return `${unsignedToken}.${signer.sign(privateKey).toString('base64url')}`;
    },
    close() {
      return new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
