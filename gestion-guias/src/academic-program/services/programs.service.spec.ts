import { DataSource, EntityManager, Repository } from 'typeorm';
import { Competency } from '../entities/competency.entity.js';
import { CompetencyRevision } from '../entities/competency-revision.entity.js';
import {
  CurricularModule,
  CurricularModuleStatus,
} from '../entities/curricular-module.entity.js';
import { Program } from '../entities/program.entity.js';
import { GuideStatsProvider } from '../guide-stats.provider.js';
import { DEFAULT_CURRICULUM } from '../default-curriculum.js';
import { ProgramsService } from './programs.service.js';

describe('ProgramsService default curriculum', () => {
  it('creates the six modules and 22 competencies once', async () => {
    const program = { id: 'program-id', code: 'TS' } as Program;
    const modules: CurricularModule[] = [];
    const competencies: Competency[] = [];
    const revisions: CompetencyRevision[] = [];
    const unexpectedEntity = (entity: unknown) =>
      typeof entity === 'function' ? entity.name : String(entity);
    const manager = {
      findOne: async () => program,
      find: async (entity: Function, options: { where: Record<string, string> }) => {
        if (entity === CurricularModule) {
          return modules.filter(
            (module) => module.programId === options.where.programId,
          );
        }
        if (entity === Competency) {
          return competencies.filter(
            (competency) => competency.moduleId === options.where.moduleId,
          );
        }
        throw new Error(`Unexpected entity: ${unexpectedEntity(entity)}`);
      },
      create: (entity: new () => object, values: object) =>
        Object.assign(new entity(), values),
      save: async (
        entityOrRecord: Function | Record<string, unknown>,
        record?: Record<string, unknown>,
      ) => {
        const values = record ?? (entityOrRecord as Record<string, unknown>);
        const entity = record
          ? entityOrRecord
          : 'programId' in values
            ? CurricularModule
            : 'moduleId' in values
              ? Competency
              : CompetencyRevision;
        if (entity === CurricularModule) {
          const module = {
            ...values,
            id: values.id ?? `module-${modules.length + 1}`,
          } as unknown as CurricularModule;
          const existingIndex = modules.findIndex((item) => item.id === module.id);
          if (existingIndex < 0) modules.push(module);
          else modules[existingIndex] = module;
          return module;
        }
        if (entity === Competency) {
          const competency = {
            ...values,
            id: `competency-${competencies.length + 1}`,
          } as unknown as Competency;
          competencies.push(competency);
          return competency;
        }
        if (entity === CompetencyRevision) {
          const revision = values as unknown as CompetencyRevision;
          revisions.push(revision);
          return revision;
        }
        throw new Error(`Unexpected entity: ${unexpectedEntity(entity)}`);
      },
    };
    const dataSource = {
      transaction: <T>(
        callback: (transactionManager: EntityManager) => Promise<T>,
      ) =>
        callback(manager as unknown as EntityManager),
    } as unknown as DataSource;
    const service = new ProgramsService(
      { findOneBy: async () => program } as unknown as Repository<Program>,
      {} as Repository<CurricularModule>,
      {} as GuideStatsProvider,
      dataSource,
    );

    await service.onApplicationBootstrap();
    await service.onApplicationBootstrap();

    expect(modules).toHaveLength(DEFAULT_CURRICULUM.length);
    expect(competencies).toHaveLength(22);
    expect(revisions).toHaveLength(22);
    expect(
      modules.every(
        (module) => module.status === CurricularModuleStatus.ACTIVE,
      ),
    ).toBe(true);
    expect(modules.map((module) => module.code)).toEqual([
      'TS-MOD-01',
      'TS-MOD-02',
      'TS-MOD-03',
      'TS-MOD-04',
      'TS-MOD-05',
      'TS-MOD-06',
    ]);
  });
});
