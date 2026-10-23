import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiError } from '../../shared/models/api-error';
import { AcademicIds } from '../academic-program/academic-ids';
import { ModuleApi } from '../academic-program/module-api';
import { GuideApi } from '../guides/guide-api';
import { HttpTeacherApi } from './http-teacher-api';

const idDe = (uuid: string) => Number.parseInt(uuid.replaceAll('-', '').slice(0, 8), 16);
const MODULE_UUID = 'aaaaaaaa-0000-4000-8000-000000000001';
const GUIDE_UUID = 'cccccccc-0000-4000-8000-000000000001';
const VERSION_UUID = 'eeeeeeee-0000-4000-8000-000000000001';
const TEACHER_UUID = 'ffffffff-0000-4000-8000-000000000001';
const BASE = `${environment.apiUrl}/academic`;

const GUIDE_VIEW = {
  id: idDe(GUIDE_UUID),
  code: 'GB-FP-01',
  moduleId: idDe(MODULE_UUID),
  version: 'v1.0',
  structureVersion: 2,
  competencyPrefix: 'FP',
  publishedBy: { id: 1, name: 'Coordinadora' },
  publishedAt: '2026-10-15T10:00:00.000Z',
  updatedAt: '2026-10-15T10:00:00.000Z',
};

const API_VERSION = {
  id: VERSION_UUID,
  baseGuideId: GUIDE_UUID,
  moduleId: MODULE_UUID,
  moduleName: 'Fundamentos de programación',
  teacherId: TEACHER_UUID,
  title: 'Guía base · Fundamentos de programación',
  name: 'FP · Grupo 2026-2',
  baseContent: { intensidad: '40 horas', objetivos: 'Texto base', criterios: 'Criterios base' },
  baseFields: [],
  content: { objetivos: 'Mi texto' },
  fields: [
    { key: 'intensidad', label: 'Intensidad horaria', type: 'text', required: true, teacherEditable: false },
    { key: 'objetivos', label: 'Objetivos', type: 'textarea', required: true, maxLength: 20, teacherEditable: true },
    { key: 'criterios', label: 'Criterios', type: 'textarea', required: false, teacherEditable: true },
  ],
  createdAt: '2026-10-16T10:00:00.000Z',
  updatedAt: '2026-10-17T10:00:00.000Z',
};

