import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Miga } from '../../../core/layout/miga';
import { SuggestionView } from '../../../shared/models/suggestion';
import { Icon } from '../../../shared/ui/icon/icon';
import { fechaCorta, haceCuanto, hora } from '../../../shared/utils/fechas';
import { cuando } from '../../../shared/utils/modulos';
import { fechaDeCalendario, textoPlazo } from '../../../shared/utils/sugerencias';
import { SuggestionApi } from '../suggestion-api';
import { ICONO_ESTADO, PILL_ESTADO, nombreCorto } from '../estado-sugerencia';

// Figma HE-05-HU-01-CA-02 · Estado pendiente (5003:322). Las decididas usan el mismo esquema
// con el resultado (aprobada con la nueva versión o rechazada con la retroalimentación).
@Component({
  selector: 'app-my-suggestion',
  imports: [RouterLink, Icon],
  templateUrl: './my-suggestion.html',
  styleUrl: './my-suggestion.scss',
})
export class MySuggestion {
  private api = inject(SuggestionApi);
  private miga = inject(Miga);
  private id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

  sugerencia = signal<SuggestionView | null>(null);
  recientes = signal<SuggestionView[]>([]);
  noExiste = signal(false);
  /** Recién enviada desde "Sugerir cambio". */
  enviada = !!history.state?.enviada;

  pill = PILL_ESTADO;
  icono = ICONO_ESTADO;
  fecha = fechaCorta;
  hora = hora;
  corto = nombreCorto;
  fechaRequerida = fechaDeCalendario;
  plazo = textoPlazo;

  titulo = computed(() => {
    const s = this.sugerencia();
    if (!s) return '';
    if (s.status === 'Pendiente') return this.enviada ? 'Sugerencia enviada' : `Sugerencia ${s.code}`;
    return s.status === 'Aprobada' ? 'Sugerencia aprobada' : 'Sugerencia rechazada';
  });

  constructor() {
    this.api.obtenerMia(this.id).subscribe({
      next: (s) => {
        this.sugerencia.set(s);
        this.miga.detalle.set(s.code);
      },
      error: () => this.noExiste.set(true),
    });
    this.api.misSugerencias().subscribe((ss) => this.recientes.set(ss.slice(0, 4)));
  }

  /** "Pendiente · hoy, 10:20 a. m." o "Aprobada · 22 sep 2026" */
  estadoCorto(s: SuggestionView): string {
    return s.status === 'Pendiente' ? `Pendiente · ${haceCuanto(s.createdAt)}` : `${s.status} · ${fechaCorta(s.decidedAt)}`;
  }

  enviadaEl(s: SuggestionView): string {
    return cuando(s.createdAt).startsWith('Hoy') ? `Hoy, ${hora(s.createdAt)}` : `${fechaCorta(s.createdAt)}, ${hora(s.createdAt)}`;
  }
}
