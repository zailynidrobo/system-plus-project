import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { MockDb } from '../../core/mock/mock-db';
import { GuideField } from '../../shared/models/guide-field';
import { CORREOS, SIN_LATENCIA, capturarError, entrarComo, limpiarSesion } from '../../../testing/test-helpers';
import { FieldConfigApi, claveDesdeEtiqueta, diferencias } from './field-config-api';

const POO = 2;
const SIS = 6;

describe('FieldConfigApi (HE-03-HU-04 estructura del formulario)', () => {
  let api: FieldConfigApi;
  let db: MockDb;

  beforeEach(async () => {
    limpiarSesion();
    TestBed.configureTestingModule({ providers: [SIN_LATENCIA] });
    api = TestBed.inject(FieldConfigApi);
    db = TestBed.inject(MockDb);
    await entrarComo(CORREOS.coordinador);
  });

  afterEach(limpiarSesion);

  async function camposDe(moduleId: number): Promise<GuideField[]> {
    return (await firstValueFrom(api.obtener(moduleId))).config.fields;
  }

  it('devuelve la estructura del módulo con nombre, tipo y obligatoriedad de cada campo', async () => {
    const { config, origen } = await firstValueFrom(api.obtener(POO));

    expect(origen).toBe('modulo');
    expect(config.version).toBe(3);
    expect(config.fields.filter((f) => f.required)).toHaveLength(5);
  });

  it('el aviso de impacto lista los cambios y cuenta las guías afectadas', async () => {
    const campos = await camposDe(POO);
    const nuevos: GuideField[] = [
      ...campos.map((f) => (f.key === 'criterios' ? { ...f, maxLength: 1000 } : f)),
      { key: 'evidencia', label: 'Evidencia de producto', type: 'text', required: false },
    ];

    const impacto = await firstValueFrom(api.impacto(POO, null, nuevos));

    expect(impacto.cambios.map((c) => c.tipo)).toEqual(['modificado', 'agregado']);
    expect(impacto.publicadas).toBe(3);
    expect(impacto.borradores).toBe(0);
    expect(impacto.versionNueva).toBe(4);
  });

  it('guardar crea una nueva versión: los borradores la adoptan y las publicadas conservan la anterior', async () => {
    const publicadaAntes = structuredClone(db.guias.find((g) => g.code === 'GB-POO-01')!);
    db.guias = db.guias.map((g) => (g.code === 'GB-SIS-01' ? { ...g, moduleId: POO } : g)); // un borrador en POO
    const campos = await camposDe(POO);

    const config = await firstValueFrom(
      api.guardar(POO, null, [...campos, { key: 'evidencia', label: 'Evidencia de producto', type: 'text', required: false }]),
    );

    const borrador = db.guias.find((g) => g.code === 'GB-SIS-01')!;
    expect(config.version).toBe(4);
    expect(borrador.structureVersion).toBe(4);
    expect(borrador.fields.map((f) => f.key)).toContain('evidencia');
    expect(borrador.content['objetivos']).toBeTruthy(); // conserva lo que ya tenía
    expect(db.guias.find((g) => g.code === 'GB-POO-01')).toEqual(publicadaAntes);
  });

  it('la nueva estructura se usa al crear guías (HU-01)', async () => {
    const campos = await camposDe(SIS);
    await firstValueFrom(api.guardar(SIS, null, campos.filter((f) => f.key !== 'recursos')));
    expect((await camposDe(SIS)).map((f) => f.key)).not.toContain('recursos');
  });

  it('una competencia puede tener su propia estructura', async () => {
    const campos = await camposDe(POO);
    await firstValueFrom(api.guardar(POO, 5, campos.slice(0, 3)));

    const deCompetencia = await firstValueFrom(api.obtener(POO, 5));
    const otraCompetencia = await firstValueFrom(api.obtener(POO, 6));
    expect(deCompetencia.origen).toBe('competencia');
    expect(deCompetencia.config.fields).toHaveLength(3);
    expect(otraCompetencia.origen).toBe('modulo');
  });

  it('valida etiquetas, claves únicas y opciones de las listas', async () => {
    const campo: GuideField = { key: 'a', label: 'A', type: 'text', required: false };
    expect((await capturarError(api.guardar(POO, null, [{ ...campo, label: ' ' }]))).code).toBe('FIELD_LABEL_REQUIRED');
    expect((await capturarError(api.guardar(POO, null, [campo, campo]))).code).toBe('FIELD_KEY_DUPLICATED');
    expect((await capturarError(api.guardar(POO, null, [{ ...campo, type: 'select', options: ['Única'] }]))).code).toBe('SELECT_OPTIONS_REQUIRED');
    expect((await capturarError(api.guardar(POO, null, []))).code).toBe('FIELDS_REQUIRED');
  });

  it('genera claves a partir de la etiqueta sin repetirlas', () => {
    expect(claveDesdeEtiqueta('Evidencia de producto (archivo)', [])).toBe('evidencia_de_producto_archivo');
    expect(claveDesdeEtiqueta('Objetivos', ['objetivos'])).toBe('objetivos_2');
  });

  it('detecta campos eliminados y cambios de orden', () => {
    const a: GuideField = { key: 'a', label: 'A', type: 'text', required: true };
    const b: GuideField = { key: 'b', label: 'B', type: 'text', required: true };
    const c: GuideField = { key: 'c', label: 'C', type: 'text', required: true };
    expect(diferencias([a, b, c], [b, a]).map((x) => x.tipo)).toEqual(['eliminado', 'orden']);
  });
});
