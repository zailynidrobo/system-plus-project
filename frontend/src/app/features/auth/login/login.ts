import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth } from '../../../core/auth/auth';
import { Icon } from '../../../shared/ui/icon/icon';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, Icon],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private fb = inject(FormBuilder);
  private auth = inject(Auth);
  private router = inject(Router);

  form = this.fb.nonNullable.group({
    correo: ['', [Validators.required, Validators.email]],
    contrasena: ['', [Validators.required]],
    recordar: [true],
  });

  cargando = signal(false);
  credencialesInvalidas = signal(false);
  verContrasena = signal(false);

  constructor() {
    // Al volver a escribir, se quita el error de credenciales
    this.form.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.credencialesInvalidas.set(false));
  }

  mensajeCorreo(): string | null {
    if (this.credencialesInvalidas()) {
      return 'Revisa el correo o la contraseña e inténtalo nuevamente.';
    }
    const c = this.form.controls.correo;
    if (!c.touched) return null;
    if (c.hasError('required')) return 'Ingresa tu correo institucional.';
    if (c.hasError('email')) return 'Ingresa un correo válido.';
    return null;
  }

  mensajeContrasena(): string | null {
    const c = this.form.controls.contrasena;
    if (c.touched && c.hasError('required')) return 'Ingresa tu contraseña.';
    return null;
  }

  errorContrasena(): boolean {
    return this.credencialesInvalidas() || !!this.mensajeContrasena();
  }

  enviar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { correo, contrasena, recordar } = this.form.getRawValue();
    this.cargando.set(true);

    this.auth.login({ correo, contrasena }, recordar).subscribe({
      next: () => this.router.navigate(['/usuarios']),
      error: () => {
        // Mensaje genérico a propósito: no revelar cuál dato falló (HU-05 CA-02)
        this.credencialesInvalidas.set(true);
        this.cargando.set(false);
      },
    });
  }
}