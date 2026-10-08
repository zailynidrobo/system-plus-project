import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { startWith } from 'rxjs';
import { ROLE_LABELS, User } from '../../../shared/models/user';
import { Icon } from '../../../shared/ui/icon/icon';
import { UserApi } from '../user-api';

const DOMINIO = '@systemplus.edu.co';

function correoInstitucional(control: AbstractControl): ValidationErrors | null {
  const valor = String(control.value ?? '').trim().toLowerCase();
  if (!valor) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) return { formato: true };
  return valor.endsWith(DOMINIO) ? null : { dominio: true };
}

@Component({
  selector: 'app-user-edit',
  imports: [ReactiveFormsModule, RouterLink, Icon],
  templateUrl: './user-edit.html',
  styleUrl: './user-edit.scss',
})
export class UserEdit {
  private fb = inject(FormBuilder);
  private api = inject(UserApi);
  private route = inject(ActivatedRoute);

  private id = Number(this.route.snapshot.paramMap.get('id'));

  usuario = signal<User | null>(null);
  cargando = signal(true);
  guardando = signal(false);
  guardado = signal(false);
  correoEnUso = signal(false);
  errorGeneral = signal(false);

  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(5), Validators.pattern(/\S/)]],
    correo: ['', [Validators.required, correoInstitucional]],
  });

  private cambios = toSignal(this.form.valueChanges.pipe(startWith(null)));

  // El botón "Guardar cambios" solo se activa si algo cambió respecto a lo guardado
  hayCambios = computed(() => {
    this.cambios();
    const u = this.usuario();
    if (!u) return false;
    const v = this.form.getRawValue();
    return v.nombre.trim() !== u.nombre || v.correo.trim().toLowerCase() !== u.correo;
  });

  rolVisible = computed(() => {
    const u = this.usuario();
    return u ? ROLE_LABELS[u.rol] : '';
  });

  codigo = computed(() => {
    const u = this.usuario();
    return u ? `HE-01-${String(u.id).padStart(3, '0')}` : '';
  });

  iniciales = computed(() =>
    (this.usuario()?.nombre ?? '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join(''),
  );

  constructor() {
    this.api.obtener(this.id).subscribe({
      next: (u) => {
        this.usuario.set(u);
        this.form.reset({ nombre: u.nombre, correo: u.correo });
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false), // usuario null → se muestra "no encontrado"
    });

    this.form.controls.correo.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.correoEnUso.set(false));

    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.guardado.set(false));
  }

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

  descartar(): void {
    const u = this.usuario();
    if (!u) return;
    this.form.reset({ nombre: u.nombre, correo: u.correo });
    this.errorGeneral.set(false);
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (!this.hayCambios()) return;

    const { nombre, correo } = this.form.getRawValue();
    this.guardando.set(true);
    this.errorGeneral.set(false);

    this.api.actualizar(this.id, { nombre, correo }).subscribe({
      next: (u) => {
        this.usuario.set(u);
        this.form.reset({ nombre: u.nombre, correo: u.correo });
        this.guardando.set(false);
        this.guardado.set(true); // después del reset, para que no se borre el aviso
      },
      error: (err: Error) => {
        this.guardando.set(false);
        if (err.message === 'CORREO_EN_USO') this.correoEnUso.set(true);
        else this.errorGeneral.set(true);
      },
    });
  }
}