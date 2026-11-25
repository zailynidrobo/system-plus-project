import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { BusquedaEnVivo, ESPERA_BUSQUEDA_MS } from './busqueda-en-vivo';

describe('BusquedaEnVivo', () => {
  let vivo: BusquedaEnVivo;

  beforeEach(() => {
    vi.useFakeTimers();
    vivo = TestBed.runInInjectionContext(() => new BusquedaEnVivo());
  });

  afterEach(() => vi.useRealTimers());

  it('busca una sola vez cuando el usuario deja de escribir', () => {
    const buscar = vi.fn();
    vivo.alEscribir(buscar);
    vi.advanceTimersByTime(ESPERA_BUSQUEDA_MS - 50);
    vivo.alEscribir(buscar);
    vi.advanceTimersByTime(ESPERA_BUSQUEDA_MS - 50);
    expect(buscar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it('una respuesta vieja no reemplaza los resultados nuevos', () => {
    const primera = new Subject<string>();
    const segunda = new Subject<string>();
    const recibidos: string[] = [];
    vivo.consultar(primera, (v) => recibidos.push(v));
    vivo.consultar(segunda, (v) => recibidos.push(v));
    segunda.next('pro');
    primera.next('p');
    expect(recibidos).toEqual(['pro']);
  });

  it('una consulta inmediata cancela la búsqueda que estaba esperando', () => {
    const buscar = vi.fn();
    vivo.alEscribir(buscar);
    vivo.consultar(new Subject<string>(), () => undefined);
    vi.advanceTimersByTime(ESPERA_BUSQUEDA_MS * 2);
    expect(buscar).not.toHaveBeenCalled();
  });

  it('al salir de la pantalla no queda nada pendiente', () => {
    const buscar = vi.fn();
    const origen = new Subject<string>();
    const recibir = vi.fn();
    vivo.alEscribir(buscar);
    vivo.consultar(origen, recibir);
    vivo.detener();
    origen.next('x');
    vi.advanceTimersByTime(ESPERA_BUSQUEDA_MS * 2);
    expect(buscar).not.toHaveBeenCalled();
    expect(recibir).not.toHaveBeenCalled();
  });
});
