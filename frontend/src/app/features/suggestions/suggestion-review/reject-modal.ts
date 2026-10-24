import { Component, computed, inject, input, output, signal } from '@angular/core';
import { ApiError } from '../../../shared/models/api-error';
import { MOTIVOS_RECHAZO, RETROALIMENTACION_MAX, RETROALIMENTACION_MIN, SuggestionView } from '../../../shared/models/suggestion';
import { Icon } from '../../../shared/ui/icon/icon';
import { SuggestionApi } from '../suggestion-api';

// Figma HE-05-HU-04-CA-01 · Rechazo con retroalimentación (5003:1259)
@Component({
  selector: 'app-reject-modal',
  imports: [Icon],
  host: { '(document:keydown.escape)': 'cancelar.emit()' },
  template: `
    <div class="ui-modal-backdrop" (click)="cancelar.emit()">
      <section class="ui-modal" role="dialog" aria-modal="true" aria-labelledby="titulo-rechazo" (click)="$event.stopPropagation()">
        <header class="ui-modal__head">
          <span class="ui-modal__icon ui-modal__icon--danger"><app-icon name="circle-x" [size]="21" /></span>
          <div>
            <h2 id="titulo-rechazo" class="ui-modal__title-accent">Rechazar sugerencia {{ sugerencia().code }}</h2>
            <p>Explica el motivo para que el docente conozca la decisión.</p>
          </div>
        </header>

        <div class="ui-kv-box">
          <div class="ui-kv"><span>Docente</span><strong>{{ sugerencia().teacherName }}</strong></div>
          <div class="ui-kv"><span>Campo</span><strong>{{ sugerencia().fieldLabel }}</strong></div>
        </div>

        <div class="ui-field">
          <label for="motivo">Motivo del rechazo <span class="ui-required">*</span></label>
          <div class="ui-control" [class.ui-control--error]="intentado() && !motivo()">
            <select id="motivo" [value]="motivo()" (change)="motivo.set($any($event.target).value)">
              <option value="">Elige un motivo</option>
              @for (m of motivos; track m) {
                <option [value]="m">{{ m }}</option>
              }
            </select>
          </div>
        </div>

        <div class="ui-field">
          <label for="retro">Retroalimentación para el docente <span class="ui-required">*</span></label>
          <div class="ui-control" [class.ui-control--error]="intentado() && corta()">
            <textarea id="retro" [attr.maxlength]="max" [value]="retro()" (input)="retro.set($any($event.target).value)"></textarea>
          </div>
          <div class="ui-help-count">
            <p class="ui-help" [class.ui-help--error]="intentado() && corta()">
              @if (intentado() && corta()) {
                Escribe al menos {{ min }} caracteres.
              } @else {
                Explica al docente el motivo del rechazo.
              }
            </p>
            <span class="ui-counter">{{ largo() }}/{{ max }}</span>
          </div>
        </div>

        <div class="ui-notice ui-notice--gold">
          <app-icon name="circle-alert" [size]="16" />
          <div>
            <strong>La guía base no cambiará</strong>
            <p>El docente verá esta retroalimentación en Mis sugerencias y la sugerencia quedará como “Rechazada”.</p>
          </div>
        </div>

        @if (error()) {
          <p class="ui-help ui-help--error" role="alert">{{ error() }}</p>
        }

        <div class="ui-actions">
          <button type="button" class="ui-btn ui-btn--outline ui-btn--md" (click)="cancelar.emit()">Volver a la revisión</button>
          <button type="button" class="ui-btn ui-btn--danger ui-btn--md" [disabled]="enviando()" (click)="rechazar()">
            <app-icon name="send" [size]="14" /> {{ enviando() ? 'Enviando...' : 'Rechazar y enviar retroalimentación' }}
          </button>
        </div>
      </section>
    </div>
  `,
})
export class RejectModal {
  private api = inject(SuggestionApi);

  sugerencia = input.required<SuggestionView>();
  rechazada = output<SuggestionView>();
  cancelar = output<void>();

  readonly motivos = MOTIVOS_RECHAZO;
  readonly min = RETROALIMENTACION_MIN;
  readonly max = RETROALIMENTACION_MAX;

  motivo = signal('');
  retro = signal('');
  intentado = signal(false);
  enviando = signal(false);
  error = signal('');

  largo = computed(() => this.retro().trim().length);
  corta = computed(() => this.largo() < this.min);

  rechazar(): void {
    this.intentado.set(true);
    if (!this.motivo() || this.corta() || this.enviando()) return;
    this.enviando.set(true);
    this.api.rechazar(this.sugerencia().id, { motivo: this.motivo(), retroalimentacion: this.retro() }).subscribe({
      next: (s) => this.rechazada.emit(s),
      error: (e: ApiError) => {
        this.enviando.set(false);
        this.error.set(e.code === 'SUGGESTION_ALREADY_DECIDED' ? 'Esta sugerencia ya fue decidida.' : 'No se pudo rechazar. Intenta de nuevo.');
      },
    });
  }
}
