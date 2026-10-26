import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiError } from '../../shared/models/api-error';
import { idDesdeUuid } from '../users/http-user-api';
import { HttpCompetencyApi } from './http-competency-api';

const URL = environment.apiUrl;
const PROGRAMA_ID = '11111111-0000-4000-8000-000000000001';
const MODULO_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const LAURA = { id: 'bbbbbbbb-0000-4000-8000-000000000002', name: 'Laura Muñoz' };
const COMP = {
  id: 'cccccccc-0000-4000-8000-000000000003',
  moduleId: MODULO_ID,
  code: 'COMP-FP-01',
  sequence: 1,
  text: 'Utilizar variables, tipos de datos y operadores en programas básicos.',
  version: 1,
  status: 'active',
  publishedGuidesCount: 0,
  createdBy: LAURA,
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedBy: null,
  updatedAt: '2026-10-01T10:00:00.000Z',
  deletedBy: null,
  deletedAt: null,
};
const MODULO = idDesdeUuid(MODULO_ID);
const COMPETENCIA = idDesdeUuid(COMP.id);

describe('HttpCompetencyApi', () => {
  let api: HttpCompetencyApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HttpCompetencyApi, provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(HttpCompetencyApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Rehace lo que haría la página al recargar: programa -> módulos -> competencias del módulo. */
  const conocerModulo = () => {
    http.expectOne(`${URL}/programs`).flush([{ id: PROGRAMA_ID }]);
    http.expectOne(`${URL}/programs/${PROGRAMA_ID}/modules`).flush([{ id: MODULO_ID }]);
  };

  it('lista las competencias del módulo (recarga directa: primero conoce el UUID del módulo)', async () => {
    const promesa = firstValueFrom(api.listar(MODULO));
    conocerModulo();
    http.expectOne(`${URL}/modules/${MODULO_ID}/competencies`).flush([COMP]);

    const [c] = await promesa;
    expect(c).toMatchObject({
      id: COMPETENCIA,
      moduleId: MODULO,
      code: 'COMP-FP-01',
      sequence: 1,
      version: 1,
      status: 'active',
      createdBy: { id: idDesdeUuid(LAURA.id), name: 'Laura Muñoz' },
      updatedBy: null,
    });
  });

  it('pide el próximo código del módulo', async () => {
    const promesa = firstValueFrom(api.siguienteCodigo(MODULO));
    conocerModulo();
    http
      .expectOne(`${URL}/modules/${MODULO_ID}/competencies/next-code`)
      .flush({ code: 'COMP-FP-03' });
    expect(await promesa).toBe('COMP-FP-03');
  });

  it('crea una competencia con el texto limpio y exige texto', async () => {
    const lista = firstValueFrom(api.listar(MODULO));
    conocerModulo();
    http.expectOne(`${URL}/modules/${MODULO_ID}/competencies`).flush([]);
    await lista;

    const promesa = firstValueFrom(api.crear(MODULO, `  ${COMP.text}  `));
    const req = http.expectOne(`${URL}/modules/${MODULO_ID}/competencies`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ text: COMP.text });
    req.flush(COMP);
    expect((await promesa).code).toBe('COMP-FP-01');

    const vacio = (await firstValueFrom(api.crear(MODULO, '   ')).catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(vacio.code).toBe('TEXT_REQUIRED');
  });

  it('una competencia repetida (409) devuelve COMPETENCY_DUPLICATED con el código existente', async () => {
    const lista = firstValueFrom(api.listar(MODULO));
    conocerModulo();
    http.expectOne(`${URL}/modules/${MODULO_ID}/competencies`).flush([]);
    await lista;

    const promesa = firstValueFrom(api.crear(MODULO, COMP.text));
    http
      .expectOne(`${URL}/modules/${MODULO_ID}/competencies`)
      .flush(
        {
          code: 'COMPETENCY_DUPLICATED',
          message: 'Repetida',
          existingCompetency: { id: COMP.id, code: 'COMP-FP-01' },
        },
        { status: 409, statusText: 'Conflict' },
      );
    const error = (await promesa.catch((e: unknown) => e)) as ApiError<{ code: string }>;
    expect(error.code).toBe('COMPETENCY_DUPLICATED');
    expect(error.data?.code).toBe('COMP-FP-01');
  });

  it('un módulo inhabilitado o en borrador responde MODULE_NOT_ACTIVE', async () => {
    const promesa = firstValueFrom(api.crear(MODULO, COMP.text));
    conocerModulo();
    http
      .expectOne(`${URL}/modules/${MODULO_ID}/competencies`)
      .flush(
        { code: 'MODULE_NOT_ACTIVE', message: 'Inhabilitado' },
        { status: 409, statusText: 'Conflict' },
      );
    expect(((await promesa.catch((e: unknown) => e)) as ApiError).code).toBe('MODULE_NOT_ACTIVE');
  });

  it('edita el texto y devuelve el texto anterior', async () => {
    const lista = firstValueFrom(api.listar(MODULO));
    conocerModulo();
    http.expectOne(`${URL}/modules/${MODULO_ID}/competencies`).flush([COMP]);
    await lista;

    const promesa = firstValueFrom(api.actualizar(COMPETENCIA, 'Texto nuevo de la competencia.'));
    const req = http.expectOne(`${URL}/competencies/${COMP.id}`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ text: 'Texto nuevo de la competencia.' });
    req.flush({
      ...COMP,
      text: 'Texto nuevo de la competencia.',
      version: 2,
      previousText: COMP.text,
      previousVersion: 1,
    });

    const r = await promesa;
    expect(r.textoAnterior).toBe(COMP.text);
    expect(r.competencia).toMatchObject({ version: 2, text: 'Texto nuevo de la competencia.' });
  });

  it('elimina la competencia y devuelve cuántas quedan', async () => {
    const lista = firstValueFrom(api.listar(MODULO));
    conocerModulo();
    http.expectOne(`${URL}/modules/${MODULO_ID}/competencies`).flush([COMP]);
    await lista;

    const promesa = firstValueFrom(api.eliminar(COMPETENCIA));
    const req = http.expectOne(`${URL}/competencies/${COMP.id}`);
    expect(req.request.method).toBe('DELETE');
    req.flush({
      competency: {
        ...COMP,
        status: 'deleted',
        deletedAt: '2026-10-14T12:00:00.000Z',
        deletedBy: LAURA,
      },
      remainingActiveCompetencies: 0,
      moduleAvailableForGuides: false,
      publishedGuidesPreserved: 0,
    });

    const r = await promesa;
    expect(r.restantes).toBe(0);
    expect(r.competencia.status).toBe('deleted');
  });

  it('el historial se devuelve de la versión más nueva a la más antigua', async () => {
    const lista = firstValueFrom(api.listar(MODULO));
    conocerModulo();
    http.expectOne(`${URL}/modules/${MODULO_ID}/competencies`).flush([COMP]);
    await lista;

    const promesa = firstValueFrom(api.historial(COMPETENCIA));
    http.expectOne(`${URL}/competencies/${COMP.id}/history`).flush({
      competency: COMP,
      revisions: [
        { version: 1, text: 'Uno', editedBy: LAURA, editedAt: '2026-10-01T10:00:00.000Z' },
        { version: 2, text: 'Dos', editedBy: LAURA, editedAt: '2026-10-02T10:00:00.000Z' },
      ],
    });
    const revisiones = await promesa;
    expect(revisiones.map((r) => r.version)).toEqual([2, 1]);
    expect(revisiones[0]).toMatchObject({ competencyId: COMPETENCIA, text: 'Dos' });
  });

  it('una competencia eliminada se consulta por el historial cuando GET /competencies/:id da 404', async () => {
    const lista = firstValueFrom(api.listar(MODULO));
    conocerModulo();
    http.expectOne(`${URL}/modules/${MODULO_ID}/competencies`).flush([COMP]);
    await lista;

    const promesa = firstValueFrom(api.obtener(COMPETENCIA));
    http
      .expectOne(`${URL}/competencies/${COMP.id}`)
      .flush({ message: 'no' }, { status: 404, statusText: 'Not Found' });
    http
      .expectOne(`${URL}/competencies/${COMP.id}/history`)
      .flush({
        competency: { ...COMP, status: 'deleted', deletedAt: '2026-10-14T12:00:00.000Z' },
        revisions: [],
      });
    expect((await promesa).status).toBe('deleted');
  });

  it('todavía no hay guías en el backend: la lista de guías publicadas está vacía', async () => {
    expect(await firstValueFrom(api.guiasPublicadas(COMPETENCIA))).toEqual([]);
  });
});
