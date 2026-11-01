import { Component, input, output, signal } from '@angular/core';
import { GuideView } from '../../../shared/models/guide';
import { Icon } from '../../../shared/ui/icon/icon';

// Figma HE-03-HU-03-CA-02 · Ventana de confirmar publicación (2027:1373)
@Component({
  selector: 'app-publish-modal',
  imports: [Icon],
  host: { '(document:keydown.escape)': 'cancelar.emit()' },
  template: `
    <div class="ui-modal-backdrop" (click)="cancelar.emit()">
      <section class="ui-modal" role="dialog" aria-modal="true" aria-labelledby="titulo-publicar" (click)="$event.stopPropagation()">
        <header class="ui-modal__head">
          <span class="ui-modal__icon ui-modal__icon--warn"><app-icon name="send" [size]="20" /></span>
          <div>
            <h2 id="titulo-publicar" class="ui-modal__title-accent">¿Publicar esta guía base?</h2>
            <p>Pasará a ser la referencia oficial del módulo para todos sus docentes.</p>
          </div>
        </header>

        <div class="ui-box">
          <div class="ui-kv"><span>Guía</span><strong>{{ guia().code }} · {{ guia().moduleName }}</strong></div>
          <div class="ui-kv"><span>Competencia</span><strong>{{ guia().competencyCode }}</strong></div>
          <div class="ui-kv"><span>Docentes que la verán</span><strong>{{ docentes() }} {{ docentes() === 1 ? 'docente asignado' : 'docentes asignados' }}</strong></div>
          <div class="ui-kv">
            <span>Cambio de estado</span>
            <span class="ui-cell">
              <span class="ui-pill ui-pill--warn">Borrador</span> -> <span class="ui-pill ui-pill--ok"><i></i> Publicada</span>
            </span>
          </div>
        </div>

        <div class="ui-notice ui-notice--danger">
          <app-icon name="circle-alert" [size]="16" />
          <div>
            <strong>Acción de impacto institucional</strong>
            <p>Una vez publicada, la guía ya no podrá editarse directamente. Los cambios futuros deberán pasar por el proceso de sugerencias y aprobación.</p>
          </div>
        </div>

        <label class="ui-check">
          <input type="checkbox" [checked]="confirmado()" (change)="confirmado.set($any($event.target).checked)" />
          Confirmo que revisé el contenido y deseo publicar esta guía como referencia oficial.
        </label>

        <div class="ui-actions">
          <button type="button" class="ui-btn ui-btn--outline" (click)="cancelar.emit()">Seguir editando</button>
          <button type="button" class="ui-btn ui-btn--primary" [disabled]="!confirmado() || procesando()" (click)="confirmar.emit()">
            <app-icon name="check" [size]="15" /> {{ procesando() ? 'Publicando...' : 'Sí, publicar guía' }}
          </button>
        </div>
        @if (!confirmado()) {
          <p class="ui-help ui-right">Marca la confirmación para habilitar la publicación</p>
        }
      </section>
    </div>
  `,
})
export class PublishModal {
  guia = input.required<GuideView>();
  docentes = input(0);
  procesando = input(false);

  confirmar = output<void>();
  cancelar = output<void>();

  confirmado = signal(false);
}
