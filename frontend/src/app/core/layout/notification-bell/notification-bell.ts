import { Component, InjectionToken, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { EMPTY, catchError, of, switchMap, timer } from 'rxjs';
import { NotificationApi } from '../../../features/suggestions/notification-api';
import { SuggestionApi } from '../../../features/suggestions/suggestion-api';
import { Campana, GravedadNotificacion, Notificacion, TipoNotificacion } from '../../../shared/models/notification';
import { ROLES_DOCENTES } from '../../../shared/models/user';
import { Icon } from '../../../shared/ui/icon/icon';
import { haceCuanto } from '../../../shared/utils/fechas';
import { Auth } from '../../auth/auth';

/** Cada cuánto se vuelve a consultar la campana (ms). Las pruebas lo cambian. */
export const INTERVALO_CAMPANA = new InjectionToken<number>('INTERVALO_CAMPANA', {
  providedIn: 'root',
  factory: () => 60_000,
});

/** Cuántas alertas muestra el panel; el resto se ve con "Ver todas". */
export const MAXIMO_EN_PANEL = 10;

const TONO: Record<GravedadNotificacion, string> = {
  danger: 'ui-tile--danger',
  warning: 'ui-tile--warn',
  success: 'ui-tile--ok',
  info: '',
};

const ICONO: Record<TipoNotificacion, string> = {
  SUGGESTION_OVERDUE: 'triangle-alert',
  SUGGESTION_DUE_SOON: 'clock',
  SUGGESTION_PENDING: 'message-square',
  SUGGESTION_APPROVED: 'circle-check',
  SUGGESTION_REJECTED: 'circle-x',
  GUIDE_NEW_VERSION: 'file-text',
};

const VACIA: Campana = { unread: 0, items: [] };

/**
 * Campana del encabezado (HE-05). No tiene frame en Figma: usa las clases ui-* del resto de la app.
 *  · Se carga al iniciar la sesión (el contador aparece sin abrirla), cada 60 s y cuando se decide
 *    una sugerencia (`SuggestionApi.decisiones`).
 *  · Coordinador: alertas de pendientes; docente: notificaciones, que se marcan como leídas al abrirlas.
 */
@Component({
  selector: 'app-notification-bell',
  imports: [RouterLink, Icon],
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.scss',
  host: { '(document:keydown.escape)': 'abierto.set(false)' },
})
export class NotificationBell {
  private api = inject(NotificationApi);
  private sugerencias = inject(SuggestionApi);
  private auth = inject(Auth);
  private router = inject(Router);
  private intervalo = inject(INTERVALO_CAMPANA);

  abierto = signal(false);
  campana = signal<Campana>(VACIA);
  private refrescos = signal(0);

  readonly tono = TONO;
  readonly icono = ICONO;
  readonly hace = haceCuanto;

  esCoordinador = computed(() => this.auth.user()?.rol === 'COORDINADOR');
  esDocente = computed(() => {
    const rol = this.auth.user()?.rol;
    return !!rol && ROLES_DOCENTES.includes(rol);
  });
  visibles = computed(() => this.campana().items.slice(0, MAXIMO_EN_PANEL));
  contador = computed(() => (this.campana().unread > 99 ? '99+' : String(this.campana().unread)));
  verTodas = computed(() => (this.esCoordinador() ? '/sugerencias' : this.esDocente() ? '/mis-sugerencias' : null));
  etiqueta = computed(() => {
    const n = this.campana().unread;
    if (!n) return 'Notificaciones';
    const que = this.esCoordinador() ? (n === 1 ? 'sugerencia pendiente' : 'sugerencias pendientes') : 'sin leer';
    return `Notificaciones: ${n} ${que}`;
  });

  constructor() {
    toObservable(
      computed(() => ({
        usuario: this.auth.user()?.id ?? null,
        decisiones: this.sugerencias.decisiones(),
        refrescos: this.refrescos(),
      })),
    )
      .pipe(
        switchMap(({ usuario }) =>
          usuario === null
            ? of(VACIA)
            : timer(0, this.intervalo).pipe(switchMap(() => this.api.campana().pipe(catchError(() => EMPTY)))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((c) => this.campana.set(c));
  }

  alternar(): void {
    const abrir = !this.abierto();
    this.abierto.set(abrir);
    if (abrir) this.refrescos.update((n) => n + 1);
  }

  /** Abre la guía o la sugerencia de la alerta; la del docente queda leída. */
  abrir(n: Notificacion): void {
    this.abierto.set(false);
    if (this.esDocente() && !n.read) {
      this.marcarLocal((item) => item.id === n.id);
      this.api.marcarLeida(n.id).subscribe({ error: () => this.refrescos.update((x) => x + 1) });
    }
    const destino = this.destino(n);
    if (destino) void this.router.navigate(destino);
  }

  marcarTodas(): void {
    this.marcarLocal(() => true, true);
    this.api.marcarTodasLeidas().subscribe({ error: () => this.refrescos.update((x) => x + 1) });
  }

  private destino(n: Notificacion): (string | number)[] | null {
    if (this.esCoordinador()) return n.suggestionId ? ['/sugerencias', n.suggestionId] : null;
    if (n.type === 'GUIDE_NEW_VERSION' && n.guide) return ['/mis-modulos/guias', n.guide.id];
    return n.suggestionId ? ['/mis-sugerencias', n.suggestionId] : null;
  }

  private marcarLocal(cual: (n: Notificacion) => boolean, todas = false): void {
    this.campana.update((c) => {
      const marcadas = c.items.filter((n) => cual(n) && !n.read).length;
      return {
        unread: todas ? 0 : Math.max(0, c.unread - marcadas),
        items: c.items.map((n) => (cual(n) ? { ...n, read: true } : n)),
      };
    });
  }
}
