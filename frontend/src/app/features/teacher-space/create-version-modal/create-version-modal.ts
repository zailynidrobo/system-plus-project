import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { Auth } from '../../../core/auth/auth';
import { ApiError } from '../../../shared/models/api-error';
import { TeacherVersionView } from '../../../shared/models/teacher-version';
import { Icon } from '../../../shared/ui/icon/icon';
import { GuiaAsignada, TeacherApi } from '../teacher-api';

const MENSAJES: Record<string, string> = {
  NAME_REQUIRED: 'Escribe un nombre para tu versión.',
  VERSION_NAME_DUPLICATED: 'Ya tienes una versión con este nombre. Usa uno distinto.',
  GUIDE_NOT_ASSIGNED: 'Esta guía pertenece a un módulo que ya no tienes asignado.',
  NOT_FOUND: 'La guía ya no está publicada.',
};

/** "POO · Grupo 2026-2": sigla del módulo, año y semestre actuales. */
export function nombreSugerido(guia: GuiaAsignada, hoy = new Date()): string {
  const base = `${guia.competencyPrefix} · Grupo ${hoy.getFullYear()}-${hoy.getMonth() < 6 ? 1 : 2}`;
  const usados = new Set(guia.misVersiones.map((v) => v.name.toLowerCase()));
  if (!usados.has(base.toLowerCase())) return base;
  let n = 2;
  while (usados.has(`${base} (${n})`.toLowerCase())) n++;
  return `${base} (${n})`;
}

// Figma HE-04-HU-02-CA-01 · Crear mi versión (4002:738)
@Component({
  selector: 'app-create-version-modal',
  imports: [Icon],
  host: { '(document:keydown.escape)': 'cancelar.emit()' },
  template: `
    <div class="ui-modal-backdrop" (click)="cancelar.emit()">
      <section class="ui-modal" role="dialog" aria-modal="true" aria-labelledby="titulo-version" (click)="$event.stopPropagation()">
        <header class="ui-modal__head">
          <span class="ui-modal__icon"><app-icon name="copy" [size]="20" /></span>
          <div>
            <h2 id="titulo-version" class="ui-modal__title-accent">Crear mi versión de la guía</h2>
            <p>Se hará una copia completa de la guía base en tu espacio personal.</p>
          </div>
        </header>

        <div class="ui-transfer">
          <div class="ui-transfer__item">
            <span class="ui-tile ui-tile--xs ui-tile--ok"><app-icon name="file-text" [size]="15" /></span>
            <div><strong>Guía base {{ guia().version }}</strong><small>Institucional · solo lectura</small></div>
          </div>
          <app-icon name="arrow-right" [size]="18" />
          <div class="ui-transfer__item ui-transfer__item--accent">
            <span class="ui-tile ui-tile--xs ui-tile--white"><app-icon name="folder" [size]="15" /></span>
            <div><strong>Mi versión</strong><small>Espacio de {{ dueno() }}</small></div>
          </div>
        </div>

        <div class="ui-field">
          <label for="nombre-version">Nombre de mi versión <span class="ui-required">*</span></label>
          <div class="ui-control" [class.ui-control--error]="error()">
            <input
              id="nombre-version"
              maxlength="80"
              [value]="nombre()"
              (input)="nombre.set($any($event.target).value); error.set('')"
              (keydown.enter)="crear()"
            />
          </div>
          @if (error()) {
            <p class="ui-help ui-help--error">{{ error() }}</p>
          }
        </div>

        <div class="ui-kv-box">
          <div class="ui-kv"><span>Campos que se copiarán</span><strong>{{ guia().fields.length }} campos · estructura v{{ guia().structureVersion }}</strong></div>
          <div class="ui-kv"><span>Quién podrá verla</span><strong>Solo tú y coordinación</strong></div>
        </div>

        <div class="ui-notice ui-notice--info">
          <app-icon name="shield-check" [size]="16" />
          <div>
            <strong>Copia independiente</strong>
            <p>Tu versión es una copia física, no un enlace. Lo que cambies en ella nunca modificará la guía base ni las versiones de otros docentes.</p>
          </div>
        </div>

        <div class="ui-actions">
          <button type="button" class="ui-btn ui-btn--outline ui-btn--md" (click)="cancelar.emit()">Cancelar</button>
          <button type="button" class="ui-btn ui-btn--primary ui-btn--md" [disabled]="creando()" (click)="crear()">
            <app-icon name="copy" [size]="15" /> {{ creando() ? 'Creando...' : 'Crear mi versión' }}
          </button>
        </div>
      </section>
    </div>
  `,
})
export class CreateVersionModal implements OnInit {
  private api = inject(TeacherApi);
  private auth = inject(Auth);

  guia = input.required<GuiaAsignada>();
  creada = output<TeacherVersionView>();
  cancelar = output<void>();

  nombre = signal('');
  error = signal('');
  creando = signal(false);

  /** "Julián Ospina": primer nombre y último apellido, como en Figma. */
  dueno(): string {
    const partes = (this.auth.user()?.nombre ?? '').split(' ').filter(Boolean);
    return partes.length > 1 ? `${partes[0]} ${partes[partes.length - 1]}` : (partes[0] ?? '');
  }

  ngOnInit(): void {
    this.nombre.set(nombreSugerido(this.guia()));
  }

  crear(): void {
    if (this.creando()) return;
    if (!this.nombre().trim()) {
      this.error.set(MENSAJES['NAME_REQUIRED']);
      return;
    }
    this.creando.set(true);
    this.api.crearVersion(this.guia().id, this.nombre()).subscribe({
      next: (v) => this.creada.emit(v),
      error: (e: ApiError) => {
        this.creando.set(false);
        this.error.set(MENSAJES[e.code] ?? 'No se pudo crear la versión. Intenta de nuevo.');
      },
    });
  }
}
