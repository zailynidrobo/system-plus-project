import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Auth } from '../../../core/auth/auth';
import { homeForRole } from '../../../core/auth/role-home';
import { ApiError } from '../../../shared/models/api-error';
import { User } from '../../../shared/models/user';
import { Icon } from '../../../shared/ui/icon/icon';

/** Mínimo y máximo de la contraseña nueva (los mismos que valida la API). */
export const CONTRASENA_MIN = 8;
export const CONTRASENA_MAX = 128;

/** Avisos de la tarjeta de inicio de sesión. */
export type AvisoLogin =
  | 'CREDENCIALES_INVALIDAS'
  | 'SERVICIO_NO_DISPONIBLE'
  | 'SIN_ROL'
  | 'PERFIL_INCOMPLETO'
  | 'SESION_VENCIDA'
  | 'CONTRASENA_REPETIDA';

const AVISOS_CONOCIDOS: readonly string[] = [
  'CREDENCIALES_INVALIDAS',
  'SERVICIO_NO_DISPONIBLE',
  'SIN_ROL',
  'PERFIL_INCOMPLETO',
  'CONTRASENA_REPETIDA',
];

/** Avisos que se muestran sin salir del paso "Crea tu contraseña". */
const AVISOS_DEL_CAMBIO: readonly string[] = ['CONTRASENA_REPETIDA', 'SERVICIO_NO_DISPONIBLE'];

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
  private route = inject(ActivatedRoute);

  form = this.fb.nonNullable.group({
    correo: ['', [Validators.required, Validators.email]],
    contrasena: ['', [Validators.required]],
    // Desmarcado por defecto: en equipos compartidos la sesión no debe quedar abierta
    recordar: [false],
  });

  /** Primer ingreso: la contraseña temporal se cambia por una definitiva. */
  formNueva = this.fb.nonNullable.group({
    nueva: [
      '',
      [
        Validators.required,
        Validators.minLength(CONTRASENA_MIN),
        Validators.maxLength(CONTRASENA_MAX),
      ],
    ],
    confirmar: ['', [Validators.required]],
  });

  paso = signal<'credenciales' | 'contrasena-nueva'>('credenciales');
  cargando = signal(false);
  aviso = signal<AvisoLogin | null>(
    this.route.snapshot.queryParamMap.get('motivo') === 'sesion-vencida' ? 'SESION_VENCIDA' : null,
  );
  verContrasena = signal(false);
  verNueva = signal(false);
  verAyudaContrasena = signal(false);
  readonly contrasenaMin = CONTRASENA_MIN;

  // Con Keycloak no hay formulario: la pantalla redirige al inicio de sesión de Keycloak
  externo = this.auth.loginExterno;
  problema = this.auth.problemaLogin();

  constructor() {
    // Al volver a escribir, se quita el aviso anterior
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.aviso.set(null));
    this.formNueva.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.aviso.set(null));

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

  credencialesInvalidas(): boolean {
    return this.aviso() === 'CREDENCIALES_INVALIDAS';
  }

  mensajeCorreo(): string | null {
    const c = this.form.controls.correo;
    if (!c.touched) return null;
    if (c.hasError('required')) return 'Ingresa tu correo electrónico.';
    if (c.hasError('email')) return 'Ingresa un correo válido.';
    return null;
  }

  mensajeContrasena(): string | null {
    const c = this.form.controls.contrasena;
    if (c.touched && c.hasError('required')) return 'Ingresa tu contraseña.';
    return null;
  }

  errorCorreo(): boolean {
    return this.credencialesInvalidas() || !!this.mensajeCorreo();
  }

  errorContrasena(): boolean {
    return this.credencialesInvalidas() || !!this.mensajeContrasena();
  }

  mensajeNueva(): string | null {
    const c = this.formNueva.controls.nueva;
    if (!c.touched) return null;
    if (c.hasError('required')) return 'Escribe tu nueva contraseña.';
    if (c.hasError('minlength')) return `Usa al menos ${CONTRASENA_MIN} caracteres.`;
    if (c.hasError('maxlength')) return `Usa como máximo ${CONTRASENA_MAX} caracteres.`;
    return null;
  }

  mensajeConfirmar(): string | null {
    const c = this.formNueva.controls.confirmar;
    if (!c.touched) return null;
    if (c.hasError('required')) return 'Vuelve a escribir la nueva contraseña.';
    if (c.value !== this.formNueva.controls.nueva.value) return 'Las contraseñas no coinciden.';
    return null;
  }

  enviar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { correo, contrasena, recordar } = this.form.getRawValue();
    this.cargando.set(true);

    this.auth.login({ correo, contrasena }, recordar).subscribe({
      next: (usuario) => this.entrar(usuario),
      error: (error: unknown) => {
        this.cargando.set(false);
        if (error instanceof ApiError && error.code === 'CAMBIO_CONTRASENA_REQUERIDO') {
          this.paso.set('contrasena-nueva');
          return;
        }
        this.mostrarAviso(error);
      },
    });
  }

  enviarNueva(): void {
    this.formNueva.markAllAsTouched();
    if (this.formNueva.invalid || this.mensajeConfirmar()) return;

    const { correo, contrasena, recordar } = this.form.getRawValue();
    this.cargando.set(true);

    this.auth
      .cambiarContrasenaTemporal(
        {
          correo,
          contrasenaTemporal: contrasena,
          contrasenaNueva: this.formNueva.controls.nueva.value,
        },
        recordar,
      )
      .subscribe({
        next: (usuario) => this.entrar(usuario),
        error: (error: unknown) => {
          this.cargando.set(false);
          // Cualquier otro problema (la temporal ya no sirve, la cuenta está incompleta...) se
          // explica en el inicio de sesión, para no dejar a la persona atrapada en este paso
          const code = error instanceof ApiError ? error.code : '';
          if (!AVISOS_DEL_CAMBIO.includes(code)) this.volver();
          this.mostrarAviso(error);
        },
      });
  }

  volver(): void {
    this.paso.set('credenciales');
    this.formNueva.reset();
    this.form.controls.contrasena.reset();
  }

  private entrar(usuario: User): void {
    void this.router.navigateByUrl(homeForRole(usuario.rol));
  }

  private mostrarAviso(error: unknown): void {
    const code = error instanceof ApiError ? error.code : '';
    // Mensaje genérico a propósito: no revelar cuál dato falló (HU-05 CA-02)
    this.aviso.set(
      AVISOS_CONOCIDOS.includes(code) ? (code as AvisoLogin) : 'CREDENCIALES_INVALIDAS',
    );
  }
}
