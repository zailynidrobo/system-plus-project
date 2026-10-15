import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ModuleView } from '../../../shared/models/academic-module';
import { CompetencyView } from '../../../shared/models/competency';
import { GuideStatus, GuideView } from '../../../shared/models/guide';
import { Icon } from '../../../shared/ui/icon/icon';
import { cuando } from '../../../shared/utils/modulos';
import { CompetencyApi } from '../../academic-program/competency-api';
import { ModuleApi } from '../../academic-program/module-api';
import { FiltroGuias, GuideApi, ResumenGuias } from '../guide-api';

const POR_PAGINA = 6;

// Figma HE-03 · Guías base institucionales (2025:26)
@Component({
  selector: 'app-guide-list',
  imports: [RouterLink, Icon],
  templateUrl: './guide-list.html',
})
export class GuideList {
  private api = inject(GuideApi);
  private moduleApi = inject(ModuleApi);
  private competencyApi = inject(CompetencyApi);

  filtro = signal<FiltroGuias>({ busqueda: '', moduleId: null, competencyId: null, estado: 'TODOS', pagina: 1, porPagina: POR_PAGINA });
  guias = signal<GuideView[]>([]);
  total = signal(0);
  resumen = signal<ResumenGuias | null>(null);
  modulos = signal<ModuleView[]>([]);
  competencias = signal<CompetencyView[]>([]);
  cargando = signal(true);

  estados: GuideStatus[] = ['Publicada', 'Borrador'];
  cuando = cuando;

  totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / POR_PAGINA)));
  paginas = computed(() => Array.from({ length: this.totalPaginas() }, (_, i) => i + 1));
  desde = computed(() => (this.total() === 0 ? 0 : (this.filtro().pagina - 1) * POR_PAGINA + 1));
  hasta = computed(() => Math.min(this.filtro().pagina * POR_PAGINA, this.total()));

  constructor() {
    this.cargar();
    this.api.resumen().subscribe((r) => this.resumen.set(r));
    this.moduleApi.listar({ busqueda: '', estado: 'TODOS', orden: 'codigo' }).subscribe((m) => this.modulos.set(m));
  }

  cambiar(cambios: Partial<FiltroGuias>): void {
    this.filtro.update((f) => ({ ...f, pagina: 1, ...cambios }));
    this.cargar();
  }

  filtrarModulo(valor: string): void {
    const moduleId = valor ? Number(valor) : null;
    this.competencias.set([]);
    if (moduleId) this.competencyApi.listar(moduleId).subscribe((c) => this.competencias.set(c));
    this.cambiar({ moduleId, competencyId: null });
  }

  irA(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas()) return;
    this.filtro.update((f) => ({ ...f, pagina }));
    this.cargar();
  }

  private cargar(): void {
    this.cargando.set(true);
    this.api.listar(this.filtro()).subscribe((p) => {
      this.guias.set(p.items);
      this.total.set(p.total);
      this.cargando.set(false);
    });
  }
}
