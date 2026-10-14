import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { startWith } from 'rxjs';
import { ApiError } from '../../../shared/models/api-error';
import { ModuleView } from '../../../shared/models/academic-module';
import { CompetencyView } from '../../../shared/models/competency';
import { Icon } from '../../../shared/ui/icon/icon';
import { hora } from '../../../shared/utils/fechas';
import { CompetencyApi } from '../competency-api';
import { ModuleApi } from '../module-api';

// Figma HE-02-HU-05 · Editar competencia (204:3021)
@Component({
  selector: 'app-competency-edit',
  imports: [ReactiveFormsModule, RouterLink, Icon],
  templateUrl: './competency-edit.html',
})
export class CompetencyEdit {
  private fb = inject(FormBuilder);
  private api = inject(CompetencyApi);
  private moduleApi = inject(ModuleApi);
  private params = inject(ActivatedRoute).snapshot.paramMap;
  moduleId = Number(this.params.get('id'));
  private competencyId = Number(this.params.get('competenciaId'));

  modulo = signal<ModuleView | null>(null);
  competencia = signal<CompetencyView | null>(null);
  otras = signal<CompetencyView[]>([]);
  textoAnterior = signal('');
  guardando = signal(false);
  guardada = signal(false);
  duplicada = signal<string | null>(null);
  error = signal(false);

  hora = hora;

  form = this.fb.nonNullable.group({ text: ['', [Validators.required, Validators.pattern(/\S/)]] });
  private valores = toSignal(this.form.valueChanges.pipe(startWith(null)));

  hayCambios = computed(() => {
    this.valores();
    const c = this.competencia();
    return !!c && this.form.controls.text.value.trim() !== c.text;
  });

  constructor() {
    this.moduleApi.obtener(this.moduleId).subscribe((m) => this.modulo.set(m));
    this.api.obtener(this.competencyId).subscribe((c) => this.mostrar(c, c.text));
    this.api.listar(this.moduleId).subscribe((l) => this.otras.set(l.filter((c) => c.id !== this.competencyId)));
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.duplicada.set(null));
  }

  descartar(): void {
    const c = this.competencia();
    if (c) this.form.reset({ text: c.text });
  }

  guardar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.hayCambios()) return;
    this.guardando.set(true);
    this.error.set(false);
    this.api.actualizar(this.competencyId, this.form.controls.text.value).subscribe({
      next: (r) => {
        this.guardando.set(false);
        this.guardada.set(true);
        this.mostrar(r.competencia, r.textoAnterior);
      },
      error: (err: ApiError<{ code: string }>) => {
        this.guardando.set(false);
        if (err.code === 'COMPETENCY_DUPLICATED') this.duplicada.set(err.data?.code ?? '');
        else this.error.set(true);
      },
    });
  }

  private mostrar(c: CompetencyView, anterior: string): void {
    this.competencia.set(c);
    this.textoAnterior.set(anterior);
    this.form.reset({ text: c.text });
  }
}
