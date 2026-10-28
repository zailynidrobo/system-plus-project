import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { startWith } from 'rxjs';
import { EventoUsuario, ROLE_LABELS, User } from '../../../shared/models/user';
import { fechaCorta } from '../../../shared/utils/fechas';
import { Icon } from '../../../shared/ui/icon/icon';
import { UserApi } from '../user-api';
import { validarCorreo } from '../../../shared/utils/correo';
import { NOMBRE_COMPLETO } from '../nombre-completo';


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
    nombre: ['', [Validators.required, Validators.pattern(NOMBRE_COMPLETO)]],
    correo: ['', [Validators.required, validarCorreo]],
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

  iniciales = computed(() =>
    (this.usuario()?.nombre ?? '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join(''),
  );

  historial = signal<EventoUsuario[]>([]);

  creadoEl = computed(() => fechaCorta(this.usuario()?.creadoEn));

  constructor() {
    this.cargarHistorial();
    this.api.obtener(this.id).subscribe({
      next: (u) => {
        this.usuario.set(u);
        this.form.reset({ nombre: u.nombre, correo: u.correo });
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false), // usuario null -> se muestra "no encontrado"
    });

    this.form.controls.correo.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.correoEnUso.set(false));

    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.guardado.set(false));
  }

  mensajeNombre(): string | null {
    const c = this.form.controls.nombre;
    if (!c.touched || c.valid) return null;
    return c.hasError('required') ? 'Ingresa el nombre completo.' : 'Escribe nombre y apellido.';
  }

  mensajeCorreo(): string | null {
    if (this.correoEnUso()) return 'Este correo ya está registrado en el directorio.';
    const c = this.form.controls.correo;
    if (!c.touched || c.valid) return null;
    if (c.hasError('required')) return 'Ingresa el correo electrónico.';
    return 'Ingresa un correo válido, por ejemplo nombre@dominio.com.';
  }

  private cargarHistorial(): void {
    this.api.historial(this.id).subscribe({ next: (h) => this.historial.set(h), error: () => {} });
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
        this.cargarHistorial();
      },
      error: (err: Error) => {
        this.guardando.set(false);
        if (err.message === 'CORREO_EN_USO') this.correoEnUso.set(true);
        else this.errorGeneral.set(true);
      },
    });
  }
}