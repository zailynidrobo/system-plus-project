import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth } from '../../../core/auth/auth';
import { homeForRole } from '../../../core/auth/role-home';
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

  // Con Keycloak no hay formulario: la pantalla redirige al inicio de sesión institucional
  externo = this.auth.loginExterno;
  problema = this.auth.problemaLogin();

  constructor() {
    // Al volver a escribir, se quita el error de credenciales
    this.form.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.credencialesInvalidas.set(false));

    // Sin rol o sin servicio no se redirige sola: volvería a esta pantalla en bucle
    if (this.externo && !this.problema) this.irAKeycloak();
  }

  irAKeycloak(): void {
    this.cargando.set(true);
    // Keycloak pide las credenciales en su propia pantalla; estos valores no se usan
    this.auth.login({ correo: '', contrasena: '' }).subscribe();
  }

  cerrarSesion(): void {
    this.auth.logout();
  }

  reintentar(): void {
    window.location.reload();
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
      next: (usuario) => this.router.navigateByUrl(homeForRole(usuario.rol)),
      error: () => {
        // Mensaje genérico a propósito: no revelar cuál dato falló (HU-05 CA-02)
        this.credencialesInvalidas.set(true);
        this.cargando.set(false);
      },
    });
  }
}