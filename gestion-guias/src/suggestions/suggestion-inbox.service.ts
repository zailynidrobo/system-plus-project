import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { AcademicGuideRecord } from '../academic/entities/academic-guide-record.entity.js';
import { ModuleTeacherAssignmentRecord } from '../academic/entities/module-teacher-assignment-record.entity.js';
import { PersonalizedGuideVersionRecord } from '../academic/entities/personalized-guide-version-record.entity.js';
import { ListSuggestionsQuery } from './dto/list-suggestions.query.js';
import { SuggestionRecord } from './entities/suggestion-record.entity.js';
import { SuggestionViewsService } from './suggestion-views.service.js';

/** HE-05-HU-02 · El coordinador revisa las sugerencias pendientes. */
@Injectable()
export class SuggestionInboxService {
  constructor(
    @InjectRepository(SuggestionRecord)
    private readonly suggestions: Repository<SuggestionRecord>,
    @InjectRepository(AcademicGuideRecord)
    private readonly guides: Repository<AcademicGuideRecord>,
    @InjectRepository(ModuleTeacherAssignmentRecord)
    private readonly assignments: Repository<ModuleTeacherAssignmentRecord>,
    @InjectRepository(PersonalizedGuideVersionRecord)
    private readonly personalizedVersions: Repository<PersonalizedGuideVersionRecord>,
    private readonly views: SuggestionViewsService,
  ) {}

  /** Bandeja con filtros por estado, módulo, guía y plazo, ordenada por fecha de envío. */
  async list(query: ListSuggestionsQuery = {}) {
    // El plazo solo aplica a las pendientes: "aprobadas vencidas" no existen.
    const decided = query.status === 'approved' || query.status === 'rejected';
    if (query.deadline && decided) return [];
    const where: FindOptionsWhere<SuggestionRecord> = {
      ...(query.status && query.status !== 'all'
        ? { status: query.status }
        : {}),
      ...(query.moduleId ? { moduleId: query.moduleId } : {}),
      ...(query.guideId ? { guideId: query.guideId } : {}),
      ...(query.deadline ? { status: 'pending' as const } : {}),
    };
    const records = await this.suggestions.find({
      where,
      order: { createdAt: query.order === 'desc' ? 'DESC' : 'ASC' },
    });
    const views = await this.views.toViews(records);
    return query.deadline
      ? views.filter((view) => view.deadlineStatus === query.deadline)
      : views;
  }

  /** Contadores por estado y por plazo de las pendientes. */
  async summary() {
    const [pending, approved, rejected] = await Promise.all([
      this.views.toViews(await this.suggestions.findBy({ status: 'pending' })),
      this.suggestions.countBy({ status: 'approved' }),
      this.suggestions.countBy({ status: 'rejected' }),
    ]);
    return {
      pending: pending.length,
      approved,
      rejected,
      dueSoon: pending.filter((view) => view.deadlineStatus === 'due_soon')
        .length,
      overdue: pending.filter((view) => view.deadlineStatus === 'overdue')
        .length,
    };
  }

  /** Guías que tienen sugerencias, para el filtro "Guía: Todas". */
  async guidesWithSuggestions() {
    const records = await this.suggestions.find({ select: { guideId: true } });
    const ids = [...new Set(records.map((record) => record.guideId))];
    if (ids.length === 0) return [];
    const guides = await this.guides.findBy({ id: In(ids) });
    return guides
      .map((guide) => ({
        id: guide.id,
        code: guide.code ?? '',
        title: guide.title,
        version: guide.version,
        status: guide.status,
        moduleId: guide.moduleId,
        moduleName: guide.moduleName,
      }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }

  /**
   * Detalle para decidir: el valor vigente del campo (puede ser distinto del que vio el docente),
   * cuántos docentes tiene el módulo y cuántas versiones personalizadas tiene la guía.
   */
  async findForReview(id: string) {
    const record = await this.views.findOrFail(id);
    const guide = await this.guides.findOneBy({ id: record.guideId });
    const [moduleTeachers, teacherVersions] = await Promise.all([
      this.assignments.countBy({ moduleId: record.moduleId }),
      this.personalizedVersions.countBy({ baseGuideId: record.guideId }),
    ]);
    return {
      ...(await this.views.toView(record)),
      review: {
        currentGuideValue: guide?.content[record.fieldKey] ?? null,
        moduleTeachers,
        teacherVersions,
      },
    };
  }
}
