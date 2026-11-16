import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { CORREOS, SIN_LATENCIA, entrarComo, limpiarSesion } from '../../../../testing/test-helpers';
import { MockDb } from '../../../core/mock/mock-db';
import { AUTOGUARDADO_MS, VersionEdit, nombreDeArchivo } from './version-edit';

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
    vi.restoreAllMocks();
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

  it('descarga la versión en Word con su nombre y no exporta mientras hay un cambio sin guardar', () => {
    const editor = abrir();
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:version');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const objetivos = editor.version()!.fields.find((f) => f.key === 'objetivos')!;

    editor.editar(objetivos);
    editor.escribir('Diseñar clases en Java');
    expect(editor.puedeExportar()).toBe(false);
    editor.exportar('docx');
    expect(clic).not.toHaveBeenCalled();

    vi.advanceTimersByTime(AUTOGUARDADO_MS);
    respuesta();
    expect(editor.puedeExportar()).toBe(true);

    editor.exportar('docx');
    expect(editor.exportando()).toBe('docx');
    respuesta();
    expect(clic).toHaveBeenCalledTimes(1);
    const enlace = clic.mock.contexts[0] as HTMLAnchorElement;
    expect(enlace.download).toBe(`${nombreDeArchivo(editor.version()!.name)}.docx`);
    expect(editor.exportando()).toBeNull();
  });

  it('arma un nombre de archivo sin tildes ni caracteres que Windows rechaza', () => {
    expect(nombreDeArchivo('POO · Grupo 2026-1')).toBe('POO-Grupo-2026-1');
    expect(nombreDeArchivo('Programación: ¿sesión 3?')).toBe('Programacion-sesion-3');
    expect(nombreDeArchivo('···')).toBe('mi-version');
  });
});
