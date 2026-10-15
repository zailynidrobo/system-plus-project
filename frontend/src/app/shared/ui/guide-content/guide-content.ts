import { Component, input, output } from '@angular/core';
import { GuideContent, GuideField } from '../../models/guide-field';
import { Icon } from '../icon/icon';

/** Contenido de una guía campo por campo, en solo lectura. Opcionalmente con "Sugerir cambio" (HE-05). */
@Component({
  selector: 'app-guide-content',
  imports: [Icon],
  template: `
    <div class="ui-fields">
      @for (f of fields(); track f.key) {
        <section class="ui-readonly" [class.ui-readonly--soft]="soloLectura()" [attr.id]="'campo-' + f.key">
          <div class="ui-readonly__head">
            <span class="ui-readonly__label">{{ f.label }}</span>
            <span class="ui-cell">
              @if (pendientes().includes(f.key)) {
                <span class="ui-pill ui-pill--warn"><i></i> Sugerencia pendiente</span>
              }
              @if (soloLectura()) {
                <span class="ui-lock"><app-icon name="lock" [size]="11" /> Solo lectura</span>
              }
              @if (sugerible()) {
                <button type="button" class="ui-btn ui-btn--outline ui-btn--sm" (click)="sugerir.emit(f)">
                  <app-icon name="message-square" [size]="14" /> Sugerir cambio
                </button>
              }
            </span>
          </div>
          @if (texto(f.key); as t) {
            <p>{{ t }}</p>
          } @else {
            <p class="ui-readonly__empty">Sin diligenciar</p>
          }
        </section>
      }
    </div>
  `,
})
export class GuideContentView {
  fields = input.required<GuideField[]>();
  content = input.required<GuideContent>();
  sugerible = input(false);
  /** Estilo del espacio docente (HE-04): cada campo con la marca "Solo lectura". */
  soloLectura = input(false);
  /** Campos con una sugerencia pendiente del docente. */
  pendientes = input<string[]>([]);

  sugerir = output<GuideField>();

  texto(key: string): string {
    const v = this.content()[key];
    return v === null || v === undefined ? '' : String(v).trim();
  }
}
