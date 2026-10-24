import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import type { GuideField } from '../academic/academic.entities.js';
import { AcademicGuideRecord } from '../academic/entities/academic-guide-record.entity.js';
import { ModuleTeacherAssignmentRecord } from '../academic/entities/module-teacher-assignment-record.entity.js';
import {
  GuideValueProblem,
  checkGuideFieldValue,
  isEmptyGuideValue,
} from '../academic/guide-field-value.js';
import { formatSpanishDate, isIsoDate } from './business-days.js';
import { comparableValue, formatSuggestionCode } from './change-summary.js';
import { CreateSuggestionDto } from './dto/create-suggestion.dto.js';
import { SuggestionRecord } from './entities/suggestion-record.entity.js';
import { SuggestionActor } from './suggestion-actor.js';
import { computeDeadlines, minimumNeededBy } from './suggestion-deadlines.js';
import {
  SuggestionErrorCode,
  suggestionBadRequest,
  suggestionConflict,
  suggestionForbidden,
  suggestionNotFound,
} from './suggestion-errors.js';
import { SUGGESTION_RULES, type SuggestionRules } from './suggestion-rules.js';
import { SuggestionViewsService, isUuid } from './suggestion-views.service.js';

/** Llave del bloqueo que serializa la asignación del consecutivo SUG-NNN. */
export const SUGGESTION_CODE_LOCK = 50_500_101;

const PENDING_INDEX = 'UQ_academic_guide_suggestions_pending_field';

const VALUE_ERRORS: Record<GuideValueProblem, [SuggestionErrorCode, string]> = {
  NOT_NUMBER: ['INVALID_NUMBER', 'El cambio propuesto debe ser un número'],
  NOT_TEXT: ['INVALID_VALUE', 'El cambio propuesto debe ser texto'],
  TOO_LONG: [
    'VALUE_TOO_LONG',
    'El cambio supera el límite de caracteres del campo',
  ],
  INVALID_DATE: [
    'INVALID_DATE',
    'El cambio propuesto debe ser una fecha válida',
  ],
  INVALID_OPTION: [
    'INVALID_OPTION',
    'El cambio propuesto no es una de las opciones del campo',
  ],
};

/** HE-05-HU-01 · El docente envía una sugerencia y sigue sus sugerencias. */
@Injectable()
export class SuggestionSubmissionService {
  constructor(
    @InjectRepository(SuggestionRecord)
    private readonly suggestions: Repository<SuggestionRecord>,
    @InjectRepository(AcademicGuideRecord)
    private readonly guides: Repository<AcademicGuideRecord>,
    @InjectRepository(ModuleTeacherAssignmentRecord)
    private readonly assignments: Repository<ModuleTeacherAssignmentRecord>,
    private readonly dataSource: DataSource,
    private readonly views: SuggestionViewsService,
    @Inject(SUGGESTION_RULES) private readonly rules: SuggestionRules,
  ) {}

  async create(
    guideId: string,
    dto: CreateSuggestionDto,
    teacher: SuggestionActor,
  ) {
    const guide = isUuid(guideId)
      ? await this.guides.findOneBy({ id: guideId })
      : null;
    if (!guide || guide.status !== 'published') {
      throw suggestionNotFound(
        'NOT_FOUND',
        'La guía no existe o no está publicada',
      );
    }
    const needsAssignment =
      !teacher.roles.includes('docente_autorizado') ||
      this.rules.authorizedTeacherNeedsAssignment;
    if (
      needsAssignment &&
      !(await this.assignments.findOneBy({
        moduleId: guide.moduleId,
        teacherId: teacher.id,
      }))
    ) {
      throw suggestionForbidden(
        'GUIDE_NOT_ASSIGNED',
        'Esta guía pertenece a un módulo que no tienes asignado',
      );
    }

    const field = guide.fields.find(
      (candidate) => candidate.key === dto.fieldKey,
    );
    if (!field) {
      throw suggestionBadRequest(
        'FIELD_NOT_FOUND',
        'El campo no existe en esta guía',
      );
    }
    const proposedValue = this.proposedValue(
      field,
      dto.proposedValue,
      guide.content[field.key],
    );
    const justification = this.justification(dto.justification);
    const now = this.views.now();
    const neededBy = this.neededBy(dto.neededBy, now);
    const deadlines = computeDeadlines(now, this.rules);

    try {
      const saved = await this.dataSource.transaction(async (manager) => {
        // Serializa los envíos simultáneos: dos sugerencias nunca reciben el mismo SUG-NNN.
        await manager.query('SELECT pg_advisory_xact_lock($1)', [
          SUGGESTION_CODE_LOCK,
        ]);
        const pending = await manager.findOneBy(SuggestionRecord, {
          guideId: guide.id,
          teacherId: teacher.id,
          fieldKey: field.key,
          status: 'pending',
        });
        if (pending) throw this.alreadyPending();
        const sequence =
          ((await manager.maximum(SuggestionRecord, 'sequence')) ?? 0) + 1;
        return manager.save(SuggestionRecord, {
          id: randomUUID(),
          sequence,
          code: formatSuggestionCode(sequence),
          guideId: guide.id,
          moduleId: guide.moduleId,
          fieldKey: field.key,
          fieldLabel: field.label,
          teacherId: teacher.id,
          teacherName: teacher.name,
          currentValue: guide.content[field.key] ?? null,
          proposedValue,
          justification,
          neededBy,
          baseVersion: guide.version,
          status: 'pending',
          createdAt: now,
          dueSoonAt: deadlines.dueSoonAt,
          dueAt: deadlines.dueAt,
          decidedAt: null,
          decidedById: null,
          decidedByName: null,
          rejectReason: null,
          feedback: null,
          resultingVersion: null,
        } satisfies SuggestionRecord);
      });
      return this.views.toView(saved);
    } catch (error) {
      // El índice único parcial también lo garantiza si dos envíos iguales llegan al tiempo.
      const pg = error as {
        code?: string;
        constraint?: string;
        driverError?: { constraint?: string };
      };
      if (
        pg.code === '23505' &&
        (pg.constraint ?? pg.driverError?.constraint) === PENDING_INDEX
      ) {
        throw this.alreadyPending();
      }
      throw error;
    }
  }

