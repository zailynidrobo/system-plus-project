import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GuideView } from '../../../shared/models/guide';
import { SuggestionStatus, SuggestionView } from '../../../shared/models/suggestion';
import { Icon } from '../../../shared/ui/icon/icon';
import { fechaCorta, hora } from '../../../shared/utils/fechas';
import { plazo } from '../../../shared/utils/sugerencias';
import { FiltroSugerencias, ResumenSugerencias, SuggestionApi } from '../suggestion-api';
import { PILL_ESTADO, iniciales } from '../estado-sugerencia';

/** Lo que deja la revisión al rechazar, para el aviso de la bandeja. */
export interface AvisoDecision {
  code: string;
  teacherName: string;
}

// Figma HE-05-HU-02-CA-01 · Sugerencias pendientes (5003:514)
@Component({
  selector: 'app-suggestion-inbox',
  imports: [RouterLink, Icon],
  templateUrl: './suggestion-inbox.html',
  styleUrl: './suggestion-inbox.scss',
})
export class SuggestionInbox {
  private api = inject(SuggestionApi);

  filtro = signal<FiltroSugerencias>({ estado: 'Pendiente', moduleId: null, guideId: null, orden: 'antiguas' });
  sugerencias = signal<SuggestionView[]>([]);
  resumen = signal<ResumenSugerencias | null>(null);
  guias = signal<GuideView[]>([]);
  cargando = signal(true);
  rechazada: AvisoDecision | null = (history.state?.rechazada as AvisoDecision | undefined) ?? null;

  pestanas: { estado: SuggestionStatus | 'TODAS'; texto: string }[] = [
    { estado: 'Pendiente', texto: 'Pendientes' },
    { estado: 'Aprobada', texto: 'Aprobadas' },
    { estado: 'Rechazada', texto: 'Rechazadas' },
    { estado: 'TODAS', texto: 'Todas' },
  ];
  pill = PILL_ESTADO;
  iniciales = iniciales;
  plazo = plazo;

  constructor() {
    this.cargar();
    this.api.resumen().subscribe((r) => this.resumen.set(r));
    this.api.guiasConSugerencias().subscribe((g) => this.guias.set(g));
  }

  cambiar(cambios: Partial<FiltroSugerencias>): void {
    this.filtro.update((f) => ({ ...f, ...cambios }));
    this.cargar();
  }

  /** "Hoy, 10:20 a. m.", "Ayer, 3:05 p. m." o "05 oct, 9:40 a. m." */
  recibida(iso: string): string {
    const d = new Date(iso);
    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);
    if (d.toDateString() === hoy.toDateString()) return `Hoy, ${hora(iso)}`;
    if (d.toDateString() === ayer.toDateString()) return `Ayer, ${hora(iso)}`;
    return `${fechaCorta(iso).slice(0, 6)}, ${hora(iso)}`;
  }

  /** Texto del pie: "Mostrando 4 sugerencias pendientes". */
  pie(): string {
    const n = this.sugerencias().length;
    const estado = { Pendiente: 'pendientes', Aprobada: 'aprobadas', Rechazada: 'rechazadas', TODAS: '' }[this.filtro().estado];
    return `Mostrando ${n} ${n === 1 ? 'sugerencia' : 'sugerencias'}${estado ? ' ' + (n === 1 ? estado.slice(0, -1) : estado) : ''}`;
  }

  private cargar(): void {
    this.cargando.set(true);
    this.api.listar(this.filtro()).subscribe((s) => {
      this.sugerencias.set(s);
      this.cargando.set(false);
    });
  }
}
