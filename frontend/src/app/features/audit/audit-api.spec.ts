import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SIN_LATENCIA, capturarError } from '../../../testing/test-helpers';
import { FiltroAuditoria } from '../../shared/models/audit';
import { diaBogota } from '../../shared/utils/auditoria';
import { AuditApi } from './audit-api';

const SIN_FILTROS: FiltroAuditoria = {
  busqueda: '',
  userId: null,
  moduleId: null,
  area: null,
  resultado: 'TODOS',
  desde: '',
  hasta: '',
  pagina: 1,
  porPagina: 100,
};

describe('AuditApi (mock)', () => {
  let api: AuditApi;
  const listar = (f: Partial<FiltroAuditoria> = {}) => firstValueFrom(api.listar({ ...SIN_FILTROS, ...f }));

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SIN_LATENCIA] });
    api = TestBed.inject(AuditApi);
  });

  it('lista del más reciente al más antiguo y pagina', async () => {
    const todo = await listar();
    expect(todo.total).toBeGreaterThan(20);
    const fechas = todo.items.map((e) => e.occurredAt);
    expect(fechas).toEqual([...fechas].sort().reverse());

    const pagina2 = await listar({ pagina: 2, porPagina: 10 });
    expect(pagina2.items).toHaveLength(10);
    expect(pagina2.items[0].id).toBe(todo.items[10].id);
    expect(pagina2.total).toBe(todo.total);
  });

  it('filtra por usuario y por módulo (CA-02)', async () => {
    const o = await firstValueFrom(api.opciones());
    const usuario = o.users[0];
    const deUsuario = await listar({ userId: usuario.id });
    expect(deUsuario.items.length).toBeGreaterThan(0);
    expect(deUsuario.items.every((e) => e.user.id === usuario.id)).toBe(true);

    const modulo = o.modules[0];
    const deModulo = await listar({ moduleId: modulo.id });
    expect(deModulo.items.length).toBeGreaterThan(0);
    expect(deModulo.items.every((e) => e.module?.id === modulo.id)).toBe(true);
  });

  it('filtra por resultado y por área', async () => {
    const fallidas = await listar({ resultado: 'failed' });
    expect(fallidas.items.length).toBeGreaterThan(0);
    expect(fallidas.items.every((e) => e.result === 'failed' && e.user.id === null)).toBe(true);

    const sesion = await listar({ area: 'Sesión' });
    expect(sesion.items.every((e) => e.area === 'Sesión')).toBe(true);
  });

  it('las fechas se cuentan en hora de Bogotá y ambas están incluidas', async () => {
    const todo = await listar();
    const dia = diaBogota(todo.items[0].occurredAt);
    const delDia = await listar({ desde: dia, hasta: dia });
    expect(delDia.total).toBeGreaterThan(0);
    expect(delDia.total).toBeLessThan(todo.total);
    expect(delDia.items.every((e) => diaBogota(e.occurredAt) === dia)).toBe(true);
    expect(await listar({ desde: '2100-01-01' })).toMatchObject({ total: 0 });
  });

  it('busca en usuario, acción y "sobre qué" sin distinguir mayúsculas ni tildes', async () => {
    const r = await listar({ busqueda: 'PUBLICAR' });
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items.every((e) => e.action.toLowerCase().includes('publicar'))).toBe(true);
    expect((await listar({ busqueda: 'intruso' })).items.every((e) => e.user.email === 'intruso@example.com')).toBe(true);
  });

  it('rechaza fechas al revés', async () => {
    const err = await capturarError(api.listar({ ...SIN_FILTROS, desde: '2026-11-05', hasta: '2026-11-01' }));
    expect(err.code).toBe('INVALID_DATE_RANGE');
  });

  it('abre el detalle de una acción y responde NOT_FOUND si no existe', async () => {
    const primero = (await listar()).items[0];
    const d = await firstValueFrom(api.detalle(primero.id));
    expect(d.id).toBe(primero.id);
    expect(d.route).toBeTruthy();
    expect((await capturarError(api.detalle('no-existe'))).code).toBe('NOT_FOUND');
  });

  it('hay acciones de asignar roles para la tarjeta de cambios de permisos', async () => {
    const r = await listar({ busqueda: 'Asignar roles' });
    expect(r.total).toBeGreaterThan(0);
    expect(r.items.every((e) => e.action === 'Asignar roles')).toBe(true);
  });

  it('muestra los 4 roles con sus permisos agrupados por área', async () => {
    const roles = await firstValueFrom(api.roles());
    expect(roles.map((r) => r.role)).toEqual(['ADMINISTRADOR', 'COORDINADOR', 'DOCENTE', 'DOCENTE_AUTORIZADO']);

    const docente = await firstValueFrom(api.rol('DOCENTE'));
    const autorizado = await firstValueFrom(api.rol('DOCENTE_AUTORIZADO'));
    expect(autorizado.permissions).toEqual(docente.permissions);

    const coordinador = await firstValueFrom(api.rol('COORDINADOR'));
    expect(coordinador.totalPermissions).toBe(coordinador.permissions.length);
    const areas = coordinador.permissions.map((p) => p.area);
    expect(areas).toEqual([...areas].sort((a, b) => a.localeCompare(b)));
  });
});
