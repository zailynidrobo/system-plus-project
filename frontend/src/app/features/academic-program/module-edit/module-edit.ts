import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { startWith } from 'rxjs';
import { ApiError } from '../../../shared/models/api-error';
import { MODULE_STATUS_LABELS, ModuleView } from '../../../shared/models/academic-module';
import { Icon } from '../../../shared/ui/icon/icon';
import { fechaCorta } from '../../../shared/utils/fechas';
import { iconoModulo, pillEstadoModulo } from '../../../shared/utils/modulos';
import { ModuleApi } from '../module-api';

import { DESCRIPCION_MAX, NOMBRE_MAX } from '../modulo-limites';

// Editar módulo
@Component({
  selector: 'app-module-edit',
  imports: [ReactiveFormsModule, RouterLink, Icon],
  templateUrl: './module-edit.html',
})
export class ModuleEdit {
  private fb = inject(FormBuilder);
  private api = inject(ModuleApi);
  private router = inject(Router);
  nombreMax = NOMBRE_MAX;
  descripcionMax = DESCRIPCION_MAX;
  private id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

  modulo = signal<ModuleView | null>(null);
  cargando = signal(true);
  guardando = signal(false);
  guardado = signal(false);
  duplicado = signal<ModuleView | null>(null);
  errorGeneral = signal(false);

  labels = MODULE_STATUS_LABELS;
  pill = pillEstadoModulo;
  icono = iconoModulo;
  fecha = fechaCorta;

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(NOMBRE_MAX)]],
    description: ['', [Validators.maxLength(DESCRIPCION_MAX)]],
  });

  private valores = toSignal(this.form.valueChanges.pipe(startWith(null)));

  hayCambios = computed(() => {
    this.valores();
    const m = this.modulo();
    if (!m) return false;
    const v = this.form.getRawValue();
    return v.name.trim() !== m.name || v.description.trim() !== (m.description ?? '');
  });

  // La descripción es obligatoria salvo en borradores
  faltaDescripcion = computed(() => {
    this.valores();
    const m = this.modulo();
    return !!m && m.status !== 'draft' && !this.form.controls.description.value.trim();
  });

  constructor() {
    this.api.obtener(this.id).subscribe({
      next: (m) => this.cargarEnFormulario(m),
      error: () => this.cargando.set(false),
    });
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.guardado.set(false);
      this.duplicado.set(null);
    });
  }

  descartar(): void {
    const m = this.modulo();
    if (m) this.cargarEnFormulario(m);
  }

  guardar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.faltaDescripcion() || !this.hayCambios()) return;
    this.guardando.set(true);
    this.errorGeneral.set(false);
    this.api.actualizar(this.id, this.form.getRawValue()).subscribe({
      next: (m) => {
        this.cargarEnFormulario(m);
        this.guardando.set(false);
        this.guardado.set(true);
        // Al guardar se sale de la edición y se vuelve al detalle del módulo.
        this.router.navigate(['/modulos', this.id]);
      },
      error: (err: ApiError<ModuleView>) => {
        this.guardando.set(false);
        if (err.code === 'MODULE_NAME_DUPLICATED' && err.data) this.duplicado.set(err.data);
        else this.errorGeneral.set(true);
      },
    });
  }

  private cargarEnFormulario(m: ModuleView): void {
    this.modulo.set(m);
    this.form.reset({ name: m.name, description: m.description ?? '' });
    this.cargando.set(false);
  }
}