describe('HttpTeacherApi', () => {
  let api: HttpTeacherApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        HttpTeacherApi,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: GuideApi, useValue: { obtener: () => of(GUIDE_VIEW), listar: () => of({ items: [GUIDE_VIEW], total: 1 }) } },
        { provide: ModuleApi, useValue: { listar: () => of([{ id: idDe(MODULE_UUID), name: 'Fundamentos de programación' }]) } },
      ],
    });
    api = TestBed.inject(HttpTeacherApi);
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AcademicIds).registrar(MODULE_UUID);
  });

  afterEach(() => http.verify());

  it('lists only the assigned modules', async () => {
    const result = firstValueFrom(api.misModulos());
    http.expectOne(`${BASE}/my-assignments`).flush({ moduleIds: [MODULE_UUID], hidden: { total: 0, modules: [] } });

    expect((await result).map((m) => m.name)).toEqual(['Fundamentos de programación']);
  });

  it('shows assigned guides with my versions and counts the hidden ones', async () => {
    const result = firstValueFrom(api.guiasAsignadas({ busqueda: '', moduleId: null }));
    http.expectOne(`${BASE}/my-assignments`).flush({ moduleIds: [MODULE_UUID], hidden: { total: 2, modules: ['Bases de Datos'] } });
    http.expectOne(`${BASE}/personalized-versions`).flush([API_VERSION]);

    const { guias, ocultas } = await result;
    expect(guias).toHaveLength(1);
    expect(guias[0].misVersiones).toEqual([{ id: idDe(VERSION_UUID), name: 'FP · Grupo 2026-2' }]);
    expect(ocultas).toEqual({ total: 2, modulos: ['Bases de Datos'] });
  });

  it('shows a version as a full copy: what the teacher has not changed keeps the base text', async () => {
    const result = firstValueFrom(api.misVersiones());
    http.expectOne(`${BASE}/personalized-versions`).flush([API_VERSION]);

    const [version] = await result;
    expect(version).toMatchObject({
      id: idDe(VERSION_UUID),
      guideId: idDe(GUIDE_UUID),
      name: 'FP · Grupo 2026-2',
      guideCode: 'GB-FP-01',
      guideVersion: 'v1.0',
      structureVersion: 2,
      adaptedKeys: ['objetivos'],
      editableCount: 2,
      lastField: null,
    });
    expect(version.content).toEqual({ intensidad: '40 horas', objetivos: 'Mi texto', criterios: 'Criterios base' });
  });

  it('creates a version with its name for the guide UUID', async () => {
    const result = firstValueFrom(api.crearVersion(idDe(GUIDE_UUID), '  FP · Grupo   2026-2 '));
    http.expectOne((r) => r.url === `${BASE}/guides` && r.params.get('page') === '1').flush({
      items: [{ id: GUIDE_UUID }],
      total: 1,
      page: 1,
      pageSize: 100,
    });
    const post = http.expectOne(`${BASE}/guides/${GUIDE_UUID}/personalized-versions`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ name: 'FP · Grupo 2026-2' });
    post.flush(API_VERSION);

    await expect(result).resolves.toMatchObject({ id: idDe(VERSION_UUID), name: 'FP · Grupo 2026-2' });
  });

  it('turns a 403 when creating a version into GUIDE_NOT_ASSIGNED', async () => {
    const result = firstValueFrom(api.crearVersion(idDe(GUIDE_UUID), 'Mi versión'));
    http.expectOne((r) => r.url === `${BASE}/guides`).flush({ items: [{ id: GUIDE_UUID }], total: 1, page: 1, pageSize: 100 });
    http
      .expectOne(`${BASE}/guides/${GUIDE_UUID}/personalized-versions`)
      .flush({ message: 'No tienes asignado este módulo' }, { status: 403, statusText: 'Forbidden' });

    await expect(result).rejects.toMatchObject({ code: 'GUIDE_NOT_ASSIGNED' });
  });

  it('does not call the API for a field the teacher cannot edit', async () => {
    const abrir = firstValueFrom(api.misVersiones());
    http.expectOne(`${BASE}/personalized-versions`).flush([API_VERSION]);
    await abrir;

    await expect(firstValueFrom(api.guardarCampo(idDe(VERSION_UUID), 'intensidad', '99'))).rejects.toMatchObject({
      code: 'FIELD_NOT_EDITABLE',
    });
    await expect(firstValueFrom(api.guardarCampo(idDe(VERSION_UUID), 'objetivos', ''))).rejects.toBeInstanceOf(ApiError);
    await expect(
      firstValueFrom(api.guardarCampo(idDe(VERSION_UUID), 'objetivos', 'x'.repeat(21))),
    ).rejects.toMatchObject({ code: 'VALUE_TOO_LONG' });
  });

  it('saves one field with PATCH and returns the updated version', async () => {
    const abrir = firstValueFrom(api.misVersiones());
    http.expectOne(`${BASE}/personalized-versions`).flush([API_VERSION]);
    await abrir;

    const result = firstValueFrom(api.guardarCampo(idDe(VERSION_UUID), 'criterios', ' Nuevos criterios '));
    const patch = http.expectOne(`${BASE}/personalized-versions/${VERSION_UUID}`);
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ content: { criterios: 'Nuevos criterios' } });
    patch.flush({ ...API_VERSION, content: { objetivos: 'Mi texto', criterios: 'Nuevos criterios' } });

    const version = await result;
    expect(version.content['criterios']).toBe('Nuevos criterios');
    expect(version.adaptedKeys).toEqual(['objetivos', 'criterios']);
  });

  it('reports how many versions from other teachers exist, without names', async () => {
    const abrir = firstValueFrom(api.misVersiones());
    http.expectOne(`${BASE}/personalized-versions`).flush([API_VERSION]);
    await abrir;

    const result = firstValueFrom(api.aislamiento(idDe(VERSION_UUID)));
    http
      .expectOne(`${BASE}/personalized-versions/${VERSION_UUID}/isolation`)
      .flush({ moduleName: 'Fundamentos de programación', otherVersions: 3, otherTeachers: 2 });

    await expect(result).resolves.toEqual({
      otrasVersiones: 3,
      docentes: [],
      cantidadDocentes: 2,
      moduleName: 'Fundamentos de programación',
    });
  });
});
