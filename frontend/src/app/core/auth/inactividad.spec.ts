import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Auth } from './auth';
import { Inactividad, INACTIVIDAD_MAX_MS } from './inactividad';
import { TokenStorage } from './token-storage';

describe('Inactividad', () => {
  const logout = vi.fn();
  const navigate = vi.fn(async () => true);
  let persistente = false;
  let inactividad: Inactividad;

  beforeEach(() => {
    logout.mockClear();
    navigate.mockClear();
    persistente = false;
    TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: { user: () => ({ rol: 'DOCENTE' }), logout } },
        { provide: TokenStorage, useValue: { esPersistente: () => persistente } },
        { provide: Router, useValue: { navigate } },
      ],
    });
    inactividad = TestBed.inject(Inactividad);
    inactividad.iniciar();
  });

  afterEach(() => inactividad.detener());

  it('no cierra la sesión antes de 30 minutos sin uso', () => {
    expect(inactividad.revisar(Date.now() + INACTIVIDAD_MAX_MS - 1000)).toBe(false);
    expect(logout).not.toHaveBeenCalled();
  });

  it('cierra la sesión y avisa tras 30 minutos sin uso', () => {
    expect(inactividad.revisar(Date.now() + INACTIVIDAD_MAX_MS + 1000)).toBe(true);
    expect(logout).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { motivo: 'sesion-vencida' },
    });
  });

  it('la actividad reinicia la cuenta', () => {
    const inicio = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(inicio + INACTIVIDAD_MAX_MS - 1000);
    document.dispatchEvent(new Event('keydown'));
    vi.restoreAllMocks();
    expect(inactividad.revisar(inicio + INACTIVIDAD_MAX_MS + 1000)).toBe(false);
  });

  it('con "Mantener sesión iniciada" no la cierra', () => {
    persistente = true;
    expect(inactividad.revisar(Date.now() + INACTIVIDAD_MAX_MS * 4)).toBe(false);
    expect(logout).not.toHaveBeenCalled();
  });
});
