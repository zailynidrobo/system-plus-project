import { BadRequestException } from '@nestjs/common';
import { ROLES_KEY } from '../auth/keycloak-roles.guard.js';
import { SuggestionSettingsController } from './suggestion-settings.controller.js';
import type { SuggestionSettingsRecord } from './entities/suggestion-settings-record.entity.js';
import { computeDeadlines } from './suggestion-deadlines.js';
import { DEFAULT_SUGGESTION_RULES, type SuggestionRules } from './suggestion-rules.js';
import { SuggestionSettingsService } from './suggestion-settings.service.js';

const ADMIN = { id: 'admin-1', name: 'Andrea Salazar', roles: ['admin'] };

/** Repositorio en memoria con lo que el servicio usa: findOneBy y save. */
function memoryRepository() {
  let row: SuggestionSettingsRecord | null = null;
  return {
    findOneBy: async () => row,
    save: async (value: SuggestionSettingsRecord) => (row = { ...value }),
  };
}

describe('HE-09-HU-01 · Tiempo límite de respuesta a sugerencias', () => {
  let rules: SuggestionRules;
  let repository: ReturnType<typeof memoryRepository>;
  let service: SuggestionSettingsService;

  beforeEach(() => {
    rules = { ...DEFAULT_SUGGESTION_RULES };
    repository = memoryRepository();
    service = new SuggestionSettingsService(repository as never, rules);
  });

  it('sin configuración guardada muestra los valores del .env', async () => {
    const settings = await service.get();
    expect(settings).toMatchObject({
      dueBusinessDays: DEFAULT_SUGGESTION_RULES.dueBusinessDays,
      dueSoonBusinessDays: DEFAULT_SUGGESTION_RULES.dueSoonBusinessDays,
      source: 'env',
      updatedByName: null,
    });
  });

  it('el administrador cambia el plazo y queda registrado quién lo hizo', async () => {
    const settings = await service.update({ dueBusinessDays: 10, dueSoonBusinessDays: 7 }, ADMIN);
    expect(settings).toMatchObject({
      dueBusinessDays: 10,
      dueSoonBusinessDays: 7,
      source: 'admin',
      updatedByName: 'Andrea Salazar',
    });
    expect(settings.updatedAt).not.toBeNull();
  });

  it('las sugerencias que se envíen desde el cambio usan el nuevo plazo, sin reiniciar', async () => {
    const sentAt = new Date('2026-11-23T15:00:00Z'); // lunes 23 de noviembre en Bogotá
    const bogota = (date: Date) => date.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const before = computeDeadlines(sentAt, rules);
    await service.update({ dueBusinessDays: 3, dueSoonBusinessDays: 2 }, ADMIN);
    const after = computeDeadlines(sentAt, rules);
    expect(after.dueAt.getTime()).toBeLessThan(before.dueAt.getTime());
    expect(bogota(after.dueAt)).toBe('2026-11-26');
    expect(bogota(after.dueSoonAt)).toBe('2026-11-25');
  });

  it('al reiniciar la API se recupera el valor guardado', async () => {
    await service.update({ dueBusinessDays: 12, dueSoonBusinessDays: 9 }, ADMIN);
    const freshRules = { ...DEFAULT_SUGGESTION_RULES };
    const restarted = new SuggestionSettingsService(repository as never, freshRules);
    await restarted.onApplicationBootstrap();
    expect(freshRules.dueBusinessDays).toBe(12);
    expect(freshRules.dueSoonBusinessDays).toBe(9);
  });

  it('el aviso no puede ser mayor que el plazo', async () => {
    await expect(
      service.update({ dueBusinessDays: 4, dueSoonBusinessDays: 6 }, ADMIN),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(rules.dueBusinessDays).toBe(DEFAULT_SUGGESTION_RULES.dueBusinessDays);
  });

  it('solo el administrador lo cambia; el coordinador puede consultarlo', () => {
    expect(Reflect.getMetadata(ROLES_KEY, SuggestionSettingsController)).toEqual(['admin']);
    expect(
      Reflect.getMetadata(ROLES_KEY, SuggestionSettingsController.prototype.get),
    ).toEqual(['admin', 'coordinador']);
  });
});
