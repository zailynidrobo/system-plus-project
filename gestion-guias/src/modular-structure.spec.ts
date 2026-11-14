import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { AppModule } from './app.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { AcademicProgramModule } from './academic-program/academic-program.module.js';
import { AcademicModule } from './academic/academic.module.js';
import { TeacherSpaceModule } from './teacher-space/teacher-space.module.js';
import { SuggestionsModule } from './suggestions/suggestions.module.js';
import { GuideHistoryModule } from './guide-history/guide-history.module.js';
import { GuideSearchModule } from './guide-search/guide-search.module.js';

describe('Monolito modular (RNF-32, DEF-17)', () => {
  const negocio = {
    autenticación: AuthModule,
    'usuarios, roles y permisos': UsersModule,
    'programa, módulos y competencias': AcademicProgramModule,
    'guías base': AcademicModule,
    'espacio docente': TeacherSpaceModule,
    sugerencias: SuggestionsModule,
    historial: GuideHistoryModule,
    'consulta y búsqueda': GuideSearchModule,
  };

  it('la aplicación carga los 8 módulos de negocio', () => {
    const importados = Reflect.getMetadata('imports', AppModule) as unknown[];
    for (const modulo of Object.values(negocio)) expect(importados).toContain(modulo);
  });

  it('cada módulo tiene su propio controlador', () => {
    for (const modulo of Object.values(negocio)) {
      const controladores = (Reflect.getMetadata('controllers', modulo) as unknown[]) ?? [];
      expect(controladores.length).toBeGreaterThan(0);
    }
  });

  it('historial, búsqueda y espacio docente usan las guías solo por el módulo de guías base', () => {
    for (const modulo of [GuideHistoryModule, GuideSearchModule, TeacherSpaceModule]) {
      expect(Reflect.getMetadata('imports', modulo)).toEqual([AcademicModule]);
      expect(Reflect.getMetadata('providers', modulo) ?? []).toEqual([]);
    }
  });
});
