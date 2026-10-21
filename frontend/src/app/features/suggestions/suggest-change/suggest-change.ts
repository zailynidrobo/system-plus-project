import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiError } from '../../../shared/models/api-error';
import { GuideField } from '../../../shared/models/guide-field';
import { JUSTIFICACION_MIN } from '../../../shared/models/suggestion';
import { Icon } from '../../../shared/ui/icon/icon';
import { GuiaAsignada, TeacherApi } from '../../teacher-space/teacher-api';
import { SuggestionApi } from '../suggestion-api';

const MENSAJES: Record<string, string> = {
  NO_CHANGES: 'El cambio propuesto es igual al contenido actual.',
  PROPOSAL_REQUIRED: 'Escribe el cambio que propones.',
  INVALID_OPTION: 'Elige una de las opciones de la lista.',
  VALUE_TOO_LONG: 'El cambio supera el límite de caracteres del campo.',
  JUSTIFICATION_REQUIRED: 'Explica por qué propones el cambio.',
  JUSTIFICATION_TOO_SHORT: `La justificación debe tener al menos ${JUSTIFICACION_MIN} caracteres.`,
  SUGGESTION_ALREADY_PENDING: 'Ya tienes una sugerencia pendiente sobre este campo. Espera la decisión de coordinación.',
  GUIDE_NOT_ASSIGNED: 'Esta guía pertenece a un módulo que no tienes asignado.',
};

// Figma HE-05-HU-01-CA-01 · Sugerir cambio (5003:26)
@Component({
  selector: 'app-suggest-change',
  imports: [RouterLink, Icon],
  templateUrl: './suggest-change.html',
  styleUrl: './suggest-change.scss',
})
export class SuggestChange {
  private teacherApi = inject(TeacherApi);
  private api = inject(SuggestionApi);
  private router = inject(Router);
  private ruta = inject(ActivatedRoute).snapshot;
  private id = Number(this.ruta.paramMap.get('id'));

  guia = signal<GuiaAsignada | null>(null);
  error = signal<string | null>(null);
  /** Campos con una sugerencia mía pendiente: no se puede enviar otra. */
  pendientes = signal<string[]>([]);
  campoKey = signal<string | null>(null);
  propuesta = signal('');
  justificacion = signal('');
  mensaje = signal('');
  intentado = signal(false);
  enviando = signal(false);

  readonly minimo = JUSTIFICACION_MIN;

  campo = computed(() => this.guia()?.fields.find((f) => f.key === this.campoKey()) ?? null);
  actual = computed(() => {
    const v = this.guia()?.content[this.campoKey() ?? ''];
    return v === null || v === undefined ? '' : String(v);
  });
  opciones = computed(() => (this.campo()?.options ?? []).filter((o) => o !== this.actual()));

  faltaPropuesta = computed(() => this.intentado() && !this.propuesta().trim() && !!this.campo()?.required);
  faltaJustificacion = computed(() => this.intentado() && this.justificacion().trim().length < this.minimo);

  constructor() {
    this.teacherApi.obtenerGuia(this.id).subscribe({
      next: (g) => {
        this.guia.set(g);
        const pedido = this.ruta.queryParamMap.get('campo');
        this.elegir(g.fields.find((f) => f.key === pedido) ?? g.fields[0]);
      },
      error: (e: ApiError) => this.error.set(e.code),
    });
    this.api.misSugerencias().subscribe((ss) =>
      this.pendientes.set(ss.filter((s) => s.guideId === this.id && s.status === 'Pendiente').map((s) => s.fieldKey)),
    );
  }

  elegir(f: GuideField): void {
    this.campoKey.set(f.key);
    // Los textos parten del contenido actual para editar sobre él; las listas, de una opción nueva
    this.propuesta.set(f.type === 'select' ? '' : this.actual());
    this.mensaje.set('');
  }

  enviar(): void {
    const g = this.guia();
    const campo = this.campo();
    if (!g || !campo || this.enviando()) return;
    this.intentado.set(true);
    if (this.faltaPropuesta() || this.faltaJustificacion()) return;

    this.enviando.set(true);
    this.api
      .enviar({ guideId: g.id, fieldKey: campo.key, proposedValue: this.propuesta(), justification: this.justificacion() })
      .subscribe({
        next: (s) => this.router.navigate(['/mis-sugerencias', s.id], { state: { enviada: true } }),
        error: (e: ApiError) => {
          this.enviando.set(false);
          this.mensaje.set(MENSAJES[e.code] ?? 'No se pudo enviar la sugerencia. Intenta de nuevo.');
        },
      });
  }
}
