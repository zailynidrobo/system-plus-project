import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MIGRACIONES } from './migrations/index.js';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const synchronize =
          config.get<string>('DB_SYNCHRONIZE', 'false') === 'true';
        return {
          type: 'postgres',
          host: config.get<string>('DB_HOST', 'localhost'),
          port: Number(config.get<string>('DB_PORT', '5432')),
          username: config.get<string>('DB_USER', 'postgres'),
          password: config.get<string>('DB_PASSWORD', ''),
          database: config.get<string>('DB_NAME', 'gestion_guias'),
          autoLoadEntities: true,
          // Desarrollo: crea/ajusta las tablas a partir de las entidades.
          synchronize,
          // Instalación de la sala: las tablas salen de las migraciones, que se aplican al iniciar.
          migrations: MIGRACIONES,
          migrationsRun: !synchronize,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
