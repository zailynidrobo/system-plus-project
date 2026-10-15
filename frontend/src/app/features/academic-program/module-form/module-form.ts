import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, filter, startWith, switchMap, tap } from 'rxjs';
import { ApiError } from '../../../shared/models/api-error';
import { ModuleView } from '../../../shared/models/academic-module';
import { Icon } from '../../../shared/ui/icon/icon';
import { hora } from '../../../shared/utils/fechas';
import { iconoModulo } from '../../../shared/utils/modulos';
import { ModuleApi } from '../module-api';

// Figma HE-02-HU-01: formulario (204:3942), duplicado (204:3823) y registro completado (204:3716)
@Component({
  selector: 'app-module-form',
  imports: [ReactiveFormsModule, RouterLink, Icon],
  templateUrl: './module-form.html',
})
export class ModuleForm {
  private fb = inject(FormBuilder);
  private api = inject(ModuleApi);
  private nombreInput = viewChild<ElementRef<HTMLInputElement>>('nombreInput');

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S/)]],
    description: [''],
  });

  nombreDisponible = signal(false);
  duplicado = signal<ModuleView | null>(null);
  faltaDescripcion = signal(false);
  guardando = signal<'registrar' | 'borrador' | null>(null);
  errorGeneral = signal(false);
  creado = signal<ModuleView | null>(null);

  icono = iconoModulo;
  hora = hora;

  private valores = toSignal(this.form.valueChanges.pipe(startWith(null)));

  validaciones = computed(() => {
    this.valores();
    const { name, description } = this.form.getRawValue();
    const nombreOk = name.trim().length > 0;
    const descripcionOk = description.trim().length > 0;
    return [
      { ok: nombreOk, titulo: 'Nombre obligatorio', detalle: nombreOk ? 'Dato completo ingresado' : 'Dato pendiente' },
      { ok: descripcionOk, titulo: 'Descripción obligatoria', detalle: descripcionOk ? 'Alcance formativo definido' : 'Dato pendiente' },
      { ok: this.nombreDisponible(), titulo: 'Nombre disponible', detalle: this.detalleDisponibilidad(nombreOk) },
      { ok: true, titulo: 'Estado inicial', detalle: 'Activo para nuevas guías' },
    ];
  });

  constructor() {
    const name = this.form.controls.name;
    name.valueChanges
      .pipe(
        tap(() => {
          this.nombreDisponible.set(false);
          this.duplicado.set(null);
        }),
        debounceTime(400),
        filter((v) => v.trim().length > 0),
        switchMap((v) => this.api.disponibilidadNombre(v)),
        takeUntilDestroyed(),
      )
      .subscribe((r) => {
        this.nombreDisponible.set(r.disponible);
        this.duplicado.set(r.existente);
      });

    this.form.controls.description.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.faltaDescripcion.set(false));
  }

  registrar(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.duplicado()) return;
    if (!this.form.controls.description.value.trim()) {
      this.faltaDescripcion.set(true);
      return;
    }
    this.enviar(false);
  }

  guardarBorrador(): void {
    this.form.controls.name.markAsTouched();
    if (this.form.controls.name.invalid || this.duplicado()) return;
    this.enviar(true);
  }

  corregirNombre(): void {
    const input = this.nombreInput()?.nativeElement;
    input?.focus();
    input?.select();
  }

  private enviar(borrador: boolean): void {
    this.guardando.set(borrador ? 'borrador' : 'registrar');
    this.errorGeneral.set(false);
    this.api.crear(this.form.getRawValue(), borrador).subscribe({
      next: (m) => {
        this.guardando.set(null);
        this.creado.set(m);
      },
      error: (err: ApiError<ModuleView>) => {
        this.guardando.set(null);
        if (err.code === 'MODULE_NAME_DUPLICATED' && err.data) this.duplicado.set(err.data);
        else this.errorGeneral.set(true);
      },
    });
  }

  private detalleDisponibilidad(hayNombre: boolean): string {
    if (this.duplicado()) return 'Ya existe en el programa';
    if (this.nombreDisponible()) return 'Sin coincidencias en el programa';
    return hayNombre ? 'Verificando…' : 'Pendiente de validar';
  }
}
