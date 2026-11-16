import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataSource } from 'typeorm';
import { MIGRACIONES } from './migrations/index.js';

/**
 * Conexión que usa la consola de TypeORM para generar migraciones a partir de las entidades
 * compiladas (pnpm run migration:generate). La API no la usa: su conexión está en database.module.ts.
 */
const dist = join(dirname(fileURLToPath(import.meta.url)), '..');

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? '5432'),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'gestion_guias',
  entities: [join(dist, '**/*.entity.js')],
  migrations: MIGRACIONES,
});
