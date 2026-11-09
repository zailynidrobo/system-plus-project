import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AcademicGuideRecord } from '../../academic/entities/academic-guide-record.entity.js';
import { PersonalizedGuideVersionRecord } from '../../academic/entities/personalized-guide-version-record.entity.js';
import { Competency } from '../../academic-program/entities/competency.entity.js';
import { CurricularModule } from '../../academic-program/entities/curricular-module.entity.js';
import { SuggestionRecord } from '../../suggestions/entities/suggestion-record.entity.js';
import type { AuditEntityType } from './audit-event.entity.js';

/** La acción que se va a registrar, tal como llegó y como respondió la API. */
export interface AuditTarget {
  method: string;
  route: string;
  params: Record<string, string | undefined>;
  body?: unknown;
  /** Undefined si la acción no se completó (acceso denegado). */
  response?: unknown;
}

/** Sobre qué se hizo la acción y en qué módulo curricular. */
export interface AuditContext {
  entityType: AuditEntityType | null;
  entityId: string | null;
  entityLabel: string | null;
  moduleId: string | null;
  moduleName: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const field = (value: unknown, key: string): string | null => {
  if (typeof value !== 'object' || value === null) return null;
  const item = (value as Record<string, unknown>)[key];
  return typeof item === 'string' && item ? item : null;
};

const label = (...parts: (string | null | undefined)[]) =>
  parts.filter(Boolean).join(' · ') || null;

/**
 * Resuelve la entidad y el módulo curricular de una acción para el registro de auditoría.
 * El módulo sale de las reglas de docs/he08-auditoria.md; usuarios y sesión no tienen módulo.
 */
@Injectable()
export class AuditContextResolver {
  constructor(
    @InjectRepository(CurricularModule)
    private readonly modules: Repository<CurricularModule>,
    @InjectRepository(Competency)
    private readonly competencies: Repository<Competency>,
    @InjectRepository(AcademicGuideRecord)
    private readonly guides: Repository<AcademicGuideRecord>,
    @InjectRepository(PersonalizedGuideVersionRecord)
    private readonly versions: Repository<PersonalizedGuideVersionRecord>,
    @InjectRepository(SuggestionRecord)
    private readonly suggestions: Repository<SuggestionRecord>,
  ) {}

  async resolve(target: AuditTarget): Promise<AuditContext> {
    const lookup = new Lookup(
      this.modules,
      this.competencies,
      this.guides,
      this.versions,
      this.suggestions,
    );
    const moduleId = await this.moduleIdOf(target, lookup);
    const module = await lookup.module(moduleId);
    const entity = await this.entityOf(target, lookup, module);
    return {
      ...entity,
      moduleId: module?.id ?? null,
      moduleName: module?.name ?? null,
    };
  }

  /** Reglas del resolvedor de módulo, en el orden de la tabla de la documentación. */
  private async moduleIdOf(
    { method, route, params, body, response }: AuditTarget,
    lookup: Lookup,
  ): Promise<string | null> {
    if (route.startsWith('/users') || route.startsWith('/auth')) return null;
    if (params.moduleId) return params.moduleId;
    if (method === 'POST' && route === '/programs/:programId/modules') {
      return field(response, 'id');
    }
    if (params.competencyId) {
      return (await lookup.competency(params.competencyId))?.moduleId ?? null;
    }
    const guideId = /\/guides\/:id\b/.test(route)
      ? params.id
      : /\/guides\/:guideId\b/.test(route)
        ? params.guideId
        : undefined;
    if (guideId) return (await lookup.guide(guideId))?.moduleId ?? null;
    if (method === 'POST' && route === '/academic/guides') {
      return field(response, 'moduleId') ?? field(body, 'moduleId');
    }
    if (route.includes('/personalized-versions/:id') && params.id) {
      return (await lookup.version(params.id))?.moduleId ?? null;
    }
    if (route.includes('/suggestions/:id') && params.id) {
      return (await lookup.suggestion(params.id))?.moduleId ?? null;
    }
    return null;
  }

