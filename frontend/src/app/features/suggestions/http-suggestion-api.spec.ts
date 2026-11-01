import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AcademicIds } from '../academic-program/academic-ids';
import { GuideApi } from '../guides/guide-api';
import { HttpSuggestionApi, SuggestionResponse } from './http-suggestion-api';

const idDe = (uuid: string) => Number.parseInt(uuid.replaceAll('-', '').slice(0, 8), 16);
const GUIDE_UUID = 'cccccccc-0000-4000-8000-000000000001';
const MODULE_UUID = 'aaaaaaaa-0000-4000-8000-000000000001';
const SUGGESTION_UUID = '5ab0c0de-0000-4000-8000-000000000014';
const TEACHER_UUID = 'ffffffff-0000-4000-8000-000000000001';
const COORD_UUID = 'dddddddd-0000-4000-8000-000000000001';
const BASE = `${environment.apiUrl}/academic`;

const API_SUGGESTION: SuggestionResponse = {
  id: SUGGESTION_UUID,
  code: 'SUG-014',
  guideId: GUIDE_UUID,
  moduleId: MODULE_UUID,
  fieldKey: 'criterios',
  fieldLabel: 'Criterios de evaluación',
  teacherId: TEACHER_UUID,
  teacherName: 'Julián Andrés Ospina',
  currentValue: 'Evidencia de producto.',
  proposedValue: 'Evidencia de producto. Sustentación oral.',
  justification: 'La sustentación permite evaluar la comprensión.',
  neededBy: '2026-11-13',
  baseVersion: 'v1.0',
  status: 'pending',
  createdAt: '2026-10-30T15:00:00.000Z',
  dueSoonAt: '2026-11-10T04:59:59.999Z',
  dueAt: '2026-11-13T04:59:59.999Z',
  decidedAt: null,
  decidedById: null,
  decidedByName: null,
  rejectReason: null,
  feedback: null,
  resultingVersion: null,
  deadlineStatus: 'on_time',
  businessDaysLeft: 8,
  businessDaysOverdue: null,
  guideCode: 'GB-POO-01',
  guideTitle: 'Guía base · POO',
  guideVersion: 'v1.0',
  moduleName: 'Programación Orientada a Objetos',
  competencyPrefix: 'POO',
  summary: 'Agrega «Sustentación oral.»',
};

const NEW_GUIDE = { id: idDe(GUIDE_UUID), code: 'GB-POO-01', version: 'v1.1' };

