import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TokenStorage } from '../auth/token-storage';
import { User } from '../../shared/models/user';
import { limpiarSesion } from '../../../testing/test-helpers';
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
