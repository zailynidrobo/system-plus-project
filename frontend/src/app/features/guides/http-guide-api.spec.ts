import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Auth } from '../../core/auth/auth';
import { AcademicIds } from '../academic-program/academic-ids';
import { ModuleApi } from '../academic-program/module-api';
import { UserApi } from '../users/user-api';
import { HttpGuideApi } from './http-guide-api';

const MODULE_UUID = 'aaaaaaaa-0000-4000-8000-000000000001';
const COMPETENCY_UUID = 'bbbbbbbb-0000-4000-8000-000000000001';
const GUIDE_UUID = 'cccccccc-0000-4000-8000-000000000001';
const MODULE_ID = Number.parseInt(MODULE_UUID.replaceAll('-', '').slice(0, 8), 16);
const COMPETENCY_ID = Number.parseInt(COMPETENCY_UUID.replaceAll('-', '').slice(0, 8), 16);
const GUIDE_ID = Number.parseInt(GUIDE_UUID.replaceAll('-', '').slice(0, 8), 16);
const GUIDE_URL = `${environment.apiUrl}/academic/guides`;

const MODULE_VIEW = {
  id: MODULE_ID,
  programId: 1,
  code: 'TS-MOD-01',
  sequence: 1,
  name: 'Fundamentos de programación',
  description: null,
  status: 'active' as const,
  competencyPrefix: 'FP',
  createdBy: null,
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedBy: null,
  updatedAt: '2026-10-02T10:00:00.000Z',
  inactivatedBy: null,
  inactivatedAt: null,
  inactivationReason: null,
  competenciesCount: 1,
  guidesCount: 0,
  publishedGuidesCount: 0,
  availableForGuides: true,
};

const API_GUIDE = {
  id: GUIDE_UUID,
  code: 'GB-FP-01',
  moduleId: MODULE_UUID,
  moduleName: 'Fundamentos de programación',
  competencyId: COMPETENCY_UUID,
  competencyName: 'COMP-FP-01 · Diseñar soluciones',
  competencyDeleted: false,
  title: 'Guía base · Fundamentos de programación',
  content: { objetivos: 'Diseñar soluciones.' },
  fields: [{ key: 'objetivos', label: 'Objetivos', type: 'textarea', required: true }],
  structureVersion: 1,
  version: 'v0',
  status: 'draft' as const,
  createdBy: { id: 'dddddddd-0000-4000-8000-000000000001', name: 'Coordinadora' },
  updatedBy: { id: 'dddddddd-0000-4000-8000-000000000001', name: 'Coordinadora' },
  createdAt: '2026-10-15T10:00:00.000Z',
  updatedAt: '2026-10-15T10:00:00.000Z',
};

describe('HttpGuideApi', () => {
  let api: HttpGuideApi;
  let http: HttpTestingController;
  let ids: AcademicIds;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        HttpGuideApi,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ModuleApi,
          useValue: { listar: () => of([MODULE_VIEW]), obtener: () => of(MODULE_VIEW) },
        },
        { provide: UserApi, useValue: { listar: () => of({ items: [], total: 0 }) } },
        { provide: Auth, useValue: { user: () => ({ id: 1, nombre: 'Coordinadora' }) } },
      ],
    });
    api = TestBed.inject(HttpGuideApi);
    http = TestBed.inject(HttpTestingController);
    ids = TestBed.inject(AcademicIds);
    ids.registrar(MODULE_UUID);
    ids.registrar(COMPETENCY_UUID);
  });

  afterEach(() => http.verify());

  it('creates a draft through the API and maps its returned UUIDs for the UI', async () => {
    const resultPromise = firstValueFrom(
      api.crear({
        moduleId: MODULE_ID,
        competencyId: COMPETENCY_ID,
        content: { objetivos: 'Diseñar soluciones.' },
      }),
    );
    const request = http.expectOne(GUIDE_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      moduleId: MODULE_UUID,
      competencyId: COMPETENCY_UUID,
      content: { objetivos: 'Diseñar soluciones.' },
    });
    request.flush(API_GUIDE);

    await expect(resultPromise).resolves.toMatchObject({
      id: GUIDE_ID,
      moduleId: MODULE_ID,
      competencyId: COMPETENCY_ID,
      code: 'GB-FP-01',
      status: 'Borrador',
      competencyCode: 'COMP-FP-01',
      structureVersion: 1,
      createdBy: { name: 'Coordinadora' },
      updatedBy: { name: 'Coordinadora' },
    });
  });

  it('lists saved drafts returned by the API', async () => {
    const resultPromise = firstValueFrom(
      api.listar({
        busqueda: '',
        moduleId: null,
        competencyId: null,
        autor: null,
        estado: 'TODOS',
        pagina: 1,
        porPagina: 6,
      }),
    );
    const request = http.expectOne(
      (req) => req.url === GUIDE_URL && req.params.get('page') === '1',
    );
    expect(request.request.params.get('pageSize')).toBe('6');
    expect(request.request.params.has('search')).toBe(false);
    expect(request.request.params.has('competencyId')).toBe(false);
    expect(request.request.params.has('status')).toBe(false);
    request.flush({ items: [API_GUIDE], total: 1, page: 1, pageSize: 6 });

    await expect(resultPromise).resolves.toMatchObject({
      total: 1,
      items: [{ id: GUIDE_ID, status: 'Borrador', code: 'GB-FP-01' }],
    });
  });

  it('sends search, competency, status and page filters to the API', async () => {
    const resultPromise = firstValueFrom(
      api.listar({
        busqueda: 'objetivos',
        moduleId: null,
        competencyId: COMPETENCY_ID,
        autor: 'Coordinadora',
        estado: 'Publicada',
        pagina: 2,
        porPagina: 10,
      }),
    );
    const request = http.expectOne((req) => req.url === GUIDE_URL);
    expect(request.request.params.get('search')).toBe('objetivos');
    expect(request.request.params.get('competencyId')).toBe(COMPETENCY_UUID);
    expect(request.request.params.get('author')).toBe('Coordinadora');
    expect(request.request.params.get('status')).toBe('published');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe('10');
    request.flush({ items: [], total: 12, page: 2, pageSize: 10 });

    await expect(resultPromise).resolves.toMatchObject({ items: [], total: 12 });
  });

  it('gets list summary from the API', async () => {
    const resultPromise = firstValueFrom(api.resumen());
    http.expectOne(`${GUIDE_URL}/summary`).flush({
      total: 12,
      modulos: 4,
      publicadas: 8,
      borradores: 4,
    });
    await expect(resultPromise).resolves.toEqual({
      total: 12,
      modulos: 4,
      publicadas: 8,
      borradores: 4,
    });
  });
});
