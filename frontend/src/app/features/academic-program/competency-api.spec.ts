import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { CORREOS, SIN_LATENCIA, capturarError, entrarComo, limpiarSesion } from '../../../testing/test-helpers';
import { CompetencyApi } from './competency-api';
import { ModuleApi } from './module-api';

const POO = 2;

// Competencias de POO en los datos semilla: COMP-POO-01..04 = ids 5..8
const COMP_POO_02 = 6;
const COMP_POO_04 = 8;

describe('CompetencyApi (HE-02 competencias)', () => {
  let api: CompetencyApi;

  beforeEach(async () => {
    limpiarSesion();
    TestBed.configureTestingModule({ providers: [SIN_LATENCIA] });
    api = TestBed.inject(CompetencyApi);
    await entrarComo(CORREOS.coordinador);
  });

  afterEach(limpiarSesion);

  it('un módulo puede tener varias competencias; la nueva no reemplaza a las existentes', async () => {
    expect(await firstValueFrom(api.siguienteCodigo(POO))).toBe('COMP-POO-05');

    const nueva = await firstValueFrom(
      api.crear(POO, 'Aplicar patrones de diseño creacionales y estructurales para resolver problemas recurrentes de software.'),
    );
    const lista = await firstValueFrom(api.listar(POO));

    expect(nueva.code).toBe('COMP-POO-05');
    expect(nueva.version).toBe(1);
    expect(lista.map((c) => c.code)).toEqual(['COMP-POO-01', 'COMP-POO-02', 'COMP-POO-03', 'COMP-POO-04', 'COMP-POO-05']);
  });

  it('no permite repetir un texto en el mismo módulo (COMPETENCY_DUPLICATED)', async () => {
    const err = await capturarError(api.crear(POO, '  modelar soluciones de software mediante clases, objetos y RELACIONES. '));

    expect(err.code).toBe('COMPETENCY_DUPLICATED');
    expect(err.data).toEqual({ code: 'COMP-POO-01' });
  });

  it('solo los módulos activos admiten competencias', async () => {
    await firstValueFrom(TestBed.inject(ModuleApi).inhabilitar(POO));
    const err = await capturarError(api.crear(POO, 'Una competencia nueva.'));
    expect(err.code).toBe('MODULE_NOT_ACTIVE');
  });

  it('editar cambia solo el texto, sube la versión, guarda el historial y no afecta a las demás', async () => {
    const antes = await firstValueFrom(api.listar(POO));
    const r = await firstValueFrom(
      api.actualizar(COMP_POO_02, 'Implementar encapsulamiento, herencia y polimorfismo para construir aplicaciones modulares, mantenibles y reutilizables.'),
    );
    const despues = await firstValueFrom(api.listar(POO));
    const historial = await firstValueFrom(api.historial(COMP_POO_02));

    expect(r.textoAnterior).toBe('Implementar encapsulamiento, herencia y polimorfismo en aplicaciones.');
    expect(r.competencia.code).toBe('COMP-POO-02');
    expect(r.competencia.version).toBe(2);
    expect(historial.map((h) => h.version)).toEqual([2, 1]);
    expect(despues.filter((c) => c.id !== COMP_POO_02)).toEqual(antes.filter((c) => c.id !== COMP_POO_02));
  });

  it('eliminar es lógico: sale del listado, se puede seguir consultando y el código no se reutiliza', async () => {
    const r = await firstValueFrom(api.eliminar(COMP_POO_04));

    expect(r.restantes).toBe(3);
    expect((await firstValueFrom(api.listar(POO))).map((c) => c.code)).not.toContain('COMP-POO-04');
    expect((await firstValueFrom(api.obtener(COMP_POO_04))).status).toBe('deleted');
    expect(await firstValueFrom(api.siguienteCodigo(POO))).toBe('COMP-POO-05');
  });

  it('un texto eliminado se puede volver a usar', async () => {
    await firstValueFrom(api.eliminar(COMP_POO_04));
    const nueva = await firstValueFrom(api.crear(POO, 'Construir pruebas unitarias para validar el comportamiento del software.'));
    expect(nueva.code).toBe('COMP-POO-05');
  });
});
