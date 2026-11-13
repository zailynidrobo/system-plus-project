import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiError } from '../../../shared/models/api-error';
import { SuggestionSettings } from '../../../shared/models/suggestion-settings';
import { SuggestionSettingsApi } from '../suggestion-settings-api';
import { SuggestionDeadline } from './suggestion-deadline';

const VIGENTE: SuggestionSettings = {
  dueBusinessDays: 8,
  dueSoonBusinessDays: 5,
  source: 'env',
  updatedAt: null,
  updatedByName: null,
};

describe('Configuración > Sugerencias (HE-09-HU-01)', () => {
  let fixture: ComponentFixture<SuggestionDeadline>;
  let pantalla: SuggestionDeadline;
  let guardar: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    guardar = vi.fn((c) => of({ ...c, source: 'admin', updatedAt: '2026-11-12T20:00:00.000Z', updatedByName: 'Andrea Salazar' }));
    await TestBed.configureTestingModule({
      imports: [SuggestionDeadline],
      providers: [provideRouter([]), { provide: SuggestionSettingsApi, useValue: { obtener: () => of(VIGENTE), guardar } }],
    }).compileComponents();
    fixture = TestBed.createComponent(SuggestionDeadline);
    pantalla = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('muestra el valor vigente y que aún no se ha cambiado desde el sistema', () => {
    const texto = fixture.nativeElement.textContent;
    expect(pantalla.plazo()).toBe('8');
    expect(pantalla.aviso()).toBe('5');
    expect(texto).toContain('8 días hábiles');
    expect(texto).toContain('Aún no se han cambiado desde el sistema');
  });

  it('no deja guardar si no hay cambios', () => {
    expect(pantalla.sinCambios()).toBe(true);
  });

  it('valida que sean enteros dentro del rango y que el aviso no supere el plazo', () => {
    pantalla.plazo.set('0');
    expect(pantalla.errores().plazo).toContain('entre 1 y 60');
    pantalla.plazo.set('abc');
    expect(pantalla.errores().plazo).toContain('número entero');
    pantalla.plazo.set('4');
    pantalla.aviso.set('6');
    expect(pantalla.errores().aviso).toContain('no puede ser mayor');
    pantalla.guardar();
    expect(guardar).not.toHaveBeenCalled();
  });

  it('guarda el nuevo plazo y muestra quién lo modificó', () => {
    pantalla.plazo.set('10');
    pantalla.aviso.set('7');
    pantalla.guardar();
    fixture.detectChanges();
    expect(guardar).toHaveBeenCalledWith({ dueBusinessDays: 10, dueSoonBusinessDays: 7 });
    expect(pantalla.actual()?.source).toBe('admin');
    expect(fixture.nativeElement.textContent).toContain('por Andrea Salazar');
    expect(pantalla.toast()).toBe('Tiempo límite actualizado');
  });

  it('explica el error que devuelve la API', () => {
    guardar.mockReturnValue(throwError(() => new ApiError('DUE_SOON_AFTER_DUE')));
    pantalla.plazo.set('10');
    pantalla.aviso.set('7');
    pantalla.guardar();
    expect(pantalla.errorEnvio()).toContain('no puede ser mayor');
  });

  it('descartar vuelve a los valores guardados', () => {
    pantalla.plazo.set('12');
    pantalla.descartar();
    expect(pantalla.plazo()).toBe('8');
  });
});
