import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ModuleView } from '../../../shared/models/academic-module';
import { CompetencyView } from '../../../shared/models/competency';
import { Icon } from '../../../shared/ui/icon/icon';
import { CompetencyApi, GuiaReferencia } from '../competency-api';
import { ModuleApi } from '../module-api';

// Figma HE-02-HU-06 · Eliminar competencia (204:2892)
@Component({
  selector: 'app-competency-delete',
  imports: [RouterLink, Icon],
  templateUrl: './competency-delete.html',
})
export class CompetencyDelete {
  private api = inject(CompetencyApi);
  private moduleApi = inject(ModuleApi);
  private params = inject(ActivatedRoute).snapshot.paramMap;
  moduleId = Number(this.params.get('id'));
  private competencyId = Number(this.params.get('competenciaId'));

  modulo = signal<ModuleView | null>(null);
  competencia = signal<CompetencyView | null>(null);
  guias = signal<GuiaReferencia[]>([]);
  restantes = signal<number | null>(null);
  procesando = signal(false);
  error = signal(false);

  constructor() {
    this.moduleApi.obtener(this.moduleId).subscribe((m) => this.modulo.set(m));
    this.api.obtener(this.competencyId).subscribe((c) => this.competencia.set(c));
    this.api.guiasPublicadas(this.competencyId).subscribe((g) => this.guias.set(g));
  }

  confirmar(): void {
    this.procesando.set(true);
    this.error.set(false);
    this.api.eliminar(this.competencyId).subscribe({
      next: (r) => {
        this.competencia.set(r.competencia);
        this.restantes.set(r.restantes);
        this.procesando.set(false);
      },
      error: () => {
        this.procesando.set(false);
        this.error.set(true);
      },
    });
  }

  titulos(): string {
    return this.guias().map((g) => `“${g.title}”`).join(', ');
  }
}
