import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { RejectSuggestionDto } from './dto/reject-suggestion.dto.js';
import { SuggestionRecord } from './entities/suggestion-record.entity.js';
import { UserNotificationRecord } from './entities/user-notification-record.entity.js';
import { SuggestionActor } from './suggestion-actor.js';
import {
  suggestionBadRequest,
  suggestionConflict,
  suggestionNotFound,
} from './suggestion-errors.js';
import { SUGGESTION_RULES, type SuggestionRules } from './suggestion-rules.js';
import { SuggestionViewsService, isUuid } from './suggestion-views.service.js';

/** HE-05-HU-04 · El coordinador rechaza con motivo y retroalimentación. La guía no cambia. */
@Injectable()
export class SuggestionRejectionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly views: SuggestionViewsService,
    @Inject(SUGGESTION_RULES) private readonly rules: SuggestionRules,
  ) {}

  async reject(
    id: string,
    dto: RejectSuggestionDto,
    coordinator: SuggestionActor,
  ) {
    if (!isUuid(id))
      throw suggestionNotFound('NOT_FOUND', 'Sugerencia no encontrada');
    const now = this.views.now();
    const saved = await this.dataSource.transaction(async (manager) => {
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
      const reason = dto.reason?.trim() ?? '';
      if (!this.rules.rejectReasons.includes(reason)) {
        throw suggestionBadRequest(
          'REASON_REQUIRED',
          'Elige uno de los motivos de rechazo',
        );
      }
      const feedback = dto.feedback?.trim() ?? '';
      if (feedback.length < this.rules.feedbackMinLength) {
        throw suggestionBadRequest(
          'FEEDBACK_TOO_SHORT',
          `La retroalimentación debe tener al menos ${this.rules.feedbackMinLength} caracteres`,
        );
      }
      if (feedback.length > this.rules.feedbackMaxLength) {
        throw suggestionBadRequest(
          'FEEDBACK_TOO_LONG',
          `La retroalimentación no puede superar ${this.rules.feedbackMaxLength} caracteres`,
        );
      }

      suggestion.status = 'rejected';
      suggestion.decidedAt = now;
      suggestion.decidedById = coordinator.id;
      suggestion.decidedByName = coordinator.name;
      suggestion.rejectReason = reason;
      suggestion.feedback = feedback;
      const result = await manager.save(SuggestionRecord, suggestion);
      await manager.save(UserNotificationRecord, {
        id: randomUUID(),
        recipientId: suggestion.teacherId,
        type: 'SUGGESTION_REJECTED',
        title: `Sugerencia ${suggestion.code} rechazada`,
        message: `Motivo: ${reason}. Revisa la retroalimentación en Mis sugerencias.`,
        guideId: suggestion.guideId,
        suggestionId: suggestion.id,
        createdAt: now,
        readAt: null,
      } satisfies UserNotificationRecord);
      return result;
    });
    return this.views.toView(saved);
  }
}
