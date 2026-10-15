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

  it('verifica en vivo si un correo está disponible', async () => {
    expect(await firstValueFrom(api.correoDisponible(' DOCENTE@example.com '))).toBe(false);
    expect(await firstValueFrom(api.correoDisponible('nueva.persona@example.com'))).toBe(true);
  });

  it('cuenta los usuarios por rol para "Roles y permisos"', async () => {
    const conteo = await firstValueFrom(api.conteoPorRol());
    const total = Object.values(conteo).reduce((a, b) => a + b, 0);

    expect(total).toBe(24);
    expect(conteo.DOCENTE).toBeGreaterThan(0);
    expect(conteo.DOCENTE_AUTORIZADO).toBeGreaterThan(0);
  });

  it('el historial muestra el último acceso y los eventos más recientes', async () => {
    const historial = await firstValueFrom(api.historial(2)); // Julián Andrés Ospina

    expect(historial.map((e) => e.titulo)).toEqual(['Inicio de sesión', 'Rol asignado: Docente', 'Usuario registrado']);
    expect(historial[1].detalle).toBe('14 feb 2026 · Diana Marcela Ruiz');
  });

  it('cambiar el rol queda en el historial con el nombre de quien lo hizo', async () => {
    await entrarComo(CORREOS.admin);
    await firstValueFrom(api.cambiarRol(2, 'DOCENTE_AUTORIZADO'));

    const historial = await firstValueFrom(api.historial(2));
    expect(historial[1].titulo).toBe('Rol asignado: Docente Autorizado');
    expect(historial[1].detalle).toContain('Diana Marcela Ruiz');
  });

  it('devuelve copias: modificar el resultado no altera los datos', async () => {
    const usuario = await firstValueFrom(api.obtener(1));
    usuario.nombre = 'Cambiado a mano';

    expect((await firstValueFrom(api.obtener(1))).nombre).not.toBe('Cambiado a mano');
  });

  it('registra correos de cualquier dominio', async () => {
    const u = await firstValueFrom(api.crear({ nombre: 'Ana Pérez', correo: 'ana.perez@gmail.com', rol: 'DOCENTE' }));
    expect(u.correo).toBe('ana.perez@gmail.com');
  });
});
