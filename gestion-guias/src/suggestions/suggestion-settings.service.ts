import {
  BadRequestException,
  Inject,
  Injectable,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateSuggestionSettingsDto } from './dto/update-suggestion-settings.dto.js';
import { SuggestionSettingsRecord } from './entities/suggestion-settings-record.entity.js';
import type { SuggestionActor } from './suggestion-actor.js';
import { SUGGESTION_RULES, type SuggestionRules } from './suggestion-rules.js';

const SETTINGS_ID = 'default';

export interface SuggestionSettings {
  dueBusinessDays: number;
  dueSoonBusinessDays: number;
  /** 'admin' si lo cambió el administrador; 'env' si rigen los valores del .env. */
  source: 'admin' | 'env';
  updatedAt: string | null;
  updatedByName: string | null;
}

/**
 * HE-09-HU-01 · El administrador configura el tiempo límite de respuesta a sugerencias.
 *
 * Las reglas (SUGGESTION_RULES) son un único objeto compartido por los servicios de sugerencias,
 * que leen el plazo cada vez que calculan un vencimiento. Este servicio guarda el valor en la
 * base de datos y lo aplica sobre ese objeto, así el cambio rige de inmediato sin reiniciar.
 * Aplica a las sugerencias que se envíen desde ese momento: las ya enviadas conservan la fecha
 * límite que se les calculó al recibirlas.
 */
@Injectable()
export class SuggestionSettingsService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(SuggestionSettingsRecord)
    private readonly records: Repository<SuggestionSettingsRecord>,
    @Inject(SUGGESTION_RULES) private readonly rules: SuggestionRules,
  ) {}

  async onApplicationBootstrap() {
    const saved = await this.records.findOneBy({ id: SETTINGS_ID });
    if (saved) this.apply(saved);
  }

  async get(): Promise<SuggestionSettings> {
    const saved = await this.records.findOneBy({ id: SETTINGS_ID });
    return this.view(saved);
  }

  async update(
    dto: UpdateSuggestionSettingsDto,
    actor: SuggestionActor,
  ): Promise<SuggestionSettings> {
    if (dto.dueSoonBusinessDays > dto.dueBusinessDays) {
      throw new BadRequestException({
        code: 'DUE_SOON_AFTER_DUE',
        message:
          'El aviso de vencimiento no puede ser mayor que el plazo de respuesta',
      });
    }
    const saved = await this.records.save({
      id: SETTINGS_ID,
      dueBusinessDays: dto.dueBusinessDays,
      dueSoonBusinessDays: dto.dueSoonBusinessDays,
      updatedById: actor.id,
      updatedByName: actor.name,
      updatedAt: new Date(),
    });
    this.apply(saved);
    return this.view(saved);
  }

  private apply(saved: SuggestionSettingsRecord) {
    this.rules.dueBusinessDays = saved.dueBusinessDays;
    this.rules.dueSoonBusinessDays = saved.dueSoonBusinessDays;
  }

  private view(saved: SuggestionSettingsRecord | null): SuggestionSettings {
    return {
      dueBusinessDays: this.rules.dueBusinessDays,
      dueSoonBusinessDays: this.rules.dueSoonBusinessDays,
      source: saved ? 'admin' : 'env',
      updatedAt: saved ? saved.updatedAt.toISOString() : null,
      updatedByName: saved ? saved.updatedByName : null,
    };
  }
}
