import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  GuideStatsProvider,
  type ModuleGuideStats,
} from '../academic-program/guide-stats.provider.js';
import { AcademicGuideRecord } from './entities/academic-guide-record.entity.js';

/** Cuenta las guías reales para el resumen de módulos y competencias de HE-02. */
@Injectable()
export class TypeOrmGuideStatsProvider extends GuideStatsProvider {
  constructor(
    @InjectRepository(AcademicGuideRecord)
    private readonly guides: Repository<AcademicGuideRecord>,
  ) {
    super();
  }

  async getModuleStats(
    moduleIds: string[],
  ): Promise<Map<string, ModuleGuideStats>> {
    const stats = new Map<string, ModuleGuideStats>();
    if (moduleIds.length === 0) return stats;
    const rows = await this.guides
      .createQueryBuilder('guide')
      .select('guide.moduleId', 'moduleId')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        `COUNT(*) FILTER (WHERE "guide"."status" = 'published')`,
        'published',
      )
      .where('guide.moduleId IN (:...moduleIds)', { moduleIds })
      .groupBy('guide.moduleId')
      .getRawMany<{ moduleId: string; total: string; published: string }>();
    for (const row of rows) {
      stats.set(row.moduleId, {
        total: Number(row.total),
        published: Number(row.published),
      });
    }
    return stats;
  }

  async getPublishedCountByCompetency(
    competencyIds: string[],
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (competencyIds.length === 0) return counts;
    const rows = await this.guides
      .createQueryBuilder('guide')
      .select('guide.competencyId', 'competencyId')
      .addSelect('COUNT(*)', 'published')
      .where('guide.competencyId IN (:...competencyIds)', { competencyIds })
      .andWhere('guide.status = :status', { status: 'published' })
      .groupBy('guide.competencyId')
      .getRawMany<{ competencyId: string; published: string }>();
    for (const row of rows) {
      counts.set(row.competencyId, Number(row.published));
    }
    return counts;
  }
}
