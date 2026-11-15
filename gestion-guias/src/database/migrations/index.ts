import type { MigrationInterface } from 'typeorm';
import { EsquemaInicial1794754196150 } from './1794754196150-EsquemaInicial.js';

/**
 * Migraciones en el orden en que se aplican. Con DB_SYNCHRONIZE=false (instalación de la sala)
 * la API las aplica al iniciar. Cada cambio en una entidad necesita su migración:
 *   pnpm run build && pnpm run migration:generate src/database/migrations/NombreDelCambio
 * y luego agregarla a esta lista.
 */
export const MIGRACIONES: (new () => MigrationInterface)[] = [
  EsquemaInicial1794754196150,
];
