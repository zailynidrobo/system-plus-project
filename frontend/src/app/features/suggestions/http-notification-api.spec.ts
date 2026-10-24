import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GuideApi } from '../guides/guide-api';
import { HttpNotificationApi } from './http-notification-api';
import { HttpSuggestionApi } from './http-suggestion-api';
import { SuggestionApi } from './suggestion-api';

const idDe = (uuid: string) => Number.parseInt(uuid.replaceAll('-', '').slice(0, 8), 16);
const GUIDE_UUID = 'cccccccc-0000-4000-8000-000000000001';
const SUGGESTION_UUID = '5ab0c0de-0000-4000-8000-000000000014';
const NOTIFICATION_UUID = '0b0b0b0b-0000-4000-8000-000000000001';
const BASE = `${environment.apiUrl}/academic/notifications`;

const ITEM = {
  id: NOTIFICATION_UUID,
  type: 'SUGGESTION_APPROVED',
  severity: 'success',
  title: 'Sugerencia SUG-014 aprobada',
  message: 'Tu cambio en «Criterios» quedó en GB-POO-01 v1.1.',
  createdAt: '2026-11-03T16:00:00.000Z',
  read: false,
  suggestionId: SUGGESTION_UUID,
  guide: { id: GUIDE_UUID, code: 'GB-POO-01', title: 'Guía base · POO', version: 'v1.1', moduleName: 'POO' },
};

describe('HttpNotificationApi', () => {
  let api: HttpNotificationApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        HttpNotificationApi,
        { provide: SuggestionApi, useClass: HttpSuggestionApi },
        { provide: GuideApi, useValue: { obtener: () => of(null) } },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    api = TestBed.inject(HttpNotificationApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('trae la campana y convierte los UUID en los ids del front', async () => {
    const result = firstValueFrom(api.campana());
    http.expectOne(BASE).flush({ unread: 1, items: [ITEM] });
    expect(await result).toEqual({
      unread: 1,
      items: [
        {
          ...ITEM,
          suggestionId: idDe(SUGGESTION_UUID),
          guide: { ...ITEM.guide, id: idDe(GUIDE_UUID) },
        },
      ],
    });

    // La sugerencia queda registrada: abrirla desde la campana no vuelve a buscar el listado.
    const sugerencias = TestBed.inject(SuggestionApi) as unknown as HttpSuggestionApi;
    const mia = firstValueFrom(sugerencias.obtenerMia(idDe(SUGGESTION_UUID)));
    http.expectOne(`${environment.apiUrl}/academic/suggestions/mine/${SUGGESTION_UUID}`).flush({
      ...ITEM,
      id: SUGGESTION_UUID,
      guideId: GUIDE_UUID,
      moduleId: GUIDE_UUID,
      teacherId: GUIDE_UUID,
      status: 'approved',
    });
    await mia;
  });

  it('marca una y todas como leídas', async () => {
    const una = firstValueFrom(api.marcarLeida(NOTIFICATION_UUID));
    const req = http.expectOne(`${BASE}/${NOTIFICATION_UUID}/read`);
    expect(req.request.method).toBe('PATCH');
    req.flush({ ...ITEM, read: true });
    expect((await una).read).toBe(true);

    const todas = firstValueFrom(api.marcarTodasLeidas());
    http.expectOne(`${BASE}/read-all`).flush({ updated: 3 });
    expect(await todas).toEqual({ actualizadas: 3 });
  });

  it('una notificación ajena responde NOT_FOUND', async () => {
    const result = firstValueFrom(api.marcarLeida(NOTIFICATION_UUID));
    http
      .expectOne(`${BASE}/${NOTIFICATION_UUID}/read`)
      .flush({ statusCode: 404, error: 'Not Found', code: 'NOT_FOUND', message: 'Notificación no encontrada' }, { status: 404, statusText: 'Not Found' });
    await expect(result).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
