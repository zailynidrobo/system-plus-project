import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { NotificationApi } from '../../../features/suggestions/notification-api';
import { SuggestionApi } from '../../../features/suggestions/suggestion-api';
import { Campana, Notificacion } from '../../../shared/models/notification';
import { Role, User } from '../../../shared/models/user';
import { Auth } from '../../auth/auth';
import { INTERVALO_CAMPANA, NotificationBell } from './notification-bell';

const alerta = (i: number, extra: Partial<Notificacion> = {}): Notificacion => ({
  id: `n-${i}`,
  type: 'SUGGESTION_PENDING',
  severity: 'info',
  title: `SUG-0${10 + i} · Julián Ospina · GB-POO-01`,
  message: 'nueva, recibida hoy',
  createdAt: new Date().toISOString(),
  read: false,
  suggestionId: 100 + i,
  guide: { id: 7, code: 'GB-POO-01', title: 'Guía base · POO', version: 'v1.0', moduleName: 'POO' },
  ...extra,
});

const usuario = (rol: Role): User => ({ id: 1, nombre: 'Prueba', correo: 'p@example.com', rol, activo: true });
const espera = (ms = 0) => new Promise((r) => setTimeout(r, ms));

describe('Campana del encabezado', () => {
  let campana: Campana;
  let api: { campana: ReturnType<typeof vi.fn>; marcarLeida: ReturnType<typeof vi.fn>; marcarTodasLeidas: ReturnType<typeof vi.fn> };
  const decisiones = signal(0);
  const user = signal<User | null>(null);

  async function montar(rol: Role, intervalo = 60_000) {
    user.set(usuario(rol));
    TestBed.configureTestingModule({
      imports: [NotificationBell],
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: { user } },
        { provide: NotificationApi, useValue: api },
        { provide: SuggestionApi, useValue: { decisiones } },
        { provide: INTERVALO_CAMPANA, useValue: intervalo },
      ],
    });
    const fixture = TestBed.createComponent(NotificationBell);
    fixture.detectChanges();
    await espera();
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;
    return { fixture, componente: fixture.componentInstance, html, boton: html.querySelector<HTMLButtonElement>('.campana__boton')! };
  }

  beforeEach(() => {
    decisiones.set(0);
    campana = { unread: 12, items: Array.from({ length: 12 }, (_, i) => alerta(i + 1)) };
    api = {
      campana: vi.fn(() => of(structuredClone(campana))),
      marcarLeida: vi.fn((id: string) => of({ ...alerta(0), id, read: true })),
      marcarTodasLeidas: vi.fn(() => of({ actualizadas: 2 })),
    };
  });

  it('muestra el contador al iniciar la sesión, sin abrir el panel', async () => {
    const { html, boton } = await montar('COORDINADOR');
    expect(api.campana).toHaveBeenCalledTimes(1);
    expect(html.querySelector('.campana__contador')?.textContent?.trim()).toBe('12');
    expect(boton.getAttribute('aria-label')).toBe('Notificaciones: 12 sugerencias pendientes');
    expect(html.querySelector('.campana__panel')).toBeNull();
  });

  it('abre un panel con máximo 10 alertas y "Ver todas" a la bandeja del rol', async () => {
    const { fixture, html, boton } = await montar('COORDINADOR');
    boton.click();
    await espera();
    fixture.detectChanges();
    expect(html.querySelectorAll('.campana__item')).toHaveLength(10);
    expect(html.querySelector('.campana__item strong')?.textContent).toContain('SUG-011 · Julián Ospina · GB-POO-01');
    expect(html.querySelector('.campana__item small')?.textContent).toContain('GB-POO-01 v1.0 · POO');
    const todas = html.querySelector<HTMLAnchorElement>('.campana__todas')!;
    expect(todas.getAttribute('href')).toBe('/sugerencias');
    expect(todas.textContent).toContain('(12)');
  });

  it('se refresca cuando cambia decisiones y cada intervalo', async () => {
    const { fixture, html } = await montar('COORDINADOR', 40);
    expect(api.campana).toHaveBeenCalledTimes(1);

    campana = { unread: 11, items: campana.items.slice(1) };
    decisiones.update((n) => n + 1);
    fixture.detectChanges();
    await espera();
    fixture.detectChanges();
    expect(api.campana).toHaveBeenCalledTimes(2);
    expect(html.querySelector('.campana__contador')?.textContent?.trim()).toBe('11');

    await espera(100);
    expect(api.campana.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('el coordinador abre la sugerencia de la alerta (sin estado de leído)', async () => {
    const { fixture, componente } = await montar('COORDINADOR');
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    componente.abrir(campana.items[0]);
    fixture.detectChanges();
    expect(navegar).toHaveBeenCalledWith(['/sugerencias', 101]);
    expect(api.marcarLeida).not.toHaveBeenCalled();
  });

  it('el docente marca la alerta como leída al abrirla y navega', async () => {
    campana = {
      unread: 2,
      items: [
        alerta(1, { type: 'SUGGESTION_APPROVED', severity: 'success', title: 'Sugerencia SUG-011 aprobada' }),
        alerta(2, { type: 'GUIDE_NEW_VERSION', title: 'Nueva versión v1.1 de GB-POO-01 disponible', suggestionId: 102 }),
      ],
    };
    const { fixture, componente, html } = await montar('DOCENTE');
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    componente.abrir(componente.campana().items[0]);
    fixture.detectChanges();
    expect(api.marcarLeida).toHaveBeenCalledWith('n-1');
    expect(navegar).toHaveBeenCalledWith(['/mis-sugerencias', 101]);
    expect(componente.campana().unread).toBe(1);
    expect(html.querySelector('.campana__contador')?.textContent?.trim()).toBe('1');

    // "Nueva versión" abre la guía base.
    componente.abrir(componente.campana().items[1]);
    expect(navegar).toHaveBeenLastCalledWith(['/mis-modulos/guias', 7]);
    expect(componente.campana().unread).toBe(0);
  });

  it('el docente puede marcar todas como leídas', async () => {
    campana = { unread: 2, items: [alerta(1, { type: 'SUGGESTION_REJECTED' }), alerta(2, { type: 'SUGGESTION_APPROVED' })] };
    const { fixture, html, boton } = await montar('DOCENTE_AUTORIZADO');
    boton.click();
    await espera();
    fixture.detectChanges();
    html.querySelector<HTMLButtonElement>('.campana__accion')!.click();
    fixture.detectChanges();
    expect(api.marcarTodasLeidas).toHaveBeenCalledTimes(1);
    expect(html.querySelector('.campana__contador')).toBeNull();
    expect(html.querySelector<HTMLAnchorElement>('.campana__todas')?.getAttribute('href')).toBe('/mis-sugerencias');
  });

  it('el administrador ve la lista vacía y sin "Ver todas"', async () => {
    campana = { unread: 0, items: [] };
    const { fixture, html, boton } = await montar('ADMINISTRADOR');
    boton.click();
    await espera();
    fixture.detectChanges();
    expect(html.querySelector('.campana__vacio')?.textContent).toContain('No tienes notificaciones.');
    expect(html.querySelector('.campana__todas')).toBeNull();
  });
});
