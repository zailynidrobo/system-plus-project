import {
  IsoDate,
  addBusinessDays,
  addDays,
  businessDaysBetween,
  dateInZone,
  endOfDayInZone,
} from './business-days.js';
import type { SuggestionRules } from './suggestion-rules.js';

export type DeadlineStatus = 'on_time' | 'due_soon' | 'overdue';

export interface DeadlineInfo {
  deadlineStatus: DeadlineStatus | null;
  businessDaysLeft: number | null;
  businessDaysOverdue: number | null;
}

type DeadlineRules = Pick<
  SuggestionRules,
  'dueSoonBusinessDays' | 'dueBusinessDays' | 'timeZone' | 'minNoticeDays'
>;

/** Fechas que se guardan al crear la sugerencia: fin del día hábil 5 y fin del día hábil 8. */
export function computeDeadlines(createdAt: Date, rules: DeadlineRules) {
  const sentOn = dateInZone(createdAt, rules.timeZone);
  return {
    dueSoonAt: endOfDayInZone(
      addBusinessDays(sentOn, rules.dueSoonBusinessDays),
      rules.timeZone,
    ),
    dueAt: endOfDayInZone(
      addBusinessDays(sentOn, rules.dueBusinessDays),
      rules.timeZone,
    ),
  };
}

/** Primera fecha que el docente puede pedir: fecha de envío en Bogotá + 14 días de calendario. */
export function minimumNeededBy(now: Date, rules: DeadlineRules): IsoDate {
  return addDays(dateInZone(now, rules.timeZone), rules.minNoticeDays);
}

/**
 * Estado del plazo de una sugerencia pendiente. Las decididas no tienen plazo (todo en null).
 * Una vencida no caduca: sigue pendiente y se puede decidir igual; solo se marca para seguimiento.
 */
export function deadlineInfo(
  suggestion: { status: string; dueSoonAt: Date; dueAt: Date },
  now: Date,
  rules: Pick<SuggestionRules, 'timeZone'>,
): DeadlineInfo {
  if (suggestion.status !== 'pending') {
    return {
      deadlineStatus: null,
      businessDaysLeft: null,
      businessDaysOverdue: null,
    };
  }
  const today = dateInZone(now, rules.timeZone);
  const dueDay = dateInZone(suggestion.dueAt, rules.timeZone);
  if (now.getTime() > suggestion.dueAt.getTime()) {
    return {
      deadlineStatus: 'overdue',
      businessDaysLeft: 0,
      // Si venció un viernes y hoy es sábado, igual cuenta como 1 día de retraso.
      businessDaysOverdue: Math.max(1, businessDaysBetween(dueDay, today)),
    };
  }
  return {
    deadlineStatus:
      now.getTime() > suggestion.dueSoonAt.getTime() ? 'due_soon' : 'on_time',
    businessDaysLeft: businessDaysBetween(today, dueDay),
    businessDaysOverdue: null,
  };
}
