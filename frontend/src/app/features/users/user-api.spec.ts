import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { Auth } from '../../core/auth/auth';
import { CORREOS, SIN_LATENCIA, capturarError, entrarComo, limpiarSesion } from '../../../testing/test-helpers';
import { UserApi } from './user-api';

describe('UserApi (mock compartido con el login)', () => {
  let api: UserApi;

  beforeEach(() => {
    limpiarSesion();
    TestBed.configureTestingModule({ providers: [SIN_LATENCIA] });
    api = TestBed.inject(UserApi);
  });

  afterEach(limpiarSesion);

  async function idDe(correo: string): Promise<number> {
    const pagina = await firstValueFrom(
      api.listar({ busqueda: correo, rol: 'TODOS', estado: 'TODOS', pagina: 1, porPagina: 50 }),
    );
    return pagina.items[0].id;
  }

  it('el listado incluye a los usuarios de prueba y nunca expone contraseñas', async () => {
    const pagina = await firstValueFrom(
      api.listar({ busqueda: '', rol: 'TODOS', estado: 'TODOS', pagina: 1, porPagina: 100 }),
    );
    const correos = pagina.items.map((u) => u.correo);

    expect(correos).toEqual(expect.arrayContaining(Object.values(CORREOS)));
    expect(pagina.items.every((u) => !('contrasena' in u))).toBe(true);
  });

  it('no permite registrar un correo que ya existe', async () => {
    const err = await capturarError(api.crear({ nombre: 'Otra Persona', correo: CORREOS.docente, rol: 'DOCENTE' }));
    expect(err.code).toBe('CORREO_EN_USO');
  });

  it('un usuario desactivado desde la gestión ya no puede iniciar sesión (HU-03)', async () => {
    await firstValueFrom(api.desactivar(await idDe(CORREOS.docente)));

    const err = await capturarError(
      TestBed.inject(Auth).login({ correo: CORREOS.docente, contrasena: '123456' }),
    );
    expect(err.code).toBe('CREDENCIALES_INVALIDAS');
  });

  it('el cambio de rol se aplica a la sesión sin volver a iniciarla (HU-04)', async () => {
    const auth = TestBed.inject(Auth);
    const docente = await entrarComo(CORREOS.docente);

    await firstValueFrom(api.cambiarRol(docente.id, 'COORDINADOR'));
    await firstValueFrom(auth.refrescar());

    expect(auth.user()?.rol).toBe('COORDINADOR');
  });

  it('devuelve copias: modificar el resultado no altera los datos', async () => {
    const usuario = await firstValueFrom(api.obtener(1));
    usuario.nombre = 'Cambiado a mano';

    expect((await firstValueFrom(api.obtener(1))).nombre).not.toBe('Cambiado a mano');
  });
});
