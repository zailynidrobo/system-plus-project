import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { MockDb } from '../../core/mock/mock-db';
import { GuideContent } from '../../shared/models/guide-field';
import { CORREOS, SIN_LATENCIA, capturarError, entrarComo, limpiarSesion } from '../../../testing/test-helpers';
import { ModuleApi } from '../academic-program/module-api';
import { GuideApi } from './guide-api';

const POO = 2;
const COMP_POO_01 = 5;
const GB_POO_01 = 2; // publicada
const GB_SIS_01 = 7; // borrador

const completo: GuideContent = {
  intensidad: '40 horas · 10 semanas',
  evaluacion: 'Por proyecto',
  objetivos: 'Diseñar clases reutilizables.',
  metodologia: 'Aula invertida',
  criterios: 'Evidencia de producto: proyecto final.',
  recursos: '',
};

describe('GuideApi (HE-03 guías base)', () => {
  let api: GuideApi;

  beforeEach(async () => {
    limpiarSesion();
    TestBed.configureTestingModule({ providers: [SIN_LATENCIA] });
    api = TestBed.inject(GuideApi);
    await entrarComo(CORREOS.coordinador);
  });

  afterEach(limpiarSesion);

  it('crea la guía en Borrador con código automático y copia de la estructura vigente', async () => {
    const g = await firstValueFrom(api.crear({ moduleId: POO, competencyId: COMP_POO_01, content: completo }));

    expect(g.status).toBe('Borrador');
    expect(g.code).toBe('GB-POO-04');
    expect(g.structureVersion).toBe(3);
    expect(g.fields.map((f) => f.key)).toEqual(['intensidad', 'evaluacion', 'objetivos', 'metodologia', 'criterios', 'recursos']);
    expect(g.createdBy?.name).toBe('Laura Muñoz');
  });

  it('no guarda texto libre fuera de la estructura', async () => {
    const g = await firstValueFrom(
      api.crear({ moduleId: POO, competencyId: COMP_POO_01, content: { ...completo, inventado: 'texto suelto' } }),
    );
    expect(Object.keys(g.content)).not.toContain('inventado');
  });

  it('exige los campos obligatorios', async () => {
    const err = await capturarError(api.crear({ moduleId: POO, competencyId: COMP_POO_01, content: { ...completo, criterios: '  ' } }));

    expect(err.code).toBe('REQUIRED_FIELDS_MISSING');
    expect(err.data).toEqual({ campos: ['Criterios de evaluación y evidencias'] });
  });

  it('solo permite crear guías sobre módulos disponibles (activos y con competencias)', async () => {
    await firstValueFrom(TestBed.inject(ModuleApi).inhabilitar(POO));
    const err = await capturarError(api.crear({ moduleId: POO, competencyId: COMP_POO_01, content: completo }));
    expect(err.code).toBe('MODULE_NOT_AVAILABLE');
  });

  it('la competencia debe ser del módulo', async () => {
    const err = await capturarError(api.crear({ moduleId: POO, competencyId: 9, content: completo }));
    expect(err.code).toBe('COMPETENCY_INVALID');
  });

  it('editar un borrador guarda los cambios, deja historial y no toca las guías publicadas', async () => {
    const db = TestBed.inject(MockDb);
    const publicadasAntes = structuredClone(db.guias.filter((g) => g.status === 'Publicada'));
    const borrador = await firstValueFrom(api.obtener(GB_SIS_01));

    await firstValueFrom(api.actualizar(GB_SIS_01, {
      competencyId: borrador.competencyId!,
      content: { ...borrador.content, criterios: 'Evidencia de producto: política de seguridad documentada.' },
    }));
    const historial = await firstValueFrom(api.historial(GB_SIS_01));

    expect(historial[0].titulo).toBe('Criterios de evaluación y evidencias editado');
    expect(db.guias.filter((g) => g.status === 'Publicada')).toEqual(publicadasAntes);
  });

  it('una guía publicada no se edita directamente', async () => {
    const g = await firstValueFrom(api.obtener(GB_POO_01));
    const err = await capturarError(api.actualizar(GB_POO_01, { competencyId: g.competencyId!, content: g.content }));
    expect(err.code).toBe('GUIDE_NOT_EDITABLE');
  });

  it('publicar pasa de Borrador a Publicada con fecha, autor y versión 1.0', async () => {
    const borrador = await firstValueFrom(api.crear({ moduleId: POO, competencyId: COMP_POO_01, content: completo }));
    const publicada = await firstValueFrom(api.publicar(borrador.id));

    expect(publicada.status).toBe('Publicada');
    expect(publicada.version).toBe('v1.0');
    expect(publicada.publishedBy?.name).toBe('Laura Muñoz');
    expect(publicada.publishedAt).toBeTruthy();
    expect((await capturarError(api.publicar(borrador.id))).code).toBe('GUIDE_ALREADY_PUBLISHED');
  });

  it('no publica un borrador incompleto', async () => {
    expect((await capturarError(api.publicar(GB_SIS_01))).code).toBe('REQUIRED_FIELDS_MISSING');
  });

  it('lista con filtros por módulo, estado, autor y búsqueda, y resume los totales', async () => {
    const borradores = await firstValueFrom(api.listar({ busqueda: '', moduleId: null, competencyId: null, autor: null, estado: 'Borrador', pagina: 1, porPagina: 50 }));
    const poo = await firstValueFrom(api.listar({ busqueda: 'gb-poo', moduleId: POO, competencyId: null, autor: null, estado: 'TODOS', pagina: 1, porPagina: 50 }));
    const porAutor = await firstValueFrom(api.listar({ busqueda: '', moduleId: null, competencyId: null, autor: 'Laura Muñoz', estado: 'TODOS', pagina: 1, porPagina: 50 }));
    const resumen = await firstValueFrom(api.resumen());

    expect(borradores.items.map((g) => g.code)).toEqual(['GB-SIS-01']);
    expect(poo.total).toBe(3);
    expect(porAutor.total).toBe(8);
    expect(resumen).toEqual({ total: 8, modulos: 6, publicadas: 7, borradores: 1 });
  });

  it('informa los docentes asignados que verán la guía', async () => {
    const docentes = await firstValueFrom(api.docentesDelModulo(POO));
    expect(docentes.map((d) => d.nombre)).toEqual(['Julián Andrés Ospina', 'Paola Valencia', 'Santiago Gómez']);
  });
});
