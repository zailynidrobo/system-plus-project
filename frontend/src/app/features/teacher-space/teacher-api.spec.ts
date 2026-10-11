import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { CORREOS, SIN_LATENCIA, entrarComo, limpiarSesion } from '../../../testing/test-helpers';
import { TeacherApi } from './teacher-api';

describe('TeacherApi', () => {
  let api: TeacherApi;

  beforeEach(() => {
    limpiarSesion();
    TestBed.configureTestingModule({ providers: [SIN_LATENCIA] });
    api = TestBed.inject(TeacherApi);
  });

  afterEach(limpiarSesion);

  it('el docente solo ve sus módulos asignados: POO y Bases de Datos', async () => {
    await entrarComo(CORREOS.docente);
    const nombres = (await firstValueFrom(api.misModulos())).map((m) => m.name);
    expect(nombres).toEqual(['Programación Orientada a Objetos', 'Bases de Datos']);
  });

  it('quien no tiene asignaciones no ve módulos', async () => {
    await entrarComo(CORREOS.coordinador);
    expect(await firstValueFrom(api.misModulos())).toEqual([]);
  });
});
