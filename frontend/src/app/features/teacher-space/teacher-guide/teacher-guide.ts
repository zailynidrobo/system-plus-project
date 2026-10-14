import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Miga } from '../../../core/layout/miga';
import { ApiError } from '../../../shared/models/api-error';
import { TeacherVersionView } from '../../../shared/models/teacher-version';
import { GuideContentView } from '../../../shared/ui/guide-content/guide-content';
import { Icon } from '../../../shared/ui/icon/icon';
import { fechaCorta } from '../../../shared/utils/fechas';
import { CreateVersionModal } from '../create-version-modal/create-version-modal';
import { GuiaAsignada, TeacherApi } from '../teacher-api';
import { SuggestionApi } from '../../suggestions/suggestion-api';

// Figma HE-04-HU-01-CA-02 · Consultar guía base en solo lectura (4002:328)
@Component({
  selector: 'app-teacher-guide',
  imports: [RouterLink, Icon, GuideContentView, CreateVersionModal],
  templateUrl: './teacher-guide.html',
})
export class TeacherGuide {
  private api = inject(TeacherApi);
  private router = inject(Router);
  private miga = inject(Miga);
  private id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

  guia = signal<GuiaAsignada | null>(null);
  error = signal<string | null>(null);
  creando = signal(false);
  /** Campos con una sugerencia mía pendiente (HE-05). */
  pendientes = signal<string[]>([]);

  fecha = fechaCorta;

  constructor() {
    this.api.obtenerGuia(this.id).subscribe({
      next: (g) => {
        this.guia.set(g);
        this.miga.detalle.set(g.code);
      },
      error: (e: ApiError) => this.error.set(e.code),
    });
    inject(SuggestionApi)
      .misSugerencias()
      .subscribe((ss) => this.pendientes.set(ss.filter((s) => s.guideId === this.id && s.status === 'Pendiente').map((s) => s.fieldKey)));
  }

  abrirCrear(): void {
    this.creando.set(true);
    this.miga.detalle.set('Crear mi versión');
  }

  cerrarCrear(): void {
    this.creando.set(false);
    this.miga.detalle.set(this.guia()?.code ?? null);
  }

  versionCreada(v: TeacherVersionView): void {
    this.router.navigate(['/mis-versiones', v.id], { state: { creada: true } });
  }
}
