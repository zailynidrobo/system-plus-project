import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // El front corre en otro origen (Angular en :4200): sin CORS el navegador bloquea sus peticiones.
  const origins = app
    .get(ConfigService)
    .get<string>('CORS_ORIGIN', 'http://localhost:4200')
    .split(',')
    .map((origin) => origin.trim());
  app.enableCors({ origin: origins });

  await app.listen(3000);
}
void bootstrap().catch((error: unknown) => {
  console.error('No se pudo iniciar la API', error);
  process.exitCode = 1;
});
