import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { CORREOS, SIN_LATENCIA, capturarError, entrarComo, limpiarSesion } from '../../../testing/test-helpers';
import { MockDb } from '../../core/mock/mock-db';
import { NotificationApi } from './notification-api';
import { SuggestionApi } from './suggestion-api';

const SUG_013_PAOLA = 5;
const SUG_014_JULIAN = 6;
const FEEDBACK = 'Gracias por la propuesta. Con 40 horas no alcanzamos a sustentar a todos los estudiantes.';

describe('NotificationApi (campana, mock)', () => {
  let api: NotificationApi;
  let sugerencias: SuggestionApi;

  beforeEach(() => {
    limpiarSesion();
    TestBed.configureTestingModule({ providers: [SIN_LATENCIA] });
    api = TestBed.inject(NotificationApi);
    sugerencias = TestBed.inject(SuggestionApi);
  });

  afterEach(limpiarSesion);

  it('coordinador: una alerta por pendiente, primero las vencidas, con los datos de la guía', async () => {
    await entrarComo(CORREOS.coordinador);
    const campana = await firstValueFrom(api.campana());
    expect(campana.unread).toBe(4);
    expect(campana.items[0]).toMatchObject({
      type: 'SUGGESTION_OVERDUE',
      severity: 'danger',
      read: false,
      title: expect.stringMatching(/^SUG-011 · .+ · GB-RC-01$/),
      message: expect.stringMatching(/^venció hace \d+ días? hábil(es)? \(sigue pendiente\)$/),
      guide: expect.objectContaining({ code: 'GB-RC-01', version: expect.stringMatching(/^v\d+\.\d+$/) }),
    });
    // La de hoy (SUG-014) es nueva.
    expect(campana.items.find((n) => n.title.startsWith('SUG-014'))).toMatchObject({
      type: 'SUGGESTION_PENDING',
      message: 'nueva, recibida hoy',
      title: 'SUG-014 · Julián Ospina · GB-POO-01',
    });
  });

  it('coordinador: la alerta desaparece cuando se decide', async () => {
    await entrarComo(CORREOS.coordinador);
    await firstValueFrom(sugerencias.aprobar(SUG_014_JULIAN));
    const campana = await firstValueFrom(api.campana());
    expect(campana.unread).toBe(3);
    expect(campana.items.some((n) => n.suggestionId === SUG_014_JULIAN)).toBe(false);
  });

  it('docente: recibe aprobada, rechazada y nueva versión según su papel', async () => {
    await entrarComo(CORREOS.coordinador);
    await firstValueFrom(sugerencias.aprobar(SUG_014_JULIAN));
    await firstValueFrom(sugerencias.rechazar(SUG_013_PAOLA, { motivo: 'Otro motivo', retroalimentacion: FEEDBACK }));

    await entrarComo(CORREOS.docente);
    const julian = await firstValueFrom(api.campana());
    // Las dos de las semillas (SUG-009 y SUG-006) ya estaban leídas.
    expect(julian.unread).toBe(1);
    expect(julian.items.filter((n) => !n.read)).toEqual([
      expect.objectContaining({ type: 'SUGGESTION_APPROVED', severity: 'success', suggestionId: SUG_014_JULIAN }),
    ]);

    await entrarComo(CORREOS.autorizado);
    const paola = await firstValueFrom(api.campana());
    expect(paola.items.map((n) => n.type).sort()).toEqual(['GUIDE_NEW_VERSION', 'SUGGESTION_REJECTED']);
    expect(paola.items.find((n) => n.type === 'GUIDE_NEW_VERSION')?.guide).toMatchObject({ code: 'GB-POO-01', version: 'v1.1' });
  });

  it('docente: marca una o todas como leídas, solo las propias', async () => {
    await entrarComo(CORREOS.coordinador);
    await firstValueFrom(sugerencias.aprobar(SUG_014_JULIAN));
    await firstValueFrom(sugerencias.rechazar(SUG_013_PAOLA, { motivo: 'Otro motivo', retroalimentacion: FEEDBACK }));

    await entrarComo(CORREOS.autorizado);
    const [primera] = (await firstValueFrom(api.campana())).items;
    expect(await firstValueFrom(api.marcarLeida(primera.id))).toMatchObject({ id: primera.id, read: true });
    expect((await firstValueFrom(api.campana())).unread).toBe(1);
    expect(await firstValueFrom(api.marcarTodasLeidas())).toEqual({ actualizadas: 1 });
    expect((await firstValueFrom(api.campana())).unread).toBe(0);

    const deJulian = TestBed.inject(MockDb).notificaciones.find((n) => n.recipientId === 2)!;
    expect((await capturarError(api.marcarLeida(deJulian.id))).code).toBe('NOT_FOUND');
  });

  it('administrador: lista vacía', async () => {
    await entrarComo(CORREOS.admin);
    expect(await firstValueFrom(api.campana())).toEqual({ unread: 0, items: [] });
  });
});