describe('HttpSuggestionApi', () => {
  let api: HttpSuggestionApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        HttpSuggestionApi,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: GuideApi, useValue: { obtener: () => of(NEW_GUIDE) } },
      ],
    });
    api = TestBed.inject(HttpSuggestionApi);
    http = TestBed.inject(HttpTestingController);
    const ids = TestBed.inject(AcademicIds);
    ids.registrar(GUIDE_UUID);
    ids.registrar(MODULE_UUID);
  });

  afterEach(() => http.verify());

  it('envía la sugerencia con la fecha requerida y traduce la respuesta', async () => {
    const result = firstValueFrom(
      api.enviar({
        guideId: idDe(GUIDE_UUID),
        fieldKey: 'criterios',
        proposedValue: '  Evidencia de producto. Sustentación oral.  ',
        justification: 'La sustentación permite evaluar la comprensión.',
        neededBy: '2026-11-13',
      }),
    );
    const req = http.expectOne(`${BASE}/guides/${GUIDE_UUID}/suggestions`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      fieldKey: 'criterios',
      proposedValue: 'Evidencia de producto. Sustentación oral.',
      justification: 'La sustentación permite evaluar la comprensión.',
      neededBy: '2026-11-13',
    });
    req.flush(API_SUGGESTION, { status: 201, statusText: 'Created' });

    expect(await result).toMatchObject({
      id: idDe(SUGGESTION_UUID),
      code: 'SUG-014',
      guideId: idDe(GUIDE_UUID),
      moduleId: idDe(MODULE_UUID),
      teacherId: idDe(TEACHER_UUID),
      status: 'Pendiente',
      neededBy: '2026-11-13',
      deadlineStatus: 'on_time',
      businessDaysLeft: 8,
      decidedBy: null,
    });
  });

  it('traduce los errores del backend con su código', async () => {
    const result = firstValueFrom(
      api.enviar({ guideId: idDe(GUIDE_UUID), fieldKey: 'criterios', proposedValue: 'x', justification: 'y', neededBy: '2026-11-01' }),
    );
    http
      .expectOne(`${BASE}/guides/${GUIDE_UUID}/suggestions`)
      .flush(
        { statusCode: 400, error: 'Bad Request', code: 'NOTICE_TOO_SHORT', message: 'Las sugerencias se envían con al menos 14 días…' },
        { status: 400, statusText: 'Bad Request' },
      );
    await expect(result).rejects.toMatchObject({ code: 'NOTICE_TOO_SHORT' });
  });

  it('un 403 sin código (ruta de otro rol) llega como SIN_PERMISO', async () => {
    const result = firstValueFrom(api.resumen());
    http
      .expectOne(`${BASE}/suggestions/summary`)
      .flush({ statusCode: 403, message: 'No tienes el rol requerido', error: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    await expect(result).rejects.toMatchObject({ code: 'SIN_PERMISO' });
  });

  it('lista con los filtros del backend y traduce los estados', async () => {
    const result = firstValueFrom(
      api.listar({ estado: 'Pendiente', moduleId: idDe(MODULE_UUID), guideId: idDe(GUIDE_UUID), orden: 'recientes', plazo: 'overdue' }),
    );
    const req = http.expectOne((r) => r.url === `${BASE}/suggestions`);
    expect(req.request.params.get('status')).toBe('pending');
    expect(req.request.params.get('order')).toBe('desc');
    expect(req.request.params.get('moduleId')).toBe(MODULE_UUID);
    expect(req.request.params.get('guideId')).toBe(GUIDE_UUID);
    expect(req.request.params.get('deadline')).toBe('overdue');
    req.flush([
      { ...API_SUGGESTION, status: 'approved', decidedById: COORD_UUID, decidedByName: 'Laura Muñoz', resultingVersion: 'v1.1' },
    ]);
    const [s] = await result;
    expect(s.status).toBe('Aprobada');
    expect(s.decidedBy).toEqual({ id: idDe(COORD_UUID), name: 'Laura Muñoz' });

    const todas = firstValueFrom(api.listar({ estado: 'TODAS', moduleId: null, guideId: null, orden: 'antiguas' }));
    const req2 = http.expectOne((r) => r.url === `${BASE}/suggestions`);
    expect(req2.request.params.get('status')).toBe('all');
    expect(req2.request.params.get('order')).toBe('asc');
    expect(req2.request.params.has('deadline')).toBe(false);
    req2.flush([]);
    expect(await todas).toEqual([]);
  });

  it('resumen y guías con sugerencias', async () => {
    const resumen = firstValueFrom(api.resumen());
    http.expectOne(`${BASE}/suggestions/summary`).flush({ pending: 4, approved: 1, rejected: 2, dueSoon: 1, overdue: 1 });
    expect(await resumen).toEqual({ pendientes: 4, aprobadas: 1, rechazadas: 2, porVencer: 1, vencidas: 1 });

    const guias = firstValueFrom(api.guiasConSugerencias());
    http.expectOne(`${BASE}/suggestions/guides`).flush([
      { id: GUIDE_UUID, code: 'GB-POO-01', title: 'Guía base · POO', version: 'v1.0', status: 'published', moduleId: MODULE_UUID, moduleName: 'POO' },
    ]);
    expect(await guias).toEqual([expect.objectContaining({ id: idDe(GUIDE_UUID), code: 'GB-POO-01', moduleName: 'POO', status: 'Publicada' })]);
  });

  it('detalle para revisar: resuelve el UUID desde el listado si no lo conoce', async () => {
    const result = firstValueFrom(api.obtener(idDe(SUGGESTION_UUID)));
    const listado = http.expectOne((r) => r.url === `${BASE}/suggestions`);
    expect(listado.request.params.get('status')).toBe('all');
    listado.flush([API_SUGGESTION]);
    http.expectOne(`${BASE}/suggestions/${SUGGESTION_UUID}`).flush({
      ...API_SUGGESTION,
      review: { currentGuideValue: 'Texto vigente', moduleTeachers: 3, teacherVersions: 2 },
    });
    expect(await result).toMatchObject({
      sugerencia: { code: 'SUG-014' },
      valorVigente: 'Texto vigente',
      docentesDelModulo: 3,
      versionesDocentes: 2,
    });
  });

  it('aprueba, devuelve la guía actualizada y avisa con la señal decisiones', async () => {
    api.registrar(SUGGESTION_UUID);
    const antes = api.decisiones();
    const result = firstValueFrom(api.aprobar(idDe(SUGGESTION_UUID)));
    const req = http.expectOne(`${BASE}/suggestions/${SUGGESTION_UUID}/approve`);
    expect(req.request.method).toBe('PATCH');
    req.flush({
      suggestion: { ...API_SUGGESTION, status: 'approved', resultingVersion: 'v1.1', deadlineStatus: null },
      guide: { id: GUIDE_UUID },
      notifications: { author: 1, newVersion: 2 },
    });
    expect(await result).toMatchObject({ sugerencia: { status: 'Aprobada', resultingVersion: 'v1.1' }, guia: NEW_GUIDE, notificados: 2 });
    expect(api.decisiones()).toBe(antes + 1);
  });

  it('rechaza con { reason, feedback } y traduce SUGGESTION_ALREADY_DECIDED', async () => {
    api.registrar(SUGGESTION_UUID);
    const result = firstValueFrom(api.rechazar(idDe(SUGGESTION_UUID), { motivo: 'Otro motivo', retroalimentacion: 'Retroalimentación suficientemente larga.' }));
    const req = http.expectOne(`${BASE}/suggestions/${SUGGESTION_UUID}/reject`);
    expect(req.request.body).toEqual({ reason: 'Otro motivo', feedback: 'Retroalimentación suficientemente larga.' });
    req.flush(
      { statusCode: 409, error: 'Conflict', code: 'SUGGESTION_ALREADY_DECIDED', message: 'Esta sugerencia ya fue decidida' },
      { status: 409, statusText: 'Conflict' },
    );
    await expect(result).rejects.toMatchObject({ code: 'SUGGESTION_ALREADY_DECIDED' });
  });

  it('mis sugerencias y el detalle propio', async () => {
    const mias = firstValueFrom(api.misSugerencias());
    http.expectOne(`${BASE}/suggestions/mine`).flush([{ ...API_SUGGESTION, status: 'rejected', rejectReason: 'Otro motivo', feedback: 'Detalle' }]);
    expect((await mias)[0]).toMatchObject({ status: 'Rechazada', rejectReason: 'Otro motivo', feedback: 'Detalle' });

    const mia = firstValueFrom(api.obtenerMia(idDe(SUGGESTION_UUID)));
    http.expectOne(`${BASE}/suggestions/mine/${SUGGESTION_UUID}`).flush(API_SUGGESTION);
    expect((await mia).code).toBe('SUG-014');
  });
});
