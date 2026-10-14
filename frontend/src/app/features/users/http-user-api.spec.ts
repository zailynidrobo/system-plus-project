import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiError } from '../../shared/models/api-error';
import { HttpUserApi, idDesdeUuid } from './http-user-api';

const URL = `${environment.apiUrl}/users`;
const ANA = { id: 'aaaaaaaa-0000-4000-8000-000000000001', name: 'Ana Gómez', email: 'ana@example.com', role: 'docente', isActive: true };
const LUIS = { id: 'bbbbbbbb-0000-4000-8000-000000000002', name: 'Luis Pérez', email: 'luis@example.com', role: 'admin', isActive: false };
const SIN_ROL = { id: 'cccccccc-0000-4000-8000-000000000003', name: 'Sin Rol', email: 'sinrol@example.com', role: null, isActive: true };
const TODOS = { busqueda: '', rol: 'TODOS', estado: 'TODOS', pagina: 1, porPagina: 10 } as const;

describe('HttpUserApi', () => {
  let api: HttpUserApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HttpUserApi, provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(HttpUserApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('el id numérico sale de los primeros 8 dígitos del UUID y es siempre el mismo', () => {
    expect(idDesdeUuid(ANA.id)).toBe(0xaaaaaaaa);
    expect(idDesdeUuid(ANA.id)).toBe(idDesdeUuid(ANA.id));
  });

  it('lista los usuarios del backend con los nombres y roles del front, sin los que no tienen rol', async () => {
    const promesa = firstValueFrom(api.listar(TODOS));
    http.expectOne(URL).flush([ANA, LUIS, SIN_ROL]);

    const pagina = await promesa;
    expect(pagina.total).toBe(2);
    expect(pagina.items[0]).toMatchObject({
      nombre: 'Ana Gómez',
      correo: 'ana@example.com',
      rol: 'DOCENTE',
      activo: true,
      keycloakId: ANA.id,
    });
    expect(pagina.items[1].rol).toBe('ADMINISTRADOR');
  });

  it('filtra y calcula el resumen en el front', async () => {
    const lista = firstValueFrom(api.listar({ ...TODOS, estado: 'DESACTIVADO' }));
    http.expectOne(URL).flush([ANA, LUIS]);
    expect((await lista).items.map((u) => u.correo)).toEqual(['luis@example.com']);

    const resumen = firstValueFrom(api.resumen());
    http.expectOne(URL).flush([ANA, LUIS]);
    expect(await resumen).toEqual({ total: 2, activos: 1, desactivados: 1 });
  });

  it('crea el usuario con el rol del backend y devuelve la contraseña temporal', async () => {
    const promesa = firstValueFrom(api.crear({ nombre: ' Ana Gómez ', correo: 'ANA@example.com', rol: 'DOCENTE_AUTORIZADO' }));
    const req = http.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Ana Gómez', email: 'ana@example.com', role: 'docente_autorizado' });
    req.flush({ ...ANA, role: 'docente_autorizado', temporaryPassword: 'Abc#1234xyz' });

    expect(await promesa).toMatchObject({ rol: 'DOCENTE_AUTORIZADO', contrasenaTemporal: 'Abc#1234xyz' });
  });

  it('un correo repetido (409) se traduce a CORREO_EN_USO', async () => {
    const promesa = firstValueFrom(api.crear({ nombre: 'Ana Gómez', correo: 'ana@example.com', rol: 'DOCENTE' }));
    http.expectOne(URL).flush({ message: 'El correo ya está registrado' }, { status: 409, statusText: 'Conflict' });

    await expect(promesa).rejects.toMatchObject({ code: 'CORREO_EN_USO' });
  });

  it('cambia el rol usando el UUID del usuario, aunque la página se haya recargado', async () => {
    // Sin listado previo: primero rehace el listado para conocer el UUID
    const promesa = firstValueFrom(api.cambiarRol(idDesdeUuid(ANA.id), 'COORDINADOR'));
    http.expectOne(URL).flush([ANA, LUIS]);

    const req = http.expectOne(`${URL}/${ANA.id}/role`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ role: 'coordinador' });
    req.flush({ ...ANA, role: 'coordinador' });

    expect((await promesa).rol).toBe('COORDINADOR');
  });

  it('desactivar llama a /deactivate y un usuario inexistente da NO_ENCONTRADO', async () => {
    const promesa = firstValueFrom(api.desactivar(idDesdeUuid(LUIS.id)));
    http.expectOne(URL).flush([LUIS]);
    http.expectOne(`${URL}/${LUIS.id}/deactivate`).flush({ ...LUIS, isActive: false });
    expect((await promesa).activo).toBe(false);

    const inexistente = firstValueFrom(api.obtener(12345));
    http.expectOne(URL).flush([LUIS]);
    const error = (await inexistente.catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe('NO_ENCONTRADO');
  });
});
