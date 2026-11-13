import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FiltroAuditoria } from '../../shared/models/audit';
import { HttpAuditApi } from './http-audit-api';

const URL = `${environment.apiUrl}/audit`;
const FILTRO: FiltroAuditoria = {
  busqueda: '',
  userId: null,
  moduleId: null,
  area: null,
  resultado: 'TODOS',
  desde: '',
  hasta: '',
  pagina: 1,
  porPagina: 20,
};

const EVENTO = {
  id: 'e1',
  occurredAt: '2026-11-05T15:32:10.000Z',
  user: { id: 'u1', name: 'Laura Muñoz', email: 'coordinador@example.com', role: 'coordinador', roleLabel: 'Coordinador Académico' },
  area: 'Guías base',
  action: 'Publicar guías',
  result: 'success',
  statusCode: 200,
  ip: '192.168.1.20',
  entity: { type: 'guide', id: 'g1', label: 'GB-POO-01 · Guía de clases' },
  module: { id: 'm1', name: 'Programación Orientada a Objetos' },
};

describe('HttpAuditApi', () => {
  let api: HttpAuditApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [HttpAuditApi, provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(HttpAuditApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('manda solo los filtros que tienen valor, con los nombres del back', async () => {
    const resultado = firstValueFrom(
      api.listar({ ...FILTRO, busqueda: ' publicar ', userId: 'u1', moduleId: 'm1', area: 'Sesión', resultado: 'denied', desde: '2026-11-01', hasta: '2026-11-05', pagina: 2 }),
    );
    const req = http.expectOne((r) => r.url === `${URL}/actions`);
    expect(req.request.params.get('q')).toBe('publicar');
    expect(req.request.params.get('userId')).toBe('u1');
    expect(req.request.params.get('moduleId')).toBe('m1');
    expect(req.request.params.get('area')).toBe('Sesión');
    expect(req.request.params.get('result')).toBe('denied');
    expect(req.request.params.get('from')).toBe('2026-11-01');
    expect(req.request.params.get('to')).toBe('2026-11-05');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('20');
    req.flush({ items: [], total: 0, page: 2, pageSize: 20 });
    expect(await resultado).toEqual({ items: [], total: 0 });
  });

  it('sin filtros solo manda la página', () => {
    api.listar(FILTRO).subscribe();
    const req = http.expectOne((r) => r.url === `${URL}/actions`);
    expect(req.request.params.keys().sort()).toEqual(['page', 'pageSize']);
    req.flush({ items: [], total: 0, page: 1, pageSize: 20 });
  });

  it('pasa el rol de keycloak al rol del front, y deja null si no hay', async () => {
    const resultado = firstValueFrom(api.listar(FILTRO));
    http.expectOne((r) => r.url === `${URL}/actions`).flush({
      items: [EVENTO, { ...EVENTO, id: 'e2', user: { id: null, name: null, email: 'intruso@example.com', role: null, roleLabel: null } }],
      total: 2,
      page: 1,
      pageSize: 20,
    });
    const r = await resultado;
    expect(r.items[0].user.role).toBe('COORDINADOR');
    expect(r.items[1].user.role).toBeNull();
  });

  it('pide las opciones de los filtros', async () => {
    const resultado = firstValueFrom(api.opciones());
    http.expectOne(`${URL}/actions/filters`).flush({ users: [], modules: [], areas: ['Sesión'] });
    expect((await resultado).areas).toEqual(['Sesión']);
  });

  it('pide el detalle de una acción', async () => {
    const resultado = firstValueFrom(api.detalle('e1'));
    http.expectOne(`${URL}/actions/e1`).flush({ ...EVENTO, method: 'PATCH', route: '/academic/guides/:id/publish', path: '/academic/guides/g1/publish', userAgent: 'Mozilla', details: { status: 'published' } });
    const d = await resultado;
    expect(d.user.role).toBe('COORDINADOR');
    expect(d.details).toEqual({ status: 'published' });
  });

  it('un 404 en el detalle llega como NOT_FOUND', async () => {
    const resultado = firstValueFrom(api.detalle('x'));
    http.expectOne(`${URL}/actions/x`).flush({ statusCode: 404, error: 'Not Found', code: 'NOT_FOUND', message: 'x' }, { status: 404, statusText: 'Not Found' });
    await expect(resultado).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('un 403 llega como SIN_PERMISO', async () => {
    const resultado = firstValueFrom(api.listar(FILTRO));
    http.expectOne((r) => r.url === `${URL}/actions`).flush({ statusCode: 403, message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    await expect(resultado).rejects.toMatchObject({ code: 'SIN_PERMISO' });
  });

  it('el resumen de roles ignora roles que el front no conoce', async () => {
    const resultado = firstValueFrom(api.roles());
    http.expectOne(`${URL}/permissions`).flush([
      { role: 'admin', label: 'Administrador', totalPermissions: 17, areas: ['Auditoría'] },
      { role: 'otro', label: 'Otro', totalPermissions: 1, areas: [] },
    ]);
    expect((await resultado).map((r) => r.role)).toEqual(['ADMINISTRADOR']);
  });

  it('el detalle de un rol se pide con el nombre del back', async () => {
    const resultado = firstValueFrom(api.rol('DOCENTE_AUTORIZADO'));
    http.expectOne(`${URL}/permissions/docente_autorizado`).flush({
      role: 'docente_autorizado',
      label: 'Docente Autorizado',
      totalPermissions: 1,
      permissions: [{ area: 'Guías base', action: 'Descargar guías (PDF o DOCX)', method: 'GET', path: '/academic/guides/:id/export' }],
    });
    const d = await resultado;
    expect(d.role).toBe('DOCENTE_AUTORIZADO');
    expect(d.permissions).toHaveLength(1);
  });
});