  /** Mis sugerencias, las más recientes primero. */
  async findMine(teacherId: string) {
    const records = await this.suggestions.find({
      where: { teacherId },
      order: { createdAt: 'DESC' },
    });
    return this.views.toViews(records);
  }

  /** Una sugerencia propia; si es de otro docente, "no existe". */
  async findMineOne(id: string, teacherId: string) {
    const record = await this.views.findOrFail(id);
    if (record.teacherId !== teacherId) {
      throw suggestionNotFound('NOT_FOUND', 'Sugerencia no encontrada');
    }
    return this.views.toView(record);
  }

  private proposedValue(field: GuideField, raw: unknown, current: unknown) {
    // Los formularios envían texto: se recorta y, en los campos numéricos, se convierte a número.
    let value: unknown = typeof raw === 'string' ? raw.trim() : raw;
    if (isEmptyGuideValue(value)) value = null;
    if (value === null) {
      if (field.required) {
        throw suggestionBadRequest(
          'PROPOSAL_REQUIRED',
          'Escribe el cambio que propones',
        );
      }
    } else {
      if (field.type === 'number' && typeof value === 'string') {
        value = /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value;
      }
      const problem = checkGuideFieldValue(field, value);
      if (problem) throw suggestionBadRequest(...VALUE_ERRORS[problem]);
    }
    if (comparableValue(value) === comparableValue(current)) {
      throw suggestionBadRequest(
        'NO_CHANGES',
        'El cambio propuesto es igual al contenido actual',
      );
    }
    return value;
  }

  private justification(raw: string | undefined) {
    const text = raw?.trim() ?? '';
    if (!text) {
      throw suggestionBadRequest(
        'JUSTIFICATION_REQUIRED',
        'Explica por qué propones el cambio',
      );
    }
    if (text.length < this.rules.justificationMinLength) {
      throw suggestionBadRequest(
        'JUSTIFICATION_TOO_SHORT',
        `La justificación debe tener al menos ${this.rules.justificationMinLength} caracteres`,
      );
    }
    return text;
  }

  private neededBy(raw: string | undefined, now: Date): string | null {
    const value = raw?.trim() ?? '';
    if (!value) {
      if (!this.rules.neededByRequired) return null;
      throw suggestionBadRequest(
        'NEEDED_BY_REQUIRED',
        'Indica la fecha en que necesitas el cambio aplicado',
      );
    }
    if (!isIsoDate(value)) {
      throw suggestionBadRequest(
        'NEEDED_BY_INVALID',
        'La fecha requerida debe tener el formato AAAA-MM-DD',
      );
    }
    const minimum = minimumNeededBy(now, this.rules);
    if (value < minimum) {
      throw suggestionBadRequest(
        'NOTICE_TOO_SHORT',
        `Las sugerencias se envían con al menos ${this.rules.minNoticeDays} días de anticipación: ` +
          `la fecha más próxima que puedes pedir es el ${formatSpanishDate(minimum)}`,
      );
    }
    return value;
  }

  private alreadyPending() {
    return suggestionConflict(
      'SUGGESTION_ALREADY_PENDING',
      'Ya tienes una sugerencia pendiente sobre este campo. Espera la decisión de coordinación',
    );
  }
}
