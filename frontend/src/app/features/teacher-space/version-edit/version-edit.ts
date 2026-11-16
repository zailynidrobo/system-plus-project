import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { Auth } from '../../../core/auth/auth';
import { Miga } from '../../../core/layout/miga';
import { ApiError } from '../../../shared/models/api-error';
import { GuideEditLock } from '../../../shared/models/guide-edit-lock';
import { GuideField, GuideValue } from '../../../shared/models/guide-field';
import { TeacherVersionView } from '../../../shared/models/teacher-version';
import { Icon } from '../../../shared/ui/icon/icon';
import { complementoDe, esCampoDeTexto, unirComplemento } from '../../../shared/utils/complemento';
import { fechaCorta, haceCuanto, hora } from '../../../shared/utils/fechas';
import { diaDeReapertura, vigenciaPeriodo } from '../../../shared/utils/periodos';
import { GuideEditLockApi } from '../../guides/guide-edit-lock-api';
import { TeacherApi } from '../teacher-api';
import { AvisoGuardado } from '../version-list/version-list';

/** Espera tras la última tecla antes de guardar solo. */
export const AUTOGUARDADO_MS = 1000;

type EstadoGuardado = 'listo' | 'pendiente' | 'guardando' | 'error';

const MENSAJES: Record<string, string> = {
  FIELD_REQUIRED: 'Este campo es obligatorio: no puede quedar vacío.',
  VALUE_TOO_LONG: 'El texto supera el límite de caracteres.',
  INVALID_OPTION: 'Elige una de las opciones de la lista.',
  FIELD_NOT_EDITABLE: 'Coordinación definió este campo como no editable.',
  BASE_TEXT_REQUIRED: 'El texto de la guía base se conserva: escribe tu complemento después de él.',
};

/** "POO · Grupo 2026-1" -> "POO-Grupo-2026-1": sin caracteres que Windows no acepta en un nombre de archivo. */
export function nombreDeArchivo(nombre: string): string {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return limpio || 'mi-version';
}

