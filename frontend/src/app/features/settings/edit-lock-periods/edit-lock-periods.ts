import { Component, computed, inject, signal } from '@angular/core';
import { ApiError } from '../../../shared/models/api-error';
import { GuideEditLock } from '../../../shared/models/guide-edit-lock';
import { Icon } from '../../../shared/ui/icon/icon';
import { ahoraLocalBogota, aIsoBogota, estadoPeriodo, rangoPeriodo } from '../../../shared/utils/periodos';
import { GuideEditLockApi } from '../../guides/guide-edit-lock-api';

export const MAX_NOMBRE = 150;
export const MAX_MENSAJE = 500;

const MENSAJES: Record<string, string> = {
  GUIDE_EDIT_LOCK_OVERLAP: 'Estas fechas se cruzan con otro periodo de bloqueo. Cambia el inicio o el fin.',
  GUIDE_EDIT_LOCK_PAST: 'La fecha de inicio no puede estar en el pasado.',
  GUIDE_EDIT_LOCK_INVALID_RANGE: 'La fecha de inicio debe ser anterior a la fecha de fin.',
  SIN_PERMISO: 'Tu sesión no tiene permiso para programar bloqueos.',
};

// Figma HE-09-HU-02-CA-01 · Configuración del sistema > Periodos de bloqueo
@Component({
  selector: 'app-edit-lock-periods',
  imports: [Icon],
  templateUrl: './edit-lock-periods.html',
  styleUrl: './edit-lock-periods.scss',
})
export class EditLockPeriods {
  private api = inject(GuideEditLockApi);
  private temporizadorToast?: ReturnType<typeof setTimeout>;

  readonly maxNombre = MAX_NOMBRE;
  readonly maxMensaje = MAX_MENSAJE;
  /** Roles a los que les aplica el bloqueo: hoy el back bloquea a todos los que editan guías. */
  readonly roles = ['Coordinador Académico', 'Docente', 'Docente Autorizado'];
  readonly menu = [
    { texto: 'Sugerencias', icono: 'message-square', activo: false },
    { texto: 'Periodos de bloqueo', icono: 'lock', activo: true },
    { texto: 'Notificaciones', icono: 'bell', activo: false },
    { texto: 'Seguridad y sesión', icono: 'shield-check', activo: false },
  ];
  readonly minimo = ahoraLocalBogota();
  rango = rangoPeriodo;
  estado = (p: GuideEditLock) => estadoPeriodo(p);

  periodos = signal<GuideEditLock[]>([]);
  cargando = signal(true);
  errorLista = signal<string | null>(null);

  nombre = signal('');
  inicio = signal('');
  fin = signal('');
  mensaje = signal('');
  intentado = signal(false);
  guardando = signal(false);
  errorEnvio = signal<string | null>(null);
  toast = signal<string | null>(null);
  porEliminar = signal<string | null>(null);

  /** Más reciente primero: lo programado arriba y lo finalizado abajo. */
  ordenados = computed(() => [...this.periodos()].sort((a, b) => b.startsAt.localeCompare(a.startsAt)));

  errores = computed(() => {
    const inicio = this.inicio();
    const fin = this.fin();
    return {
      nombre: this.nombre().trim() ? '' : 'Escribe el nombre del periodo.',
      inicio: !inicio ? 'Elige la fecha de inicio.' : inicio < this.minimo ? 'La fecha de inicio no puede estar en el pasado.' : '',
      fin: !fin ? 'Elige la fecha de fin.' : inicio && fin <= inicio ? 'La fecha de fin debe ser posterior al inicio.' : '',
      mensaje: this.mensaje().trim() ? '' : 'Escribe el mensaje que verán los usuarios.',
    };
  });
  valido = computed(() => Object.values(this.errores()).every((e) => !e));

  constructor() {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.errorLista.set(null);
    this.api.listar().subscribe({
      next: (p) => {
        this.periodos.set(p);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.errorLista.set('No pudimos cargar los periodos. Verifica que la API esté disponible e inténtalo de nuevo.');
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
      .crear({
        name: this.nombre().trim(),
        startsAt: aIsoBogota(this.inicio()),
        endsAt: aIsoBogota(this.fin()),
        reason: this.mensaje().trim(),
      })
      .subscribe({
        next: (p) => {
          this.periodos.update((lista) => [...lista, p]);
          this.limpiar();
          this.guardando.set(false);
          this.mostrarToast(`Bloqueo “${p.name}” programado`);
        },
        error: (e: ApiError) => {
          this.guardando.set(false);
          this.errorEnvio.set(MENSAJES[e.code] ?? 'No pudimos programar el bloqueo. Revisa los datos e inténtalo de nuevo.');
        },
      });
  }

  cancelar(): void {
    this.limpiar();
    this.errorEnvio.set(null);
  }

  eliminar(p: GuideEditLock): void {
    this.api.eliminar(p.id).subscribe({
      next: () => {
        this.periodos.update((lista) => lista.filter((x) => x.id !== p.id));
        this.porEliminar.set(null);
        this.mostrarToast(`Periodo “${p.name}” eliminado`);
      },
      error: () => {
        this.porEliminar.set(null);
        this.errorLista.set('No pudimos eliminar el periodo. Inténtalo de nuevo.');
      },
    });
  }

  private limpiar(): void {
    this.nombre.set('');
    this.inicio.set('');
    this.fin.set('');
    this.mensaje.set('');
    this.intentado.set(false);
  }

  private mostrarToast(texto: string): void {
    clearTimeout(this.temporizadorToast);
    this.toast.set(texto);
    this.temporizadorToast = setTimeout(() => this.toast.set(null), 3500);
  }
}
