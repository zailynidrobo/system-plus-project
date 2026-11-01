import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { AcademicGuideRecord } from '../academic/entities/academic-guide-record.entity.js';
import { calendarDaysBetween, dateInZone } from './business-days.js';
import { shortName } from './change-summary.js';
import { SuggestionRecord } from './entities/suggestion-record.entity.js';
import {
  StoredNotificationType,
  UserNotificationRecord,
} from './entities/user-notification-record.entity.js';
import { SuggestionActor, isTeacher } from './suggestion-actor.js';
import { suggestionNotFound } from './suggestion-errors.js';
import { DeadlineStatus } from './suggestion-deadlines.js';
import { SUGGESTION_RULES, type SuggestionRules } from './suggestion-rules.js';
import {
  SuggestionView,
  SuggestionViewsService,
  isUuid,
} from './suggestion-views.service.js';

export type NotificationType =
  | StoredNotificationType
  | 'SUGGESTION_OVERDUE'
  | 'SUGGESTION_DUE_SOON'
  | 'SUGGESTION_PENDING';

export type NotificationSeverity = 'danger' | 'warning' | 'info' | 'success';

export interface NotificationGuide {
  id: string;
  code: string;
  title: string;
  version: string;
  moduleName: string;
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  suggestionId?: string;
  guide: NotificationGuide | null;
}

/** Cuántas notificaciones guardadas se devuelven al docente (las más recientes). */
export const TEACHER_NOTIFICATIONS_LIMIT = 50;

const STORED_SEVERITY: Record<StoredNotificationType, NotificationSeverity> = {
  SUGGESTION_APPROVED: 'success',
  SUGGESTION_REJECTED: 'danger',
  GUIDE_NEW_VERSION: 'info',
};

const ALERT: Record<
  DeadlineStatus,
  { type: NotificationType; severity: NotificationSeverity; order: number }
> = {
  overdue: { type: 'SUGGESTION_OVERDUE', severity: 'danger', order: 0 },
  due_soon: { type: 'SUGGESTION_DUE_SOON', severity: 'warning', order: 1 },
  on_time: { type: 'SUGGESTION_PENDING', severity: 'info', order: 2 },
};

const businessDays = (n: number) =>
  `${n} ${n === 1 ? 'día hábil' : 'días hábiles'}`;

/** La campana del encabezado: alertas o notificaciones según el rol. */
@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(UserNotificationRecord)
    private readonly notifications: Repository<UserNotificationRecord>,
    @InjectRepository(SuggestionRecord)
    private readonly suggestions: Repository<SuggestionRecord>,
    @InjectRepository(AcademicGuideRecord)
    private readonly guides: Repository<AcademicGuideRecord>,
    private readonly views: SuggestionViewsService,
    @Inject(SUGGESTION_RULES) private readonly rules: SuggestionRules,
  ) {}

  /**
   *  · Coordinador: alertas calculadas de las pendientes (vencidas, por vencer, nuevas). Sin estado
   *    de leído: desaparecen cuando se deciden. El contador es el número de pendientes.
   *  · Docente: notificaciones guardadas, con leída o no leída.
   *  · Administrador (u otro rol): lista vacía por ahora.
   */
  async listFor(
    user: SuggestionActor,
  ): Promise<{ unread: number; items: NotificationItem[] }> {
    if (user.roles.includes('coordinador')) return this.coordinatorAlerts();
    if (isTeacher(user.roles)) return this.teacherNotifications(user.id);
    return { unread: 0, items: [] };
  }

  async markRead(id: string, recipientId: string) {
    const record = isUuid(id)
      ? await this.notifications.findOneBy({ id, recipientId })
      : null;
    if (!record)
      throw suggestionNotFound('NOT_FOUND', 'Notificación no encontrada');
    if (!record.readAt) {
      record.readAt = this.views.now();
      await this.notifications.save(record);
    }
    const [item] = await this.toItems([record]);
    return item;
  }

  async markAllRead(recipientId: string) {
    const result = await this.notifications.update(
      { recipientId, readAt: IsNull() },
      { readAt: this.views.now() },
    );
    return { updated: result.affected ?? 0 };
  }

  private async coordinatorAlerts() {
    const pending = await this.views.toViews(
      await this.suggestions.find({
        where: { status: 'pending' },
        order: { createdAt: 'ASC' },
      }),
    );
    const guides = await this.guideSummaries(
      pending.map((view) => view.guideId),
    );
    const items = pending
      .sort(
        (a, b) =>
          ALERT[a.deadlineStatus ?? 'on_time'].order -
            ALERT[b.deadlineStatus ?? 'on_time'].order ||
          a.dueAt.localeCompare(b.dueAt),
      )
      .map((view): NotificationItem => {
        const alert = ALERT[view.deadlineStatus ?? 'on_time'];
        return {
          id: view.id,
          type: alert.type,
          severity: alert.severity,
          title: `${view.code} · ${shortName(view.teacherName)} · ${view.guideCode}`,
          message: this.alertMessage(view),
          createdAt: view.createdAt,
          read: false,
          suggestionId: view.id,
          guide: guides.get(view.guideId) ?? null,
        };
      });
    return { unread: pending.length, items };
  }

  /** "venció hace 2 días hábiles (sigue pendiente)", "vence en 1 día hábil" o "nueva, recibida hoy". */
  private alertMessage(view: SuggestionView): string {
    if (view.deadlineStatus === 'overdue') {
      return `venció hace ${businessDays(view.businessDaysOverdue ?? 1)} (sigue pendiente)`;
    }
    if (view.deadlineStatus === 'due_soon') {
      return view.businessDaysLeft
        ? `vence en ${businessDays(view.businessDaysLeft)}`
        : 'vence hoy';
    }
    const days = calendarDaysBetween(
      dateInZone(new Date(view.createdAt), this.rules.timeZone),
      dateInZone(this.views.now(), this.rules.timeZone),
    );
    if (days <= 0) return 'nueva, recibida hoy';
    return days === 1
      ? 'nueva, recibida ayer'
      : `nueva, recibida hace ${days} días`;
  }

  private async teacherNotifications(recipientId: string) {
    const [records, unread] = await Promise.all([
      this.notifications.find({
        where: { recipientId },
        order: { createdAt: 'DESC' },
        take: TEACHER_NOTIFICATIONS_LIMIT,
      }),
      this.notifications.countBy({ recipientId, readAt: IsNull() }),
    ]);
    return { unread, items: await this.toItems(records) };
  }

  private async toItems(
    records: UserNotificationRecord[],
  ): Promise<NotificationItem[]> {
    const guides = await this.guideSummaries(
      records
        .map((record) => record.guideId)
        .filter((id): id is string => id !== null),
    );
    return records.map((record) => ({
      id: record.id,
      type: record.type,
      severity: STORED_SEVERITY[record.type],
      title: record.title,
      message: record.message,
      createdAt: record.createdAt.toISOString(),
      read: record.readAt !== null,
      ...(record.suggestionId ? { suggestionId: record.suggestionId } : {}),
      guide: record.guideId ? (guides.get(record.guideId) ?? null) : null,
    }));
  }

  /** Datos actuales de la guía para abrirla directo desde la alerta. */
  private async guideSummaries(ids: string[]) {
    const unique = [...new Set(ids)];
    const guides = unique.length
      ? await this.guides.findBy({ id: In(unique) })
      : [];
    return new Map(
      guides.map((guide): [string, NotificationGuide] => [
        guide.id,
        {
          id: guide.id,
          code: guide.code ?? '',
          title: guide.title,
          version: guide.version,
          moduleName: guide.moduleName,
        },
      ]),
    );
  }
}