// Figma HE-04-HU-03-CA-01, CA-02 · Editar mi versión (4002:1110)
@Component({
  selector: 'app-version-edit',
  imports: [RouterLink, Icon],
  templateUrl: './version-edit.html',
  styleUrl: './version-edit.scss',
})
export class VersionEdit {
  private api = inject(TeacherApi);
  private bloqueos = inject(GuideEditLockApi);
  private miga = inject(Miga);
  private auth = inject(Auth);
  private id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));
  private autoguardado = new Subject<void>();
  private pendiente = false;
  private guardadoEnEdicion = false;
  private valorInicial: GuideValue = null;
  private temporizadorToast?: ReturnType<typeof setTimeout>;

  version = signal<TeacherVersionView | null>(null);
  noExiste = signal(false);
  editando = signal<string | null>(null);
  borrador = signal<string>('');
  errorCampo = signal('');
  estado = signal<EstadoGuardado>('listo');
  ultimoGuardado = signal<string | null>(null);
  toast = signal<string | null>(null);
  /** Campos guardados en esta visita, para el aviso de "Mis versiones". */
  guardados = signal<string[]>([]);
  ahora = signal(Date.now());
  /** Periodo de bloqueo vigente (HE-09): solo consulta mientras dura. */
  bloqueo = signal<GuideEditLock | null>(null);
  /** El docente autorizado conserva el texto base y solo le agrega su complemento. */
  esAutorizado = computed(() => this.auth.user()?.rol === 'DOCENTE_AUTORIZADO');
  exportando = signal<'pdf' | 'docx' | null>(null);
  errorExportar = signal('');
  /** Mientras hay un cambio sin guardar, el documento saldría sin él: se espera a que se guarde. */
  puedeExportar = computed(() => !this.exportando() && this.estado() !== 'pendiente' && this.estado() !== 'guardando');
  vigencia = computed(() => { const b = this.bloqueo(); return b ? vigenciaPeriodo(b.startsAt, b.endsAt) : ''; });
  reapertura = computed(() => { const b = this.bloqueo(); return b ? diaDeReapertura(b.endsAt) : ''; });

  campoEditando = computed(() => this.version()?.fields.find((f) => f.key === this.editando()) ?? null);
  progreso = computed(() => {
    const v = this.version();
    return v && v.editableCount ? Math.round((v.adaptedKeys.length / v.editableCount) * 100) : 0;
  });

  /** "Criterios de evaluación · Guardado hoy, 10:12 a. m.", el más reciente primero. */
  recientes = computed(() => {
    const v = this.version();
    if (!v) return [];
    return Object.entries(v.fieldUpdatedAt)
      .filter(([key]) => key !== this.editando())
      .sort((a, b) => b[1].localeCompare(a[1]))
      .slice(0, 4)
      .map(([key, fecha]) => ({ label: this.etiqueta(key), cuando: this.guardadoEl(fecha) }));
  });

  indicador = computed(() => {
    this.ahora();
    switch (this.estado()) {
      case 'guardando':
        return 'Guardando...';
      case 'pendiente':
        return 'Cambios sin guardar...';
      case 'error':
        return 'No se pudo guardar el último cambio';
      default: {
        const ultimo = this.ultimoGuardado() ?? this.version()?.updatedAt;
        return `Todos los cambios guardados · ${haceCuanto(ultimo, this.ahora())}`;
      }
    }
  });

  aviso = computed<AvisoGuardado | null>(() => {
    const v = this.version();
    return v && this.guardados().length ? { versionId: v.id, versionName: v.name, campos: this.guardados() } : null;
  });

  fecha = fechaCorta;

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.autoguardado.pipe(debounceTime(AUTOGUARDADO_MS), takeUntilDestroyed()).subscribe(() => this.guardar(false));
    const reloj = setInterval(() => this.ahora.set(Date.now()), 5000);
    destroyRef.onDestroy(() => {
      clearInterval(reloj);
      clearTimeout(this.temporizadorToast);
      // Si sale con un cambio sin guardar, se guarda igual
      if (this.pendiente) this.guardar(false);
    });

    this.bloqueos.vigente().subscribe({ next: (b) => this.bloqueo.set(b), error: () => this.bloqueo.set(null) });

    this.api.obtenerVersion(this.id).subscribe({
      next: (v) => {
        this.version.set(v);
        this.miga.detalle.set(v.name);
        if (history.state?.creada) this.mostrarToast('Tu versión se creó como una copia independiente de la guía base');
      },
      error: () => this.noExiste.set(true),
    });
  }

  editable(f: GuideField): boolean {
    return f.teacherEditable !== false;
  }

  adaptado(key: string): boolean {
    return this.version()?.adaptedKeys.includes(key) ?? false;
  }

  texto(key: string, deBase = false): string {
    const v = this.version();
    const valor = deBase ? v?.baseContent[key] : v?.content[key];
    return valor === null || valor === undefined ? '' : String(valor);
  }

  /** Campo de texto con contenido base en la versión de un docente autorizado. */
  conComplemento(f: GuideField): boolean {
    return this.esAutorizado() && esCampoDeTexto(f.type) && this.texto(f.key, true).trim() !== '';
  }

  /** Caracteres que le quedan al complemento después del texto base y el salto de línea. */
  maximoComplemento(f: GuideField): number | null {
    if (!f.maxLength) return null;
    return Math.max(0, f.maxLength - this.texto(f.key, true).trim().length - 2);
  }

  /** Valor completo que se guarda: en modo complemento, base + complemento. */
  valorDe(f: GuideField): string {
    return this.conComplemento(f) ? unirComplemento(this.texto(f.key, true), this.borrador()) : this.borrador();
  }

  editar(f: GuideField): void {
    if (this.bloqueo() || !this.editable(f) || this.editando() === f.key) return;
    const actual = this.campoEditando();
    if (actual) {
      // No deja saltar a otro campo si el actual tiene un cambio inválido sin guardar
      const error = this.validar(actual, this.valorDe(actual));
      if (error && this.pendiente) {
        this.errorCampo.set(error);
        return;
      }
      this.guardar(false);
    }
    this.editando.set(f.key);
    this.valorInicial = this.version()?.content[f.key] ?? null;
    this.borrador.set(this.conComplemento(f) ? complementoDe(this.texto(f.key), this.texto(f.key, true)) : this.texto(f.key));
    this.errorCampo.set('');
    this.guardadoEnEdicion = false;
  }

  escribir(valor: string): void {
    this.borrador.set(valor);
    this.errorCampo.set('');
    this.pendiente = true;
    this.estado.set('pendiente');
    this.autoguardado.next();
  }

  /** Guarda el campo en edición. Con `cerrar` (botón "Guardar campo") además lo cierra y avisa. */
  guardar(cerrar: boolean): void {
    const v = this.version();
    const campo = this.campoEditando();
    if (!v || !campo) return;

    if (!this.pendiente) {
      if (cerrar) this.cerrar(campo, this.guardadoEnEdicion);
      return;
    }
    // Un cambio inválido queda pendiente: no se guarda ni deja cerrar el campo
    const valor = this.valorDe(campo);
    const error = this.validar(campo, valor);
    if (error) {
      this.errorCampo.set(error);
      this.estado.set('error');
      return;
    }

    this.pendiente = false;
    this.estado.set('guardando');
    this.api.guardarCampo(v.id, campo.key, valor).subscribe({
      next: (actualizada) => {
        this.version.set(actualizada);
        this.ultimoGuardado.set(new Date().toISOString());
        this.ahora.set(Date.now());
        this.estado.set(this.pendiente ? 'pendiente' : 'listo');
        this.guardadoEnEdicion = true;
        if (!this.guardados().includes(campo.label)) this.guardados.update((g) => [...g, campo.label]);
        if (cerrar) this.cerrar(campo, true);
      },
      error: (e: ApiError) => {
        this.estado.set('error');
        this.errorCampo.set(MENSAJES[e.code] ?? 'No se pudo guardar. Intenta de nuevo.');
      },
    });
  }

  /** Vuelve al valor que tenía el campo al empezar a editarlo (aunque ya se hubiera guardado solo). */
  descartar(): void {
    const v = this.version();
    const campo = this.campoEditando();
    if (!v || !campo) return;
    this.pendiente = false;
    this.editando.set(null);
    this.errorCampo.set('');
    if (v.content[campo.key] === this.valorInicial) {
      this.estado.set('listo');
      return;
    }
    this.estado.set('guardando');
    this.api.guardarCampo(v.id, campo.key, this.valorInicial).subscribe({
      next: (actualizada) => {
        this.version.set(actualizada);
        this.ultimoGuardado.set(new Date().toISOString());
        this.estado.set('listo');
      },
      error: () => this.estado.set('error'),
    });
  }

  etiqueta(key: string | null): string {
    return this.version()?.fields.find((f) => f.key === key)?.label ?? '';
  }

  private cerrar(campo: GuideField, avisar: boolean): void {
    this.editando.set(null);
    if (avisar) this.mostrarToast(`Campo “${campo.label}” guardado en tu versión`);
  }

  private validar(campo: GuideField, valor: string): string {
    const t = valor.trim();
    if (campo.required && !t) return MENSAJES['FIELD_REQUIRED'];
    if (campo.maxLength && t.length > campo.maxLength) return MENSAJES['VALUE_TOO_LONG'];
    return '';
  }

  /** PDF en una pestaña nueva; Word se descarga con el nombre de la versión. */
  exportar(formato: 'pdf' | 'docx'): void {
    const v = this.version();
    if (!v || !this.puedeExportar()) return;
    this.exportando.set(formato);
    this.errorExportar.set('');
    this.api.exportar(this.id, formato).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        if (formato === 'pdf') {
          enlace.target = '_blank';
          enlace.rel = 'noopener noreferrer';
        } else {
          enlace.download = `${nombreDeArchivo(v.name)}.docx`;
        }
        enlace.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.exportando.set(null);
      },
      error: () => {
        this.exportando.set(null);
        this.errorExportar.set('No se pudo generar el documento. Intenta de nuevo en un momento.');
      },
    });
  }

  private guardadoEl(iso: string): string {
    const hoy = new Date(iso).toDateString() === new Date().toDateString();
    return hoy ? `Guardado hoy, ${hora(iso)}` : `Guardado el ${fechaCorta(iso)}`;
  }

  private mostrarToast(texto: string): void {
    clearTimeout(this.temporizadorToast);
    this.toast.set(texto);
    this.temporizadorToast = setTimeout(() => this.toast.set(null), 3500);
  }
}
