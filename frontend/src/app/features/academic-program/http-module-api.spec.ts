import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiError } from '../../shared/models/api-error';
import { idDesdeUuid } from '../users/http-user-api';
import { HttpModuleApi } from './http-module-api';

const URL = environment.apiUrl;
const PROGRAMA = {
  id: '11111111-0000-4000-8000-000000000001',
  code: 'TS',
  name: 'Técnico en Sistemas',
};
const MODULOS = `${URL}/programs/${PROGRAMA.id}/modules`;
const MOD = {
  id: 'aaaaaaaa-0000-4000-8000-000000000001',
  programId: PROGRAMA.id,
  code: 'TS-MOD-01',
  sequence: 1,
  competencyPrefix: 'FP',
  name: 'Fundamentos de programación',
  description: 'Lógica de programación.',
  status: 'active',
  competenciesCount: 2,
  guidesCount: 0,
  publishedGuidesCount: 0,
  availableForGuides: true,
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-02T10:00:00.000Z',
};
const TODOS = { busqueda: '', estado: 'TODOS', orden: 'nombre' } as const;

describe('HttpModuleApi', () => {
  let api: HttpModuleApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HttpModuleApi, provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(HttpModuleApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** El primer paso de casi todo es averiguar el programa (GET /programs). */
  const conPrograma = () => http.expectOne(`${URL}/programs`).flush([PROGRAMA]);

  it('lista los módulos del programa con los campos del front', async () => {
    const promesa = firstValueFrom(api.listar(TODOS));
    conPrograma();
    const req = http.expectOne((r) => r.url === MODULOS);
    expect(req.request.params.get('sort')).toBe('name');
    expect(req.request.params.has('status')).toBe(false);
    req.flush([MOD]);

    const [m] = await promesa;
    expect(m).toMatchObject({
      id: idDesdeUuid(MOD.id),
      code: 'TS-MOD-01',
      sequence: 1,
      competencyPrefix: 'FP',
      status: 'active',
      availableForGuides: true,
      createdBy: null,
    });
  });

  it('envía la búsqueda, el estado y el orden como parámetros', async () => {
    const promesa = firstValueFrom(
      api.listar({ busqueda: ' poo ', estado: 'inactive', orden: 'codigo' }),
    );
    conPrograma();
    const req = http.expectOne((r) => r.url === MODULOS);
    expect(req.request.params.get('search')).toBe('poo');
    expect(req.request.params.get('status')).toBe('inactive');
    expect(req.request.params.get('sort')).toBe('code');
    req.flush([]);
    expect(await promesa).toEqual([]);
  });

  it('el resumen junta las tarjetas del programa con los módulos disponibles para guías', async () => {
    const promesa = firstValueFrom(api.resumen());
    conPrograma();
    http
      .expectOne(`${URL}/programs/${PROGRAMA.id}`)
      .flush({
        modules: { total: 5, active: 3, inactive: 1, draft: 1 },
        guides: { total: 4, published: 2 },
      });
    const disponibles = http.expectOne((r) => r.url === MODULOS);
    expect(disponibles.request.params.get('availableForGuides')).toBe('true');
    disponibles.flush([MOD, MOD]);

    expect(await promesa).toEqual({
      total: 5,
      porEstado: { draft: 1, active: 3, inactive: 1 },
      disponiblesParaGuias: 2,
      guiasPublicadas: 2,
    });
  });

  it('el detalle trae la auditoría (quién creó y editó el módulo)', async () => {
    const lista = firstValueFrom(api.listar(TODOS));
    conPrograma();
    http.expectOne((r) => r.url === MODULOS).flush([MOD]);
    await lista;

    const promesa = firstValueFrom(api.obtener(idDesdeUuid(MOD.id)));
    http.expectOne(`${URL}/modules/${MOD.id}`).flush({
      ...MOD,
      audit: {
        createdBy: { id: 'bbbbbbbb-0000-4000-8000-000000000002', name: 'Laura Muñoz' },
        updatedBy: null,
        inactivatedBy: null,
        inactivatedAt: null,
        inactivationReason: null,
      },
    });

    const m = await promesa;
    expect(m.createdBy).toEqual({
      id: idDesdeUuid('bbbbbbbb-0000-4000-8000-000000000002'),
      name: 'Laura Muñoz',
    });
    expect(m.updatedBy).toBeNull();
  });

  it('en una recarga directa rehace el listado para conocer el UUID del módulo', async () => {
    const promesa = firstValueFrom(api.obtener(idDesdeUuid(MOD.id)));
    conPrograma();
    http.expectOne((r) => r.url === MODULOS).flush([MOD]);
    http.expectOne(`${URL}/modules/${MOD.id}`).flush(MOD);
    expect((await promesa).code).toBe('TS-MOD-01');
  });

  it('registra un módulo con nombre y descripción', async () => {
    const promesa = firstValueFrom(
      api.crear({ name: '  Fundamentos  de programación ', description: ' Lógica. ' }),
    );
    conPrograma();
    const req = http.expectOne(MODULOS);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      name: 'Fundamentos de programación',
      description: 'Lógica.',
    });
    req.flush(MOD);
    expect((await promesa).code).toBe('TS-MOD-01');
  });

  it('guarda un borrador sin descripción y exige descripción al registrar', async () => {
    const borrador = firstValueFrom(api.crear({ name: 'Redes', description: '' }, true));
    conPrograma();
    const req = http.expectOne(MODULOS);
    expect(req.request.body).toEqual({ name: 'Redes', draft: true });
    req.flush({ ...MOD, status: 'draft' });
    expect((await borrador).status).toBe('draft');

    // Sin llamar al backend: la validación se hace antes.
    const error = (await firstValueFrom(api.crear({ name: 'Redes', description: '  ' })).catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(error.code).toBe('DESCRIPTION_REQUIRED');
  });

  it('un nombre repetido (409) devuelve MODULE_NAME_DUPLICATED con el módulo existente', async () => {
    const promesa = firstValueFrom(
      api.crear({ name: 'Fundamentos de programación', description: 'x' }),
    );
    conPrograma();
    http
      .expectOne(MODULOS)
      .flush(
        {
          statusCode: 409,
          code: 'MODULE_NAME_DUPLICATED',
          message: 'Ya existe',
          existingModule: MOD,
        },
        { status: 409, statusText: 'Conflict' },
      );

    const error = (await promesa.catch((e: unknown) => e)) as ApiError<{
      id: number;
      code: string;
    }>;
    expect(error.code).toBe('MODULE_NAME_DUPLICATED');
    expect(error.data).toMatchObject({ id: idDesdeUuid(MOD.id), code: 'TS-MOD-01' });
  });

  it('consulta si un nombre está disponible, excluyendo el propio módulo al editar', async () => {
    const lista = firstValueFrom(api.listar(TODOS));
    conPrograma();
    http.expectOne((r) => r.url === MODULOS).flush([MOD]);
    await lista;

    const promesa = firstValueFrom(api.disponibilidadNombre('Redes', idDesdeUuid(MOD.id)));
    const req = http.expectOne((r) => r.url === `${MODULOS}/name-availability`);
    expect(req.request.params.get('name')).toBe('Redes');
    expect(req.request.params.get('excludeModuleId')).toBe(MOD.id);
    req.flush({ available: false, existingModule: MOD });

    const r = await promesa;
    expect(r.disponible).toBe(false);
    expect(r.existente?.code).toBe('TS-MOD-01');
  });

  it('edita nombre y descripción, y no deja vacía la descripción de un módulo activo', async () => {
    const lista = firstValueFrom(api.listar(TODOS));
    conPrograma();
    http.expectOne((r) => r.url === MODULOS).flush([MOD]);
    await lista;

    const activo = firstValueFrom(
      api.actualizar(idDesdeUuid(MOD.id), { name: 'Nuevo', description: '' }),
    );
    http.expectOne(`${URL}/modules/${MOD.id}`).flush(MOD); // GET para conocer el estado
    const error = (await activo.catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe('DESCRIPTION_REQUIRED');

    const completo = firstValueFrom(
      api.actualizar(idDesdeUuid(MOD.id), { name: 'Nuevo', description: 'Texto' }),
    );
    const req = http.expectOne(`${URL}/modules/${MOD.id}`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ name: 'Nuevo', description: 'Texto' });
    req.flush({ ...MOD, name: 'Nuevo' });
    expect((await completo).name).toBe('Nuevo');
  });

  it('inhabilita con el motivo, rehabilita y registra llamando a cada acción', async () => {
    const lista = firstValueFrom(api.listar(TODOS));
    conPrograma();
    http.expectOne((r) => r.url === MODULOS).flush([MOD]);
    await lista;
    const id = idDesdeUuid(MOD.id);

    const inhabilitado = firstValueFrom(api.inhabilitar(id, ' Plan nuevo '));
    const deactivate = http.expectOne(`${URL}/modules/${MOD.id}/deactivate`);
    expect(deactivate.request.method).toBe('PATCH');
    expect(deactivate.request.body).toEqual({ reason: 'Plan nuevo' });
    deactivate.flush({ ...MOD, status: 'inactive' });
    expect((await inhabilitado).status).toBe('inactive');

    const rehabilitado = firstValueFrom(api.rehabilitar(id));
    http.expectOne(`${URL}/modules/${MOD.id}/reactivate`).flush(MOD);
    expect((await rehabilitado).status).toBe('active');

    const registrado = firstValueFrom(api.registrar(id));
    http.expectOne(`${URL}/modules/${MOD.id}/register`).flush(MOD);
    expect((await registrado).status).toBe('active');
  });

  it('traduce los errores del backend: con código, 404, 403 y caídas', async () => {
    const lista = firstValueFrom(api.listar(TODOS));
    conPrograma();
    http.expectOne((r) => r.url === MODULOS).flush([MOD]);
    await lista;
    const id = idDesdeUuid(MOD.id);
    const fallar = async (cuerpo: object, estado: number) => {
      const promesa = firstValueFrom(api.rehabilitar(id));
      http
        .expectOne(`${URL}/modules/${MOD.id}/reactivate`)
        .flush(cuerpo, { status: estado, statusText: 'Error' });
      return ((await promesa.catch((e: unknown) => e)) as ApiError).code;
    };

    expect(await fallar({ code: 'INVALID_STATUS', message: 'x' }, 409)).toBe('INVALID_STATUS');
    expect(await fallar({ message: 'Módulo no encontrado' }, 404)).toBe('NOT_FOUND');
    expect(await fallar({ message: 'Forbidden' }, 403)).toBe('SIN_PERMISO');
    expect(await fallar({ message: 'boom' }, 500)).toBe('ERROR_DE_SERVIDOR');
  });
});
