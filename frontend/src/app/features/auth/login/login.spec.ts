import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { Auth } from '../../../core/auth/auth';
import { ApiError } from '../../../shared/models/api-error';
import { CambioContrasenaTemporal, User } from '../../../shared/models/user';
import { Login } from './login';

const COORDINADOR: User = {
  id: 1,
  nombre: 'Laura',
  correo: 'coordinador@example.com',
  rol: 'COORDINADOR',
  activo: true,
};

/** Auth falsa: cada prueba decide qué responden el login y el cambio de contraseña. */
class AuthFalsa {
  loginExterno = false;
  problemaLogin = () => null;
  respuestaLogin: () => Observable<User> = () => of(COORDINADOR);
  respuestaCambio: () => Observable<User> = () => of(COORDINADOR);
  cambio: CambioContrasenaTemporal | null = null;
  login = () => this.respuestaLogin();
  cambiarContrasenaTemporal = (datos: CambioContrasenaTemporal) => {
    this.cambio = datos;
    return this.respuestaCambio();
  };
  logout = () => undefined;
}

const falla = (code: string) => () => throwError(() => new ApiError(code));

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let component: Login;
  let auth: AuthFalsa;

  async function crear(motivo?: string) {
    auth = new AuthFalsa();
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: auth },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(motivo ? { motivo } : {}) } },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  function llenarCredenciales() {
    component.form.setValue({
      correo: 'nuevo@example.com',
      contrasena: 'Temporal123',
      recordar: false,
    });
  }

  it('entra y lleva al inicio del rol', async () => {
    await crear();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    llenarCredenciales();

    component.enviar();

    expect(navegar).toHaveBeenCalledWith('/inicio');
  });

  it('con credenciales inválidas muestra el mensaje genérico y avisa del bloqueo', async () => {
    await crear();
    auth.respuestaLogin = falla('CREDENCIALES_INVALIDAS');
    llenarCredenciales();

    component.enviar();
    fixture.detectChanges();

    expect(texto()).toContain('Las credenciales ingresadas no son válidas');
    expect(texto()).toContain('5 intentos fallidos');
  });

  it('si la API o Keycloak no responden, no dice que las credenciales están mal', async () => {
    await crear();
    auth.respuestaLogin = falla('SERVICIO_NO_DISPONIBLE');
    llenarCredenciales();

    component.enviar();
    fixture.detectChanges();

    expect(texto()).toContain('No pudimos conectar con el servicio de acceso');
    expect(texto()).not.toContain('no son válidas');
  });

  it('avisa cuando la sesión anterior terminó', async () => {
    await crear('sesion-vencida');
    fixture.detectChanges();

    expect(texto()).toContain('Tu sesión terminó');
  });

  describe('primer ingreso con contraseña temporal', () => {
    beforeEach(async () => {
      await crear();
      auth.respuestaLogin = falla('CAMBIO_CONTRASENA_REQUERIDO');
      llenarCredenciales();
      component.enviar();
      fixture.detectChanges();
    });

    it('pide crear una contraseña nueva', () => {
      expect(component.paso()).toBe('contrasena-nueva');
      expect(texto()).toContain('Crea tu contraseña');
    });

    it('exige al menos 8 caracteres y que las dos coincidan', () => {
      component.formNueva.setValue({ nueva: 'corta', confirmar: 'corta' });
      component.enviarNueva();
      expect(component.mensajeNueva()).toBe('Usa al menos 8 caracteres.');

      component.formNueva.setValue({ nueva: 'Definitiva123', confirmar: 'Otra12345' });
      component.enviarNueva();
      expect(component.mensajeConfirmar()).toBe('Las contraseñas no coinciden.');
      expect(auth.cambio).toBeNull();
    });

    it('envía la temporal y la nueva, y entra', () => {
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      component.formNueva.setValue({ nueva: 'Definitiva123', confirmar: 'Definitiva123' });

      component.enviarNueva();

      expect(auth.cambio).toEqual({
        correo: 'nuevo@example.com',
        contrasenaTemporal: 'Temporal123',
        contrasenaNueva: 'Definitiva123',
      });
      expect(navegar).toHaveBeenCalledWith('/inicio');
    });

    it('si la temporal ya no sirve, vuelve al inicio de sesión con el aviso', () => {
      auth.respuestaCambio = falla('CREDENCIALES_INVALIDAS');
      component.formNueva.setValue({ nueva: 'Definitiva123', confirmar: 'Definitiva123' });

      component.enviarNueva();

      expect(component.paso()).toBe('credenciales');
      expect(component.aviso()).toBe('CREDENCIALES_INVALIDAS');
    });
  });
});
