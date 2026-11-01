import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Miga } from '../../../core/layout/miga';
import { ApiError } from '../../../shared/models/api-error';
import { GuideValue } from '../../../shared/models/guide-field';
import { SuggestionView } from '../../../shared/models/suggestion';
import { ConfirmModal } from '../../../shared/ui/confirm-modal/confirm-modal';
import { Icon } from '../../../shared/ui/icon/icon';
import { fechaCorta, haceCuanto, hora } from '../../../shared/utils/fechas';
import { fechaDeCalendario, partesDelCambio, siguienteVersion, textoPlazo } from '../../../shared/utils/sugerencias';
import { Aprobacion, RevisionSugerencia, SuggestionApi } from '../suggestion-api';
import { PILL_ESTADO, iniciales, nombreCorto } from '../estado-sugerencia';
import { AvisoDecision } from '../suggestion-inbox/suggestion-inbox';
import { RejectModal } from './reject-modal';

const MENSAJES: Record<string, string> = {
  GUIDE_CHANGED: 'El campo cambió desde que se envió la sugerencia. Recházala explicando que debe enviarse de nuevo sobre el texto vigente.',
  SUGGESTION_ALREADY_DECIDED: 'Esta sugerencia ya fue decidida.',
  GUIDE_NOT_PUBLISHED: 'La guía ya no está publicada.',
};

// Figma HE-05-HU-03 (aprobada, 5003:831) y HE-05-HU-04 (rechazo con retroalimentación, 5003:1054)
@Component({
  selector: 'app-suggestion-review',
  imports: [RouterLink, Icon, ConfirmModal, RejectModal],
  templateUrl: './suggestion-review.html',
  styleUrl: './suggestion-review.scss',
})
export class SuggestionReview {
  private api = inject(SuggestionApi);
  private router = inject(Router);
  private miga = inject(Miga);
  private id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

  revision = signal<RevisionSugerencia | null>(null);
  noExiste = signal(false);
  confirmando = signal(false);
  rechazando = signal(false);
  procesando = signal(false);
  error = signal('');
  /** Resultado de aprobar en esta visita (pantalla "Sugerencia aprobada"). */
  aprobada = signal<Aprobacion | null>(null);

  pill = PILL_ESTADO;
  iniciales = iniciales;
  corto = nombreCorto;
  fecha = fechaCorta;
  hora = hora;
  hace = haceCuanto;
  partes = partesDelCambio;
  plazo = textoPlazo;
  fechaRequerida = fechaDeCalendario;

  s = computed(() => this.revision()?.sugerencia ?? null);
  versionNueva = computed(() => {
    const s = this.s();
    return s ? (s.resultingVersion ?? siguienteVersion(s.guideVersion)) : '';
  });
  /** El campo de la guía ya no tiene el texto que vio el docente. */
  desactualizada = computed(() => {
    const r = this.revision();
    return !!r && r.sugerencia.status === 'Pendiente' && this.texto(r.valorVigente) !== this.texto(r.sugerencia.currentValue);
  });

  constructor() {
    this.api.obtener(this.id).subscribe({
      next: (r) => {
        this.revision.set(r);
        this.miga.detalle.set(r.sugerencia.code);
      },
      error: () => this.noExiste.set(true),
    });
  }

  texto(v: GuideValue | undefined): string {
    return v === null || v === undefined ? '' : String(v).trim();
  }

  aprobar(): void {
    this.procesando.set(true);
    this.api.aprobar(this.id).subscribe({
      next: (res) => {
        this.procesando.set(false);
        this.confirmando.set(false);
        this.aprobada.set(res);
        this.revision.update((r) => (r ? { ...r, sugerencia: res.sugerencia } : r));
      },
      error: (e: ApiError) => {
        this.procesando.set(false);
        this.confirmando.set(false);
        this.error.set(MENSAJES[e.code] ?? 'No se pudo aprobar la sugerencia. Intenta de nuevo.');
      },
    });
  }

  rechazada(s: SuggestionView): void {
    const aviso: AvisoDecision = { code: s.code, teacherName: s.teacherName };
    this.router.navigate(['/sugerencias'], { state: { rechazada: aviso } });
  }
}
