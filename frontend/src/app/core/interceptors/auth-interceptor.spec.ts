import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Auth } from '../auth/auth';
import { TokenStorage } from '../auth/token-storage';
import { User } from '../../shared/models/user';
import { CORREOS, SIN_LATENCIA, entrarComo, limpiarSesion } from '../../../testing/test-helpers';
import { authInterceptor } from './auth-interceptor';

const USUARIO: User = { id: 1, nombre: 'Prueba', correo: 'p@example.com', rol: 'DOCENTE', activo: true };

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    limpiarSesion();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    limpiarSesion();
  });

  it('agrega Authorization: Bearer con el token guardado en TokenStorage', () => {
    TestBed.inject(TokenStorage).saveSession('abc123', USUARIO, false);

    http.get('/api/modulos').subscribe();

    const req = backend.expectOne('/api/modulos');
    expect(req.request.headers.get('Authorization')).toBe('Bearer abc123');
    req.flush([]);
  });

  it('también usa el token de una sesión persistente (localStorage)', () => {
    TestBed.inject(TokenStorage).saveSession('persistente', USUARIO, true);

    http.post('/api/guias', {}).subscribe();

    const req = backend.expectOne('/api/guias');
    expect(req.request.headers.get('Authorization')).toBe('Bearer persistente');
    req.flush({});
  });

  it('no agrega el encabezado si no hay sesión', () => {
    http.get('/api/publica').subscribe();

    const req = backend.expectOne('/api/publica');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('deja de enviar el token después de cerrar sesión', () => {
    const storage = TestBed.inject(TokenStorage);
    storage.saveSession('abc123', USUARIO, false);
    storage.clear();

    http.get('/api/modulos').subscribe();

    const req = backend.expectOne('/api/modulos');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });
});

describe('authInterceptor con sesión vencida', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    limpiarSesion();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        SIN_LATENCIA,
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    limpiarSesion();
  });

  it('si la API responde 401, cierra la sesión y lleva al login con el aviso', async () => {
    await entrarComo(CORREOS.docente);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    http.get('/api/modulos').subscribe({ error: () => undefined });
    backend.expectOne('/api/modulos').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(TestBed.inject(Auth).isLoggedIn()).toBe(false);
    expect(navegar).toHaveBeenCalledWith(['/login'], { queryParams: { motivo: 'sesion-vencida' } });
  });

  it('no agrega token a las rutas de sesión de la API', () => {
    TestBed.inject(TokenStorage).saveSession('abc123', USUARIO, false);

    http.post(`${environment.apiUrl}/auth/refresh`, {}).subscribe();

    const req = backend.expectOne(`${environment.apiUrl}/auth/refresh`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });
});
