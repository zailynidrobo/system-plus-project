import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { MockDb } from '../../core/mock/mock-db';
import { ModuleView } from '../../shared/models/academic-module';
import { CORREOS, SIN_LATENCIA, capturarError, entrarComo, limpiarSesion } from '../../../testing/test-helpers';
import { ModuleApi } from './module-api';

describe('ModuleApi (HE-02 módulos)', () => {
  let api: ModuleApi;

  beforeEach(async () => {
    limpiarSesion();
    TestBed.configureTestingModule({ providers: [SIN_LATENCIA] });
    api = TestBed.inject(ModuleApi);
    await entrarComo(CORREOS.coordinador);
  });

  afterEach(limpiarSesion);

  const nuevo = (name: string, borrador = false) =>
    firstValueFrom(api.crear({ name, description: 'Descripción del módulo.' }, borrador));

  it('registra un módulo activo con código automático y sigla de sus palabras significativas', async () => {
    const m = await nuevo('Seguridad informática y soporte técnico');

    expect(m.code).toBe('TS-MOD-07');
    expect(m.competencyPrefix).toBe('SIST');
    expect(m.status).toBe('active');
    expect(m.createdBy?.name).toBe('Laura Muñoz');
  });

  it('no permite nombres duplicados sin distinguir mayúsculas ni espacios (MODULE_NAME_DUPLICATED)', async () => {
    const err = await capturarError(api.crear({ name: '  bases   DE datos ', description: 'x' }));

    expect(err.code).toBe('MODULE_NAME_DUPLICATED');
    expect((err.data as ModuleView).code).toBe('TS-MOD-03');
  });

  it('informa en vivo si un nombre está disponible y con qué módulo choca', async () => {
    const libre = await firstValueFrom(api.disponibilidadNombre('Programación web'));
    const ocupado = await firstValueFrom(api.disponibilidadNombre('BASES DE DATOS'));

    expect(libre.disponible).toBe(true);
    expect(ocupado.disponible).toBe(false);
    expect(ocupado.existente?.name).toBe('Bases de Datos');
  });

  it('el código nunca se repite y la sigla se desambigua si ya existe', async () => {
    const a = await nuevo('Bodegas Digitales'); // BD ya existe -> BD2
    const b = await nuevo('Programación web');

    expect(a.competencyPrefix).toBe('BD2');
    expect(b.code).toBe('TS-MOD-08');
  });

  it('flujo borrador -> registrar: el borrador no está disponible para guías', async () => {
    const borrador = await nuevo('Programación web', true);
    expect(borrador.status).toBe('draft');
    expect(borrador.availableForGuides).toBe(false);

    const activo = await firstValueFrom(api.registrar(borrador.id));
    expect(activo.status).toBe('active');
  });

  it('editar cambia nombre y descripción pero no el código', async () => {
    const m = await firstValueFrom(
      api.actualizar(2, { name: 'Programación Orientada a Objetos y Patrones', description: 'Nueva descripción.' }),
    );

    expect(m.name).toBe('Programación Orientada a Objetos y Patrones');
    expect(m.code).toBe('TS-MOD-02');
    expect((await firstValueFrom(api.obtener(2))).name).toBe('Programación Orientada a Objetos y Patrones');
  });

  it('editar con el nombre de otro módulo falla; con su propio nombre no', async () => {
    const err = await capturarError(api.actualizar(2, { name: 'Bases de Datos', description: 'x' }));
    expect(err.code).toBe('MODULE_NAME_DUPLICATED');

    await expect(firstValueFrom(api.actualizar(3, { name: 'bases de datos', description: 'x' }))).resolves.toBeTruthy();
  });

  it('inhabilitar conserva competencias y guías, guarda el motivo y lo saca de los disponibles para guías', async () => {
    const antes = await firstValueFrom(api.obtener(3));
    const m = await firstValueFrom(api.inhabilitar(3, 'Plan en revisión'));

    expect(m.status).toBe('inactive');
    expect(m.inactivationReason).toBe('Plan en revisión');
    expect(m.competenciesCount).toBe(antes.competenciesCount);
    expect((await firstValueFrom(api.disponiblesParaGuias())).map((x) => x.id)).not.toContain(3);
  });

  it('permite rehabilitar un módulo inhabilitado', async () => {
    await firstValueFrom(api.inhabilitar(3));
    const m = await firstValueFrom(api.rehabilitar(3));

    expect(m.status).toBe('active');
    expect(m.inactivationReason).toBeNull();
  });

  it('solo está disponible para guías si está activo y tiene al menos una competencia', async () => {
    const sinCompetencias = await nuevo('Programación web');
    const disponibles = (await firstValueFrom(api.disponiblesParaGuias())).map((m) => m.id);

    expect(disponibles).toContain(2);
    expect(disponibles).not.toContain(sinCompetencias.id);
  });

  it('no permite transiciones inválidas', async () => {
    expect((await capturarError(api.rehabilitar(2))).code).toBe('INVALID_STATUS');
    expect((await capturarError(api.registrar(2))).code).toBe('INVALID_STATUS');
  });

  it('el listado filtra por estado, busca por nombre o código y ordena', async () => {
    await firstValueFrom(api.inhabilitar(5));
    const inhabilitados = await firstValueFrom(api.listar({ busqueda: '', estado: 'inactive', orden: 'nombre' }));
    const porCodigo = await firstValueFrom(api.listar({ busqueda: 'mod-04', estado: 'TODOS', orden: 'codigo' }));

    expect(inhabilitados.map((m) => m.code)).toEqual(['TS-MOD-05']);
    expect(porCodigo.map((m) => m.name)).toEqual(['Redes y conectividad']);
  });

  it('cuenta las competencias activas de cada módulo', async () => {
    const lista = await firstValueFrom(api.listar({ busqueda: '', estado: 'TODOS', orden: 'codigo' }));
    expect(lista.slice(0, 5).map((m) => m.competenciesCount)).toEqual([4, 4, 4, 3, 4]);
    expect(TestBed.inject(MockDb).modulos.length).toBe(6);
  });
});
