import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from './auth';
import { TokenStorage } from './token-storage';

/** Tiempo sin uso tras el cual se cierra la sesión (definido con el cliente). */
export const INACTIVIDAD_MAX_MS = 30 * 60 * 1000;
const REVISAR_CADA_MS = 30 * 1000;
const EVENTOS = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove'] as const;

/**
 * Cierra la sesión tras 30 minutos sin actividad, solo si el usuario NO marcó
 * "Mantener sesión iniciada". Quien la marca (por ejemplo, quien usa el mismo equipo
 * todo el día) conserva la sesión. La campana consulta la API cada cierto tiempo, por
 * eso la inactividad se mide en el navegador y no por las peticiones.
 */
@Injectable({ providedIn: 'root' })
export class Inactividad {
  private auth = inject(Auth);
  private storage = inject(TokenStorage);
  private router = inject(Router);

  private ultimaActividad = Date.now();
  private reloj: ReturnType<typeof setInterval> | null = null;
  private readonly marcar = () => (this.ultimaActividad = Date.now());

  iniciar(): void {
    if (this.reloj) return;
    this.ultimaActividad = Date.now();
    for (const evento of EVENTOS) document.addEventListener(evento, this.marcar, { passive: true });
    this.reloj = setInterval(() => this.revisar(), REVISAR_CADA_MS);
  }

  detener(): void {
    for (const evento of EVENTOS) document.removeEventListener(evento, this.marcar);
    if (this.reloj) clearInterval(this.reloj);
    this.reloj = null;
  }

  /** Devuelve true si cerró la sesión. */
  revisar(ahora = Date.now()): boolean {
    if (!this.auth.user() || this.storage.esPersistente()) return false;
    if (ahora - this.ultimaActividad < INACTIVIDAD_MAX_MS) return false;
    this.detener();
    this.auth.logout();
    void this.router.navigate(['/login'], { queryParams: { motivo: 'sesion-vencida' } });
    return true;
  }
}
