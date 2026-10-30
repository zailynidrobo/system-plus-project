import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AcademicGuideRecord } from '../academic/entities/academic-guide-record.entity.js';
import { CurricularModule } from '../academic-program/entities/curricular-module.entity.js';
import { changeSummary } from './change-summary.js';
import { CLOCK, type Clock } from './clock.js';
import {
  SuggestionRecord,
  type SuggestionStatus,
} from './entities/suggestion-record.entity.js';
import { suggestionNotFound } from './suggestion-errors.js';
import { DeadlineInfo, deadlineInfo } from './suggestion-deadlines.js';
import { SUGGESTION_RULES, type SuggestionRules } from './suggestion-rules.js';

/** Sugerencia como la devuelve la API: el registro, su plazo y los datos de la guía y del módulo. */
export interface SuggestionView extends DeadlineInfo {
  id: string;
  code: string;
  guideId: string;
  moduleId: string;
  fieldKey: string;
  fieldLabel: string;
  teacherId: string;
  teacherName: string;
  currentValue: unknown;
  proposedValue: unknown;
  justification: string;
  neededBy: string | null;
  baseVersion: string;
  status: SuggestionStatus;
  createdAt: string;
  dueSoonAt: string;
  dueAt: string;
  decidedAt: string | null;
  decidedById: string | null;
  decidedByName: string | null;
  rejectReason: string | null;
  feedback: string | null;
  resultingVersion: string | null;
  guideCode: string;
  guideTitle: string;
  guideVersion: string;
  moduleName: string;
  competencyPrefix: string;
  /** "Agrega «...»" o "Cambia a «...»". */
  summary: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string) => UUID_PATTERN.test(value);

/** Lectura común de sugerencias (HU-01 a HU-04 y la campana). */
@Injectable()
export class SuggestionViewsService {
  constructor(
    @InjectRepository(SuggestionRecord)
    private readonly suggestions: Repository<SuggestionRecord>,
    @InjectRepository(AcademicGuideRecord)
    private readonly guides: Repository<AcademicGuideRecord>,
    @InjectRepository(CurricularModule)
    private readonly modules: Repository<CurricularModule>,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(SUGGESTION_RULES) private readonly rules: SuggestionRules,
  ) {}

  now(): Date {
    return this.clock.now();
  }

  async findOrFail(id: string): Promise<SuggestionRecord> {
    const record = isUuid(id) ? await this.suggestions.findOneBy({ id }) : null;
    if (!record)
      throw suggestionNotFound('NOT_FOUND', 'Sugerencia no encontrada');
    return record;
  }

  async toView(record: SuggestionRecord): Promise<SuggestionView> {
    return (await this.toViews([record]))[0];
  }

  /** Une cada sugerencia con su guía y su módulo (una consulta por tabla). */
  async toViews(records: SuggestionRecord[]): Promise<SuggestionView[]> {
    if (records.length === 0) return [];
    const guideIds = [...new Set(records.map((record) => record.guideId))];
    const moduleIds = [...new Set(records.map((record) => record.moduleId))];
    const [guides, modules] = await Promise.all([
      this.guides.findBy({ id: In(guideIds) }),
      this.modules.findBy({ id: In(moduleIds) }),
    ]);
    const guideById = new Map(guides.map((guide) => [guide.id, guide]));
    const moduleById = new Map(modules.map((module) => [module.id, module]));
    const now = this.clock.now();
    return records.map((record) => {
      const guide = guideById.get(record.guideId);
      const module = moduleById.get(record.moduleId);
      return {
        id: record.id,
        code: record.code,
        guideId: record.guideId,
        moduleId: record.moduleId,
        fieldKey: record.fieldKey,
        fieldLabel: record.fieldLabel,
        teacherId: record.teacherId,
        teacherName: record.teacherName,
        currentValue: record.currentValue ?? null,
        proposedValue: record.proposedValue ?? null,
        justification: record.justification,
        neededBy: record.neededBy,
        baseVersion: record.baseVersion,
        status: record.status,
        createdAt: record.createdAt.toISOString(),
        dueSoonAt: record.dueSoonAt.toISOString(),
        dueAt: record.dueAt.toISOString(),
        decidedAt: record.decidedAt?.toISOString() ?? null,
        decidedById: record.decidedById,
        decidedByName: record.decidedByName,
        rejectReason: record.rejectReason,
        feedback: record.feedback,
        resultingVersion: record.resultingVersion,
        ...deadlineInfo(record, now, this.rules),
        guideCode: guide?.code ?? '',
        guideTitle: guide?.title ?? '',
        guideVersion: guide?.version ?? '',
        moduleName: guide?.moduleName ?? module?.name ?? '',
        competencyPrefix: module?.competencyPrefix ?? '',
        summary: changeSummary(record.currentValue, record.proposedValue),
      };
    });
  }
}
