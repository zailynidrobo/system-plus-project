import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GuideEvent, GuideView } from '../../../shared/models/guide';
import { GuideContentView } from '../../../shared/ui/guide-content/guide-content';
import { Icon } from '../../../shared/ui/icon/icon';
import { fechaCorta, hora } from '../../../shared/utils/fechas';
import { cuando } from '../../../shared/utils/modulos';
import { GuideApi } from '../guide-api';

// "Ver guía publicada": no tiene frame propio en Figma; usa el estilo del resto de HE-03.
@Component({
  selector: 'app-guide-detail',
  imports: [RouterLink, Icon, GuideContentView],
  templateUrl: './guide-detail.html',
})
export class GuideDetail {
  private api = inject(GuideApi);
  private id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

  guia = signal<GuideView | null>(null);
  historial = signal<GuideEvent[]>([]);
  cargando = signal(true);

  fecha = fechaCorta;
  hora = hora;
  cuando = cuando;

  constructor() {
    this.api.obtener(this.id).subscribe({
      next: (g) => {
        this.guia.set(g);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
    this.api.historial(this.id).subscribe({ next: (h) => this.historial.set(h), error: () => {} });
  }
}
