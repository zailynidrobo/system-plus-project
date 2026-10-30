import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Miga } from '../../../core/layout/miga';
import { ApiError } from '../../../shared/models/api-error';
import { GuideView } from '../../../shared/models/guide';
import { HistorialVersiones } from '../../../shared/models/guide-version';
import { Icon } from '../../../shared/ui/icon/icon';
import { fechaCorta, fechaHora } from '../../../shared/utils/fechas';
import { GuideApi } from '../guide-api';

// figma he-07-hu-01 historial de la guia
@Component({
  selector: 'app-guide-history',
  imports: [RouterLink, Icon],
  templateUrl: './guide-history.html',
  styleUrl: './guide-history.scss',
})
export class GuideHistory {
  private api = inject(GuideApi);
  private miga = inject(Miga);
  readonly id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

  guia = signal<GuideView | null>(null);
  historial = signal<HistorialVersiones | null>(null);
  cargando = signal(true);
  error = signal<string | null>(null);

  fecha = fechaCorta;
  fechaHora = fechaHora;

  constructor() {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    forkJoin({ guia: this.api.obtener(this.id), historial: this.api.versiones(this.id) }).subscribe({
      next: ({ guia, historial }) => {
        this.guia.set(guia);
        this.historial.set(historial);
        this.miga.detalle.set(`${guia.code} · Historial`);
        this.cargando.set(false);
      },
      error: (e) => {
        this.cargando.set(false);
        if (!(e instanceof ApiError && e.code === 'NOT_FOUND')) {
          this.error.set('No pudimos cargar el historial de la guía. Verifica que la API esté disponible e inténtalo de nuevo.');
        }
      },
    });
  }
}
