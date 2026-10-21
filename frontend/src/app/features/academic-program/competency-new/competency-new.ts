import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiError } from '../../../shared/models/api-error';
import { ModuleView } from '../../../shared/models/academic-module';
import { CompetencyView } from '../../../shared/models/competency';
import { Icon } from '../../../shared/ui/icon/icon';
import { iconoModulo } from '../../../shared/utils/modulos';
import { CompetencyApi } from '../competency-api';
import { COMPETENCIA_MAX, COMPETENCIA_MIN, longitudCompetencia } from '../competency-text';
import { ModuleApi } from '../module-api';

// Figma HE-02-HU-04 · Asociar nueva competencia (204:3143)
@Component({
  selector: 'app-competency-new',
  imports: [ReactiveFormsModule, RouterLink, Icon],
  templateUrl: './competency-new.html',
})
export class CompetencyNew {
  private fb = inject(FormBuilder);
  private moduleApi = inject(ModuleApi);
  private api = inject(CompetencyApi);
  moduleId = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

  modulo = signal<ModuleView | null>(null);
  codigo = signal('');
  guardando = signal(false);
  creada = signal<CompetencyView | null>(null);
  duplicada = signal<string | null>(null);
  error = signal(false);
  detalleError = signal('');
  errorCarga = signal(false);
  minimo = COMPETENCIA_MIN;
  maximo = COMPETENCIA_MAX;

  icono = iconoModulo;

  form = this.fb.nonNullable.group({ text: ['', [Validators.required, Validators.pattern(/\S/), longitudCompetencia]] });

  constructor() {
    this.cargarModulo();
    this.cargarCodigo();
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.duplicada.set(null));
  }

  asociar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.guardando.set(true);
    this.error.set(false);
    this.detalleError.set('');
    this.api.crear(this.moduleId, this.form.controls.text.value).subscribe({
      next: (c) => {
        this.guardando.set(false);
        this.creada.set(c);
      },
      error: (err: ApiError<{ code: string }>) => {
        this.guardando.set(false);
        if (err.code === 'COMPETENCY_DUPLICATED') this.duplicada.set(err.data?.code ?? '');
        else {
          // 400 del backend: se muestra lo que dijo (p. ej. la longitud mínima) en vez de un aviso genérico.
          const mensajes = (err.data as unknown as { mensajes?: string[] } | undefined)?.mensajes;
          this.detalleError.set(err.code === 'VALIDATION_ERROR' ? (mensajes ?? []).join(' ') : '');
          this.error.set(true);
        }
      },
    });
  }

  otra(): void {
    this.creada.set(null);
    this.form.reset();
    this.cargarCodigo();
  }

  cargarModulo(): void {
    this.errorCarga.set(false);
    this.moduleApi.obtener(this.moduleId).subscribe({
      next: (m) => this.modulo.set(m),
      error: () => this.errorCarga.set(true),
    });
  }

  private cargarCodigo(): void {
    this.api.siguienteCodigo(this.moduleId).subscribe({ next: (c) => this.codigo.set(c), error: () => {} });
  }
}
