import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { CORREOS, SIN_LATENCIA, capturarError, entrarComo, limpiarSesion } from '../../../testing/test-helpers';
import { MockDb } from '../../core/mock/mock-db';
import { TeacherApi } from './teacher-api';

const GB_POO_01 = 2;
const GB_RC_01 = 6;
const GB_SIS_01 = 7; // borrador

describe('TeacherApi', () => {
  let api: TeacherApi;
  let db: MockDb;

  beforeEach(() => {
    limpiarSesion();
    TestBed.configureTestingModule({ providers: [SIN_LATENCIA] });
    api = TestBed.inject(TeacherApi);
    db = TestBed.inject(MockDb);
  });

  afterEach(limpiarSesion);

  describe('módulos y guías asignadas (HU-01)', () => {
    it('el docente solo ve sus módulos asignados: POO y Bases de Datos', async () => {
      await entrarComo(CORREOS.docente);
      const nombres = (await firstValueFrom(api.misModulos())).map((m) => m.name);
      expect(nombres).toEqual(['Programación Orientada a Objetos', 'Bases de Datos']);
    });

    it('quien no tiene asignaciones no ve módulos', async () => {
      await entrarComo(CORREOS.coordinador);
      expect(await firstValueFrom(api.misModulos())).toEqual([]);
    });

    it('solo lista guías publicadas de los módulos asignados y cuenta las demás sin mostrarlas', async () => {
      await entrarComo(CORREOS.docente);
      const r = await firstValueFrom(api.guiasAsignadas({ busqueda: '', moduleId: null }));

      expect(r.guias.map((g) => g.code)).toEqual(['GB-POO-01', 'GB-POO-02', 'GB-POO-03', 'GB-BD-02']);
      expect(r.guias.every((g) => g.status === 'Publicada')).toBe(true);
      expect(r.ocultas.total).toBe(3);
      expect(r.ocultas.modulos).toContain('Redes y conectividad');
    });

    it('filtra por módulo y por texto', async () => {
      await entrarComo(CORREOS.docente);
      const bd = await firstValueFrom(api.guiasAsignadas({ busqueda: '', moduleId: 3 }));
      expect(bd.guias.map((g) => g.code)).toEqual(['GB-BD-02']);
      const texto = await firstValueFrom(api.guiasAsignadas({ busqueda: 'validacion', moduleId: null }));
      expect(texto.guias.map((g) => g.code)).toEqual(['GB-POO-03']);
    });

    it('indica si el docente ya tiene versión de cada guía', async () => {
      await entrarComo(CORREOS.docente);
      const r = await firstValueFrom(api.guiasAsignadas({ busqueda: '', moduleId: null }));
      expect(r.guias.find((g) => g.code === 'GB-POO-01')?.misVersiones.map((v) => v.name)).toEqual(['POO · Grupo 2026-1']);
      expect(r.guias.find((g) => g.code === 'GB-BD-02')?.misVersiones).toEqual([]);
    });

    it('no deja abrir guías de módulos no asignados ni borradores', async () => {
      await entrarComo(CORREOS.docente);
      expect((await capturarError(api.obtenerGuia(GB_RC_01))).code).toBe('GUIDE_NOT_ASSIGNED');
      expect((await capturarError(api.obtenerGuia(GB_SIS_01))).code).toBe('NOT_FOUND');
    });
  });

  describe('crear versión personalizada (HU-02)', () => {
    it('crea una copia completa e independiente de la guía base', async () => {
      await entrarComo(CORREOS.docente);
      const guia = db.guias.find((g) => g.id === GB_POO_01)!;
      const v = await firstValueFrom(api.crearVersion(GB_POO_01, '  POO ·  Grupo 2026-2 '));

      expect(v.name).toBe('POO · Grupo 2026-2');
      expect(v.content).toEqual(guia.content);
      expect(v.fields).toEqual(guia.fields);
      expect(v.baseVersion).toBe('v1.0');
      expect(v.adaptedKeys).toEqual([]);

      // copia física: ningún objeto se comparte con la guía base
      const guardada = db.versiones.find((x) => x.id === v.id)!;
      expect(guardada.content).not.toBe(guia.content);
      expect(guardada.fields).not.toBe(guia.fields);
      expect(guardada.fields[0]).not.toBe(guia.fields[0]);
    });

    it('exige un nombre y no repite nombres del mismo docente (sin importar mayúsculas)', async () => {
      await entrarComo(CORREOS.docente);
      expect((await capturarError(api.crearVersion(GB_POO_01, '   '))).code).toBe('NAME_REQUIRED');
      expect((await capturarError(api.crearVersion(GB_POO_01, 'poo · grupo 2026-1'))).code).toBe('VERSION_NAME_DUPLICATED');
    });

    it('otro docente sí puede usar el mismo nombre en su espacio', async () => {
      await entrarComo(CORREOS.autorizado);
      const v = await firstValueFrom(api.crearVersion(GB_POO_01, 'POO · Grupo 2026-1'));
      expect(v.teacherId).toBe(3);
    });

    it('no permite crear versiones de guías no asignadas', async () => {
      await entrarComo(CORREOS.docente);
      expect((await capturarError(api.crearVersion(GB_RC_01, 'Redes'))).code).toBe('GUIDE_NOT_ASSIGNED');
    });

    it('cada docente ve y abre solo sus versiones', async () => {
      await entrarComo(CORREOS.docente);
      const propias = await firstValueFrom(api.misVersiones());
      expect(propias.every((v) => v.teacherId === 2)).toBe(true);

      const dePaola = db.versiones.find((v) => v.teacherId === 3)!;
      expect((await capturarError(api.obtenerVersion(dePaola.id))).code).toBe('NOT_FOUND');
      expect((await capturarError(api.guardarCampo(dePaola.id, 'objetivos', 'Otro'))).code).toBe('NOT_FOUND');
    });

    it('informa cuántas versiones de otros docentes hay en el módulo', async () => {
      await entrarComo(CORREOS.docente);
      const [propia] = await firstValueFrom(api.misVersiones());
      const a = await firstValueFrom(api.aislamiento(propia.id));
      expect(a.otrasVersiones).toBe(2);
      expect(a.docentes).toEqual(['Paola Valencia', 'Santiago Gómez']);
    });
  });

  describe('editar versión personalizada (HU-03)', () => {
    it('guarda campo por campo sin modificar la guía base ni las versiones de otros docentes', async () => {
      await entrarComo(CORREOS.docente);
      const baseAntes = structuredClone(db.guias.find((g) => g.id === GB_POO_01)!.content);
      const otrasAntes = structuredClone(db.versiones.filter((v) => v.teacherId !== 2));
      const v = await firstValueFrom(api.crearVersion(GB_POO_01, 'POO · Grupo 2026-2'));

      const editada = await firstValueFrom(api.guardarCampo(v.id, 'metodologia', 'Aula invertida'));

      expect(editada.content['metodologia']).toBe('Aula invertida');
      expect(editada.adaptedKeys).toEqual(['metodologia']);
      expect(editada.lastField).toBe('metodologia');
      expect(editada.fieldUpdatedAt['metodologia']).toBeTruthy();
      expect(db.guias.find((g) => g.id === GB_POO_01)!.content).toEqual(baseAntes);
      expect(db.versiones.filter((x) => x.teacherId !== 2)).toEqual(otrasAntes);
    });

    it('volver al texto de la guía base quita la marca de adaptado', async () => {
      await entrarComo(CORREOS.docente);
      const v = await firstValueFrom(api.crearVersion(GB_POO_01, 'POO · Grupo 2026-2'));
      const original = v.content['objetivos'] as string;
      await firstValueFrom(api.guardarCampo(v.id, 'objetivos', 'Diseñar clases en Java'));
      const restaurada = await firstValueFrom(api.guardarCampo(v.id, 'objetivos', original));
      expect(restaurada.adaptedKeys).toEqual([]);
    });

    it('respeta las reglas de la estructura', async () => {
      await entrarComo(CORREOS.docente);
      const v = await firstValueFrom(api.crearVersion(GB_POO_01, 'POO · Grupo 2026-2'));
      expect((await capturarError(api.guardarCampo(v.id, 'intensidad', '20 horas · 5 semanas'))).code).toBe('FIELD_NOT_EDITABLE');
      expect((await capturarError(api.guardarCampo(v.id, 'objetivos', '  '))).code).toBe('FIELD_REQUIRED');
      expect((await capturarError(api.guardarCampo(v.id, 'objetivos', 'x'.repeat(501)))).code).toBe('VALUE_TOO_LONG');
      expect((await capturarError(api.guardarCampo(v.id, 'evaluacion', 'Oral'))).code).toBe('INVALID_OPTION');
      expect((await capturarError(api.guardarCampo(v.id, 'inventado', 'x'))).code).toBe('FIELD_NOT_FOUND');
      // un campo opcional sí puede quedar vacío
      expect((await firstValueFrom(api.guardarCampo(v.id, 'recursos', ''))).content['recursos']).toBeNull();
    });

    it('lo que devuelve el servicio es una copia: modificarla no cambia los datos guardados', async () => {
      await entrarComo(CORREOS.docente);
      const v = await firstValueFrom(api.crearVersion(GB_POO_01, 'POO · Grupo 2026-2'));
      v.content['objetivos'] = 'Cambiado por referencia';
      expect(db.versiones.find((x) => x.id === v.id)!.content['objetivos']).not.toBe('Cambiado por referencia');
    });
  });
});
