import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SuggestionStatus, SuggestionView } from '../../../shared/models/suggestion';
import { Icon } from '../../../shared/ui/icon/icon';
import { fechaCorta, haceCuanto } from '../../../shared/utils/fechas';
import { SuggestionApi } from '../suggestion-api';
import { PILL_ESTADO } from '../estado-sugerencia';

// "Mis sugerencias" no tiene frame propio: usa la tabla de la bandeja del coordinador (5003:514)
// y la tarjeta "MIS SUGERENCIAS" de 5003:322.
@Component({
  selector: 'app-my-suggestions',
  imports: [RouterLink, Icon],
  templateUrl: './my-suggestions.html',
})
export class MySuggestions {
  private api = inject(SuggestionApi);

  sugerencias = signal<SuggestionView[]>([]);
  cargando = signal(true);
  pill = PILL_ESTADO;
  fecha = fechaCorta;
  hace = haceCuanto;

  contar = (estado: SuggestionStatus) => computed(() => this.sugerencias().filter((s) => s.status === estado).length);
  pendientes = this.contar('Pendiente');
  aprobadas = this.contar('Aprobada');
  rechazadas = this.contar('Rechazada');

  constructor() {
    this.api.misSugerencias().subscribe((s) => {
      this.sugerencias.set(s);
      this.cargando.set(false);
    });
  }
}
