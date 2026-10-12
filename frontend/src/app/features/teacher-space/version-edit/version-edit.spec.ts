import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { CORREOS, SIN_LATENCIA, entrarComo, limpiarSesion } from '../../../../testing/test-helpers';
import { MockDb } from '../../../core/mock/mock-db';
import { AUTOGUARDADO_MS, VersionEdit } from './version-edit';

const VERSION_DE_JULIAN = 1; // POO · Grupo 2026-1

describe('VersionEdit (editar mi versión campo por campo)', () => {
  let db: MockDb;

  beforeEach(async () => {
    limpiarSesion();
    TestBed.configureTestingModule({
      imports: [VersionEdit],
      providers: [
        SIN_LATENCIA,
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: String(VERSION_DE_JULIAN) }) } } },
      ],
    });
    db = TestBed.inject(MockDb);
    await entrarComo(CORREOS.docente);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    limpiarSesion();
  });

  function abrir() {
    const fixture = TestBed.createComponent(VersionEdit);
    respuesta();
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  // timer(0) del servicio mock: con relojes falsos necesita avanzar al menos 1 ms
  const respuesta = () => vi.advanceTimersByTime(1);
  const guardada = () => db.versiones.find((v) => v.id === VERSION_DE_JULIAN)!;

  it('guarda solo un segundo después de dejar de escribir', () => {
    const editor = abrir();
    const objetivos = editor.version()!.fields.find((f) => f.key === 'objetivos')!;
    const antes = guardada().content['objetivos'];

    editor.editar(objetivos);
    editor.escribir('Diseñar clases en Java');
    expect(editor.estado()).toBe('pendiente');

    vi.advanceTimersByTime(AUTOGUARDADO_MS - 1);
    expect(guardada().content['objetivos']).toBe(antes);

    vi.advanceTimersByTime(1);
    respuesta();
    expect(guardada().content['objetivos']).toBe('Diseñar clases en Java');
    expect(editor.estado()).toBe('listo');
    expect(editor.version()!.adaptedKeys).toContain('objetivos');
  });

  it('"Descartar" devuelve el campo al valor que tenía antes de editarlo, aunque ya se hubiera guardado solo', () => {
    const editor = abrir();
    const objetivos = editor.version()!.fields.find((f) => f.key === 'objetivos')!;
    const antes = guardada().content['objetivos'];

    editor.editar(objetivos);
    editor.escribir('Texto temporal');
    vi.advanceTimersByTime(AUTOGUARDADO_MS);
    respuesta();
    expect(guardada().content['objetivos']).toBe('Texto temporal');

    editor.descartar();
    respuesta();
    expect(guardada().content['objetivos']).toBe(antes);
    expect(editor.editando()).toBeNull();
  });

  it('no guarda un campo obligatorio vacío y muestra el error', () => {
    const editor = abrir();
    const objetivos = editor.version()!.fields.find((f) => f.key === 'objetivos')!;
    const antes = guardada().content['objetivos'];

    editor.editar(objetivos);
    editor.escribir('   ');
    vi.advanceTimersByTime(AUTOGUARDADO_MS);

    expect(guardada().content['objetivos']).toBe(antes);
    expect(editor.errorCampo()).toContain('obligatorio');
  });

  it('los campos que coordinación bloqueó no se pueden abrir', () => {
    const editor = abrir();
    const intensidad = editor.version()!.fields.find((f) => f.key === 'intensidad')!;
    editor.editar(intensidad);
    expect(editor.editando()).toBeNull();
  });
});
