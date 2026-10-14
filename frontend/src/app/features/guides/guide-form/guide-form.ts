import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Miga } from '../../../core/layout/miga';
import { ApiError } from '../../../shared/models/api-error';
import { ModuleView } from '../../../shared/models/academic-module';
import { CompetencyView } from '../../../shared/models/competency';
import { GuideView } from '../../../shared/models/guide';
import { FieldConfig, GuideContent } from '../../../shared/models/guide-field';
import { DynamicForm } from '../../../shared/ui/dynamic-form/dynamic-form';
import { Icon } from '../../../shared/ui/icon/icon';
import { fechaCorta, hora } from '../../../shared/utils/fechas';
import { CompetencyApi } from '../../academic-program/competency-api';
import { ModuleApi } from '../../academic-program/module-api';
import { FieldConfigApi } from '../field-config-api';
import { GuideApi } from '../guide-api';

// Figma HE-03-HU-01: formulario (2027:507) y guardada como borrador (2027:792)
@Component({
  selector: 'app-guide-form',
  imports: [RouterLink, Icon, DynamicForm],
  templateUrl: './guide-form.html',
})
export class GuideForm {
  private api = inject(GuideApi);
  private moduleApi = inject(ModuleApi);
  private competencyApi = inject(CompetencyApi);
  private fieldConfigApi = inject(FieldConfigApi);
  private miga = inject(Miga);
  private formulario = viewChild(DynamicForm);

  modulos = signal<ModuleView[]>([]);
  moduloId = signal<number | null>(null);
  competencias = signal<CompetencyView[]>([]);
  competenciaId = signal<number | null>(null);
  codigo = signal('');
  estructura = signal<FieldConfig | null>(null);
  contenido = signal<GuideContent>({});
  cargando = signal(true);
  guardando = signal(false);
  faltaCompetencia = signal(false);
  error = signal<string | null>(null);
  creada = signal<GuideView | null>(null);

  fecha = fechaCorta;
  hora = hora;

  modulo = computed(() => this.modulos().find((m) => m.id === this.moduloId()) ?? null);
  obligatorios = computed(() => this.estructura()?.fields.filter((f) => f.required).length ?? 0);

  // "Antes de guardar": módulo y competencia + cada campo obligatorio
  validaciones = computed(() => {
    const est = this.estructura();
    const contenido = this.contenido();
    const items = [{ ok: !!this.moduloId() && !!this.competenciaId(), titulo: 'Módulo y competencia', detalle: 'Seleccionados de la estructura académica' }];
    for (const f of est?.fields.filter((x) => x.required) ?? []) {
      const ok = String(contenido[f.key] ?? '').trim().length > 0;
      const detalle = ok
        ? f.type === 'select' ? 'Opción de la lista institucional' : 'Campo obligatorio diligenciado'
        : 'Pendiente por diligenciar';
      items.push({ ok, titulo: f.label, detalle });
    }
    return items;
  });

  constructor() {
    const pedido = Number(inject(ActivatedRoute).snapshot.queryParamMap.get('modulo')) || null;
    this.moduleApi.disponiblesParaGuias().subscribe((m) => {
      this.modulos.set(m);
      this.cargando.set(false);
      const inicial = m.find((x) => x.id === pedido) ?? m[0];
      if (inicial) this.elegirModulo(inicial.id);
    });
  }

  elegirModulo(id: number): void {
    this.moduloId.set(id);
    this.competenciaId.set(null);
    this.competencyApi.listar(id).subscribe((c) => this.competencias.set(c));
    this.api.siguienteCodigo(id).subscribe((c) => this.codigo.set(c));
    this.cargarEstructura();
  }

  elegirCompetencia(valor: string): void {
    this.competenciaId.set(valor ? Number(valor) : null);
    this.faltaCompetencia.set(false);
    this.cargarEstructura();
  }

  guardar(): void {
    const form = this.formulario();
    const valido = form?.validar() ?? false;
    this.faltaCompetencia.set(!this.competenciaId());
    if (!valido || !this.moduloId() || !this.competenciaId() || !form) return;

    this.guardando.set(true);
    this.error.set(null);
    this.api.crear({ moduleId: this.moduloId()!, competencyId: this.competenciaId()!, content: form.valor() }).subscribe({
      next: (g) => {
        this.guardando.set(false);
        this.creada.set(g);
        this.miga.detalle.set('Registro completado');
      },
      error: (err: ApiError) => {
        this.guardando.set(false);
        this.error.set(
          err.code === 'MODULE_NOT_AVAILABLE'
            ? 'El módulo ya no está disponible para nuevas guías.'
            : 'No pudimos guardar la guía. Revisa los campos obligatorios e inténtalo de nuevo.',
        );
      },
    });
  }

  private cargarEstructura(): void {
    const id = this.moduloId();
    if (!id) return;
    this.fieldConfigApi.obtener(id, this.competenciaId()).subscribe((e) => {
      // Si cambia la versión, se reconstruye el formulario conservando lo escrito
      if (this.estructura()?.version !== e.config.version || this.estructura()?.moduleId !== id) {
        this.estructura.set(e.config);
      }
    });
  }
}
