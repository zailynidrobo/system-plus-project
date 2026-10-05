import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { startWith } from 'rxjs';
import { Auth } from '../../../core/auth/auth';
import { Role, ROLE_LABELS } from '../../../shared/models/user';
import { Icon } from '../../../shared/ui/icon/icon';
import { UserApi } from '../user-api';

const DOMINIO = '@systemplus.edu.co';

function correoInstitucional(control: AbstractControl): ValidationErrors | null {
  const valor = String(control.value ?? '').trim().toLowerCase();
  if (!valor) return null; // "required" se encarga del vacío
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) return { formato: true };
  return valor.endsWith(DOMINIO) ? null : { dominio: true };
}

@Component({
  selector: 'app-user-form',
  imports: [ReactiveFormsModule, RouterLink, Icon],
  templateUrl: './user-form.html',
  styleUrl: './user-form.scss',
})
export class UserForm {
  private fb = inject(FormBuilder);
  private api = inject(UserApi);
  private auth = inject(Auth);
  private router = inject(Router);

  labels = ROLE_LABELS;
  roles = (Object.keys(ROLE_LABELS) as Role[]).map((r) => ({ value: r, label: ROLE_LABELS[r] }));

  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(5), Validators.pattern(/\S/)]],
    correo: ['', [Validators.required, correoInstitucional]],
    rol: ['' as Role | '', [Validators.required]],
  });

  cargando = signal(false);
  correoEnUso = signal(false);
  errorGeneral = signal(false);

  private cambios = toSignal(this.form.valueChanges.pipe(startWith(null)));

  constructor() {
    this.form.controls.correo.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.correoEnUso.set(false));
  }

  // Panel "Antes de registrar": se actualiza mientras se escribe
  checklist = computed(() => {
    this.cambios(); // fuerza el recálculo cada vez que el formulario cambia
    const { nombre, correo, rol } = this.form.controls;
    const correoOk = correo.valid && !this.correoEnUso();
    return [
      {
        ok: nombre.valid,
        titulo: 'Nombre completo',
        detalle: nombre.valid ? 'Dato obligatorio ingresado' : 'Dato obligatorio pendiente',
      },
      {
        ok: correoOk,
        titulo: 'Correo único',
        detalle: this.correoEnUso()
          ? 'Ya existe en el directorio'
          : correo.valid
            ? 'Dominio institucional válido'
            : 'Pendiente de validar',
      },
      {
        ok: rol.valid,
        titulo: 'Un solo rol',
        detalle: rol.value ? this.labels[rol.value] : 'Selecciona un rol',
      },
      { ok: true, titulo: 'Acceso protegido', detalle: 'Contraseña cifrada' },
    ];
  });

  mensajeNombre(): string | null {
    const c = this.form.controls.nombre;
    if (!c.touched || c.valid) return null;
    return c.hasError('required') ? 'Ingresa el nombre completo.' : 'Escribe nombres y apellidos.';
  }

  mensajeCorreo(): string | null {
    if (this.correoEnUso()) return 'Este correo ya está registrado en el directorio.';
    const c = this.form.controls.correo;
    if (!c.touched || c.valid) return null;
    if (c.hasError('required')) return 'Ingresa el correo institucional.';
    if (c.hasError('formato')) return 'Ingresa un correo válido.';
    return `Debe pertenecer al dominio ${DOMINIO}.`;
  }

  mensajeRol(): string | null {
    const c = this.form.controls.rol;
    return c.touched && c.invalid ? 'Selecciona un rol.' : null;
  }

  registrar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { nombre, correo, rol } = this.form.getRawValue();
    this.cargando.set(true);
    this.errorGeneral.set(false);

    this.api.crear({ nombre, correo, rol: rol as Role }).subscribe({
      next: (usuario) =>
        this.router.navigate(['/usuarios/registro-exitoso'], {
          state: { usuario, creadoPor: this.auth.user()?.nombre, fecha: Date.now() },
        }),
      error: (err: Error) => {
        this.cargando.set(false);
        if (err.message === 'CORREO_EN_USO') this.correoEnUso.set(true);
        else this.errorGeneral.set(true);
      },
    });
  }
}