  private async entityOf(
    { route, params, body, response }: AuditTarget,
    lookup: Lookup,
    module: CurricularModule | null,
  ): Promise<Omit<AuditContext, 'moduleId' | 'moduleName'>> {
    const entity = (
      entityType: AuditEntityType,
      entityId: string | null | undefined,
      entityLabel: string | null,
    ) => ({ entityType, entityId: entityId ?? null, entityLabel });
    const responseId = field(response, 'id');

    if (route.startsWith('/users')) {
      return entity(
        'user',
        params.id ?? responseId,
        field(response, 'email') ?? field(body, 'email'),
      );
    }
    if (route.includes('/teachers/:teacherId')) {
      return entity(
        'teacher_assignment',
        params.teacherId,
        params.teacherId ?? null,
      );
    }
    if (route.includes('/support-materials')) {
      const guide = await lookup.guide(params.id);
      return entity(
        'support_material',
        params.materialId ?? responseId,
        field(response, 'fileName') ?? label(guide?.code, guide?.title),
      );
    }
    if (route.includes('/personalized-versions')) {
      const id = params.id ?? responseId;
      const version = await lookup.version(id);
      return entity(
        'personalized_version',
        id,
        field(response, 'name') ?? version?.name ?? version?.title ?? null,
      );
    }
    if (route.includes('/suggestions')) {
      const id = params.id ?? responseId;
      return entity(
        'suggestion',
        id,
        field(response, 'code') ?? (await lookup.suggestion(id))?.code ?? null,
      );
    }
    if (route.startsWith('/academic/guides')) {
      const id = params.id ?? responseId;
      const guide = field(response, 'code') ? null : await lookup.guide(id);
      return entity(
        'guide',
        id,
        label(
          field(response, 'code') ?? guide?.code,
          field(response, 'title') ?? guide?.title,
        ),
      );
    }
    if (params.competencyId || route.endsWith('/competencies')) {
      const id = params.competencyId ?? responseId;
      return entity(
        'competency',
        id,
        field(response, 'code') ?? (await lookup.competency(id))?.code ?? null,
      );
    }
    if (route.includes('/modules')) {
      return entity('module', module?.id, module?.name ?? null);
    }
    return { entityType: null, entityId: null, entityLabel: null };
  }
}

/** Consultas de una sola resolución: cada registro se busca una vez y solo con ids válidos. */
class Lookup {
  private readonly cache = new Map<string, Promise<unknown>>();

  constructor(
    private readonly modules: Repository<CurricularModule>,
    private readonly competencies: Repository<Competency>,
    private readonly guides: Repository<AcademicGuideRecord>,
    private readonly versions: Repository<PersonalizedGuideVersionRecord>,
    private readonly suggestions: Repository<SuggestionRecord>,
  ) {}

  private find<T>(
    kind: string,
    id: string | null | undefined,
    load: (id: string) => Promise<T | null>,
  ): Promise<T | null> {
    if (!id || !UUID.test(id)) return Promise.resolve(null);
    const key = `${kind}:${id}`;
    if (!this.cache.has(key)) this.cache.set(key, load(id));
    return this.cache.get(key) as Promise<T | null>;
  }

  module(id: string | null | undefined) {
    return this.find('module', id, (moduleId) =>
      this.modules.findOneBy({ id: moduleId }),
    );
  }

  competency(id: string | null | undefined) {
    // Incluye las eliminadas: DELETE /competencies/:id la acaba de marcar como borrada.
    return this.find('competency', id, (competencyId) =>
      this.competencies.findOne({
        where: { id: competencyId },
        withDeleted: true,
      }),
    );
  }

  guide(id: string | null | undefined) {
    return this.find('guide', id, (guideId) =>
      this.guides.findOneBy({ id: guideId }),
    );
  }

  version(id: string | null | undefined) {
    return this.find('version', id, (versionId) =>
      this.versions.findOneBy({ id: versionId }),
    );
  }

  suggestion(id: string | null | undefined) {
    return this.find('suggestion', id, (suggestionId) =>
      this.suggestions.findOneBy({ id: suggestionId }),
    );
  }
}
