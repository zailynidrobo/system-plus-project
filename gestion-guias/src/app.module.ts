import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { UsersModule } from './users/users.module.js';
import { AcademicModule } from './academic/academic.module.js';
import { AcademicProgramModule } from './academic-program/academic-program.module.js';
import { SuggestionsModule } from './suggestions/suggestions.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './database/database.module.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:
        process.env.NODE_ENV === 'test'
          ? [
              resolve(appDirectory, '.env.test'),
              resolve(appDirectory, '.env'),
            ]
          : resolve(appDirectory, '.env'),
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    AcademicModule,
    AcademicProgramModule,
    SuggestionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
