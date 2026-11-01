import { Component, input, output } from '@angular/core';
import { Icon } from '../icon/icon';

export type TonoModal = 'primary' | 'danger' | 'ok' | 'warn';

/**
 * Modal de confirmación con el estilo de las confirmaciones de Figma.
 * El contenido extra (avisos, campos) se proyecta dentro del cuerpo.
 */
@Component({
  selector: 'app-confirm-modal',
  imports: [Icon],
  host: { '(document:keydown.escape)': 'cancelar.emit()' },
  template: `
    <div class="ui-modal-backdrop" (click)="cancelar.emit()">
      <section
        class="ui-modal"
        [class.ui-modal--wide]="ancho()"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="titulo()"
        (click)="$event.stopPropagation()"
      >
        <header class="ui-modal__head">
          <span class="ui-modal__icon" [class]="'ui-modal__icon--' + tono()">
            <app-icon [name]="icono()" [size]="23" />
          </span>
          <div>
            <h2>{{ titulo() }}</h2>
            @if (mensaje()) {
              <p>{{ mensaje() }}</p>
            }
          </div>
        </header>

        <ng-content />

        <div class="ui-actions">
          <button type="button" class="ui-btn" (click)="cancelar.emit()">Cancelar</button>
          <button
            type="button"
            class="ui-btn"
            [class.ui-btn--primary]="tono() === 'primary' || tono() === 'warn'"
            [class.ui-btn--danger]="tono() === 'danger'"
            [class.ui-btn--ok]="tono() === 'ok'"
            [disabled]="procesando() || deshabilitado()"
            (click)="confirmar.emit()"
          >
            <app-icon [name]="iconoBoton() || icono()" [size]="16" />
            {{ procesando() ? 'Procesando...' : textoConfirmar() }}
          </button>
        </div>
      </section>
    </div>
  `,
})
export class ConfirmModal {
  titulo = input.required<string>();
  mensaje = input('');
  icono = input('circle-help');
  iconoBoton = input('');
  tono = input<TonoModal>('primary');
  textoConfirmar = input('Confirmar');
  procesando = input(false);
  deshabilitado = input(false);
  ancho = input(false);

  confirmar = output<void>();
  cancelar = output<void>();
}
