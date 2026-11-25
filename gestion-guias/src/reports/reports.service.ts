import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { AcademicGuideRecord } from '../academic/entities/academic-guide-record.entity.js';
import {
  CurricularModule,
  CurricularModuleStatus,
} from '../academic-program/entities/curricular-module.entity.js';
import {
  businessDaysBetween,
  dateInZone,
  endOfDayInZone,
  isIsoDate,
} from '../suggestions/business-days.js';
import { CLOCK, type Clock } from '../suggestions/clock.js';
import { SuggestionRecord } from '../suggestions/entities/suggestion-record.entity.js';
import { deadlineInfo } from '../suggestions/suggestion-deadlines.js';
import type {
  GuidesByModuleRow,
  GuidesReport,
  PendingSuggestionRow,
  SuggestionsByModuleRow,
  SuggestionsReport,
} from './reports.types.js';

const ZONA = 'America/Bogota';
const ESTADO_MODULO: Record<
  CurricularModuleStatus,
  GuidesByModuleRow['moduleStatus']
> = {
  [CurricularModuleStatus.DRAFT]: 'Borrador',
  [CurricularModuleStatus.ACTIVE]: 'Activo',
  [CurricularModuleStatus.INACTIVE]: 'Inactivo',
};
const PLAZO: Record<string, PendingSuggestionRow['deadline']> = {
  on_time: 'A tiempo',
  due_soon: 'Por vencer',
  overdue: 'Vencida',
};

const redondear = (valor: number) => Math.round(valor * 10) / 10;
const promedio = (valores: number[]) =>
  valores.length
    ? redondear(valores.reduce((a, b) => a + b, 0) / valores.length)
    : null;

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(CurricularModule)
    private readonly modules: Repository<CurricularModule>,
    @InjectRepository(AcademicGuideRecord)
    private readonly guides: Repository<AcademicGuideRecord>,
    @InjectRepository(SuggestionRecord)
    private readonly suggestions: Repository<SuggestionRecord>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Guías por módulo y estado. */
  async guidesReport(): Promise<GuidesReport> {
    const [modules, guides] = await Promise.all([
      this.modules.find({ order: { sequence: 'ASC', code: 'ASC' } }),
      this.guides.find(),
    ]);
    const rows = modules.map((module) => {
      const own = guides.filter((guide) => guide.moduleId === module.id);
      const last = own.reduce<Date | null>(
        (max, guide) => (!max || guide.updatedAt > max ? guide.updatedAt : max),
        null,
      );
      return {
        moduleCode: module.code,
        moduleName: module.name,
        moduleStatus: ESTADO_MODULO[module.status],
        total: own.length,
        published: own.filter((guide) => guide.status === 'published').length,
        drafts: own.filter((guide) => guide.status === 'draft').length,
        lastUpdate: last ? last.toISOString() : null,
      };
    });
    return {
      generatedAt: this.clock.now().toISOString(),
      totals: {
        modules: modules.length,
        guides: rows.reduce((n, row) => n + row.total, 0),
        published: rows.reduce((n, row) => n + row.published, 0),
        drafts: rows.reduce((n, row) => n + row.drafts, 0),
      },
      rows,
    };
  }

  /** Sugerencias recibidas en el período, su estado y los tiempos de respuesta. */
  async suggestionsReport(query: {
    from?: string;
    to?: string;
  }): Promise<SuggestionsReport> {
    const from = this.fecha(query.from, 'from');
    const to = this.fecha(query.to, 'to');
    if (from && to && from > to) {
      throw new BadRequestException(
        'La fecha inicial debe ser anterior a la final',
      );
    }
    const desde = from ? endOfDayInZone(from, ZONA) : null;
    if (desde) desde.setTime(desde.getTime() - 24 * 60 * 60 * 1000 + 1);
    const hasta = to ? endOfDayInZone(to, ZONA) : null;
    const createdAt =
      desde && hasta
        ? Between(desde, hasta)
        : desde
          ? MoreThanOrEqual(desde)
          : hasta
            ? LessThanOrEqual(hasta)
            : undefined;

    const now = this.clock.now();
    const [modules, guides, suggestions] = await Promise.all([
      this.modules.find({ order: { sequence: 'ASC', code: 'ASC' } }),
      this.guides.find(),
      this.suggestions.find({
        where: createdAt ? { createdAt } : {},
        order: { createdAt: 'ASC' },
      }),
    ]);
    const tituloGuia = new Map(guides.map((guide) => [guide.id, guide.title]));
    const respuesta = (s: SuggestionRecord) =>
      businessDaysBetween(
        dateInZone(s.createdAt, ZONA),
        dateInZone(s.decidedAt!, ZONA),
      );
    const decididas = suggestions.filter(
      (s) => s.status !== 'pending' && s.decidedAt,
    );
    const tarde = (s: SuggestionRecord) =>
      s.decidedAt!.getTime() > s.dueAt.getTime();

    const byModule: SuggestionsByModuleRow[] = modules
      .map((module) => {
        const own = suggestions.filter((s) => s.moduleId === module.id);
        const decided = own.filter(
          (s) => s.status !== 'pending' && s.decidedAt,
        );
        return {
          moduleCode: module.code,
          moduleName: module.name,
          received: own.length,
          pending: own.filter((s) => s.status === 'pending').length,
          approved: own.filter((s) => s.status === 'approved').length,
          rejected: own.filter((s) => s.status === 'rejected').length,
          averageResponseDays: promedio(decided.map(respuesta)),
          lateDecisions: decided.filter(tarde).length,
        };
      })
      .filter((row) => row.received > 0);

    const nombreModulo = new Map(
      modules.map((module) => [module.id, module.name]),
    );
    const pending = suggestions
      .filter((s) => s.status === 'pending')
      .map((s) => {
        const info = deadlineInfo(s, now, { timeZone: ZONA });
        return {
          code: s.code,
          moduleName: nombreModulo.get(s.moduleId) ?? '',
          guideTitle: tituloGuia.get(s.guideId) ?? '',
          field: s.fieldLabel,
          teacher: s.teacherName,
          sentAt: s.createdAt.toISOString(),
          dueAt: s.dueAt.toISOString(),
          businessDaysWaiting: businessDaysBetween(
            dateInZone(s.createdAt, ZONA),
            dateInZone(now, ZONA),
          ),
          deadline: PLAZO[info.deadlineStatus ?? 'on_time'],
        };
      })
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt));

    return {
      generatedAt: now.toISOString(),
      period: { from, to },
      totals: {
        received: suggestions.length,
        pending: pending.length,
        approved: suggestions.filter((s) => s.status === 'approved').length,
        rejected: suggestions.filter((s) => s.status === 'rejected').length,
        overdue: pending.filter((row) => row.deadline === 'Vencida').length,
        averageResponseDays: promedio(decididas.map(respuesta)),
        onTimeRate: decididas.length
          ? Math.round(
              (decididas.filter((s) => !tarde(s)).length / decididas.length) *
                100,
            )
          : null,
      },
      byModule,
      pending,
    };
  }

  private fecha(valor: string | undefined, nombre: string): string | null {
    if (valor === undefined || valor === '') return null;
    if (!isIsoDate(valor)) {
      throw new BadRequestException(`${nombre} debe ser una fecha AAAA-MM-DD`);
    }
    return valor;
  }
}
