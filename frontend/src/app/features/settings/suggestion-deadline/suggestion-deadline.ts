import { Component, computed, inject, signal } from '@angular/core';
import { ApiError } from '../../../shared/models/api-error';
import { PLAZO_MAXIMO_DIAS, SuggestionSettings } from '../../../shared/models/suggestion-settings';
import { Icon } from '../../../shared/ui/icon/icon';
import { SettingsMenu } from '../settings-menu/settings-menu';
import { SuggestionSettingsApi } from '../suggestion-settings-api';

const MENSAJES: Record<string, string> = {
  DUE_SOON_AFTER_DUE: 'El aviso de vencimiento no puede ser mayor que el plazo de respuesta.',
  SIN_PERMISO: 'Tu sesión no tiene permiso para cambiar esta configuración.',
};

const fechaHora = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
});

/** HE-09-HU-01 · Configuración del sistema > Sugerencias: tiempo límite de respuesta. */
@Component({
  selector: 'app-suggestion-deadline',
  imports: [Icon, SettingsMenu],
  templateUrl: './suggestion-deadline.html',
  styleUrl: './suggestion-deadline.scss',
})
export class SuggestionDeadline {
  private api = inject(SuggestionSettingsApi);
  private temporizadorToast?: ReturnType<typeof setTimeout>;

  readonly maximo = PLAZO_MAXIMO_DIAS;

  actual = signal<SuggestionSettings | null>(null);
  cargando = signal(true);
  errorCarga = signal<string | null>(null);

  plazo = signal('');
  aviso = signal('');
  intentado = signal(false);
  guardando = signal(false);
  errorEnvio = signal<string | null>(null);
  toast = signal<string | null>(null);

  errores = computed(() => {
    const plazo = this.entero(this.plazo());
    const aviso = this.entero(this.aviso());
    return {
      plazo:
        plazo === null ? 'Escribe el plazo en días hábiles (número entero).'
        : plazo < 1 || plazo > this.maximo ? `El plazo debe estar entre 1 y ${this.maximo} días hábiles.`
        : '',
      aviso:
        aviso === null ? 'Escribe cuántos días hábiles después del envío se avisa (número entero).'
        : aviso < 1 || aviso > this.maximo ? `El aviso debe estar entre 1 y ${this.maximo} días hábiles.`
        : plazo !== null && aviso > plazo ? 'El aviso no puede ser mayor que el plazo de respuesta.'
        : '',
    };
  });
  valido = computed(() => !this.errores().plazo && !this.errores().aviso);
  sinCambios = computed(() => {
    const a = this.actual();
    return !!a && this.entero(this.plazo()) === a.dueBusinessDays && this.entero(this.aviso()) === a.dueSoonBusinessDays;
  });
  ultimaModificacion = computed(() => {
    const a = this.actual();
    if (!a || a.source !== 'admin' || !a.updatedAt) return null;
    return `${fechaHora.format(new Date(a.updatedAt))} por ${a.updatedByName ?? 'el administrador'}`;
  });

  constructor() {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.errorCarga.set(null);
    this.api.obtener().subscribe({
      next: (s) => {
        this.aplicar(s);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.errorCarga.set('No pudimos cargar la configuración. Verifica que la API esté disponible e inténtalo de nuevo.');
      },
    });
  }

  guardar(): void {
    if (this.guardando()) return;
    this.intentado.set(true);
    this.errorEnvio.set(null);
    if (!this.valido()) return;

    this.guardando.set(true);
    this.api
      .guardar({ dueBusinessDays: this.entero(this.plazo())!, dueSoonBusinessDays: this.entero(this.aviso())! })
      .subscribe({
        next: (s) => {
          this.aplicar(s);
          this.guardando.set(false);
          this.mostrarToast('Tiempo límite actualizado');
        },
        error: (e: ApiError) => {
          this.guardando.set(false);
          this.errorEnvio.set(MENSAJES[e.code] ?? 'No pudimos guardar el cambio. Revisa los datos e inténtalo de nuevo.');
        },
      });
  }

  descartar(): void {
    const a = this.actual();
    if (a) this.aplicar(a);
    this.errorEnvio.set(null);
  }

  private aplicar(s: SuggestionSettings): void {
    this.actual.set(s);
    this.plazo.set(String(s.dueBusinessDays));
    this.aviso.set(String(s.dueSoonBusinessDays));
    this.intentado.set(false);
  }

  private entero(valor: string): number | null {
    return /^\d+$/.test(valor.trim()) ? Number(valor.trim()) : null;
  }

  private mostrarToast(texto: string): void {
    clearTimeout(this.temporizadorToast);
    this.toast.set(texto);
    this.temporizadorToast = setTimeout(() => this.toast.set(null), 3500);
  }
}
