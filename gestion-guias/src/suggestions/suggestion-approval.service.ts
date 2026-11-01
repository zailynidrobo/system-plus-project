import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { AcademicService } from '../academic/academic.service.js';
import { AcademicGuideRecord } from '../academic/entities/academic-guide-record.entity.js';
import { GuideEventRecord } from '../academic/entities/guide-event-record.entity.js';
import { ModuleTeacherAssignmentRecord } from '../academic/entities/module-teacher-assignment-record.entity.js';
import { PersonalizedGuideVersionRecord } from '../academic/entities/personalized-guide-version-record.entity.js';
import { comparableValue, nextMinorVersion } from './change-summary.js';
import { SuggestionRecord } from './entities/suggestion-record.entity.js';
import { UserNotificationRecord } from './entities/user-notification-record.entity.js';
import { SuggestionActor } from './suggestion-actor.js';
import { suggestionConflict, suggestionNotFound } from './suggestion-errors.js';
import { SUGGESTION_RULES, type SuggestionRules } from './suggestion-rules.js';
import { SuggestionViewsService, isUuid } from './suggestion-views.service.js';

const truncate = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

/** HE-05-HU-03 · El coordinador aprueba una sugerencia y la guía base se actualiza. */
@Injectable()
export class SuggestionApprovalService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly views: SuggestionViewsService,
    private readonly academic: AcademicService,
    @Inject(SUGGESTION_RULES) private readonly rules: SuggestionRules,
  ) {}

  /**
   * En una sola transacción, con la sugerencia y la guía bloqueadas: reemplaza el campo,
   * sube la versión menor, registra el evento, marca la sugerencia y avisa a los docentes.
   * No toca las versiones personalizadas de los docentes.
   */
  async approve(id: string, coordinator: SuggestionActor) {
    if (!isUuid(id))
      throw suggestionNotFound('NOT_FOUND', 'Sugerencia no encontrada');
    const now = this.views.now();
    const result = await this.dataSource.transaction(async (manager) => {
      const suggestion = await manager.findOne(SuggestionRecord, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!suggestion)
        throw suggestionNotFound('NOT_FOUND', 'Sugerencia no encontrada');
      if (suggestion.status !== 'pending') {
        throw suggestionConflict(
          'SUGGESTION_ALREADY_DECIDED',
          'Esta sugerencia ya fue decidida',
        );
      }
      const guide = await manager.findOne(AcademicGuideRecord, {
        where: { id: suggestion.guideId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!guide || guide.status !== 'published') {
        throw suggestionConflict(
          'GUIDE_NOT_PUBLISHED',
          'La guía ya no está publicada',
        );
      }
      // Si otra sugerencia ya cambió el campo, aprobar esta borraría ese cambio.
      if (
        comparableValue(guide.content[suggestion.fieldKey]) !==
        comparableValue(suggestion.currentValue)
      ) {
        throw suggestionConflict(
          'GUIDE_CHANGED',
          'El campo cambió desde que se envió la sugerencia. Recházala para que se envíe de nuevo sobre el texto vigente',
        );
      }

      guide.content = {
        ...guide.content,
        [suggestion.fieldKey]: suggestion.proposedValue ?? null,
      };
      guide.version = nextMinorVersion(guide.version);
      guide.updatedAt = now;
      guide.updatedById = coordinator.id;
      guide.updatedByName = coordinator.name;
      await manager.save(AcademicGuideRecord, guide);
      await manager.save(GuideEventRecord, {
        id: randomUUID(),
        guideId: guide.id,
        title: truncate(
          `Sugerencia ${suggestion.code} aprobada · ${suggestion.fieldLabel} (${guide.version})`,
          250,
        ),
        authorId: coordinator.id,
        authorName: coordinator.name,
        createdAt: now,
      });

      suggestion.status = 'approved';
      suggestion.decidedAt = now;
      suggestion.decidedById = coordinator.id;
      suggestion.decidedByName = coordinator.name;
      suggestion.resultingVersion = guide.version;
      const saved = await manager.save(SuggestionRecord, suggestion);

      const others = await this.newVersionRecipients(
        manager,
        guide,
        suggestion.teacherId,
      );
      const guideCode = guide.code ?? guide.title;
      await manager.save(UserNotificationRecord, [
        {
          id: randomUUID(),
          recipientId: suggestion.teacherId,
          type: 'SUGGESTION_APPROVED' as const,
          title: `Sugerencia ${suggestion.code} aprobada`,
          message: truncate(
            `Tu cambio en «${suggestion.fieldLabel}» quedó en ${guideCode} ${guide.version}.`,
            1000,
          ),
          guideId: guide.id,
          suggestionId: suggestion.id,
          createdAt: now,
          readAt: null,
        },
        ...others.map((recipientId) => ({
          id: randomUUID(),
          recipientId,
          type: 'GUIDE_NEW_VERSION' as const,
          title: `Nueva versión ${guide.version} de ${guideCode} disponible`,
          message: truncate(
            `Coordinación actualizó «${suggestion.fieldLabel}» con una sugerencia aprobada. Tu versión personalizada no cambió.`,
            1000,
          ),
          guideId: guide.id,
          suggestionId: suggestion.id,
          createdAt: now,
          readAt: null,
        })),
      ]);
      return { saved, notifiedTeachers: others.length };
    });

    return {
      suggestion: await this.views.toView(result.saved),
      guide: await this.academic.findGuide(result.saved.guideId),
      notifications: { author: 1, newVersion: result.notifiedTeachers },
    };
  }

  /** Quién recibe "Nueva versión" (regla configurable; el autor ya recibe "aprobada"). */
  private async newVersionRecipients(
    manager: EntityManager,
    guide: AcademicGuideRecord,
    authorId: string,
  ): Promise<string[]> {
    const teacherIds =
      this.rules.newVersionRecipients === 'teachers-with-version'
        ? (
            await manager.find(PersonalizedGuideVersionRecord, {
              where: { baseGuideId: guide.id },
            })
          ).map((version) => version.teacherId)
        : (
            await manager.find(ModuleTeacherAssignmentRecord, {
              where: { moduleId: guide.moduleId },
            })
          ).map((assignment) => assignment.teacherId);
    return [...new Set(teacherIds)].filter(
      (teacherId) => teacherId !== authorId,
    );
  }
}
