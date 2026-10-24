import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { Auth } from '../../core/auth/auth';
import { navPara } from '../../core/layout/shell/nav';
import { ROLE_LABELS, Role } from '../../shared/models/user';
import { Icon } from '../../shared/ui/icon/icon';
import { GuideApi } from '../guides/guide-api';
import { SuggestionApi } from '../suggestions/suggestion-api';
import { TeacherApi } from '../teacher-space/teacher-api';
import { UserApi } from '../users/user-api';

/** Un número del resumen (tarjetas superiores). */
interface Indicador {
  titulo: string;
  valor: number;
  detalle: string;
  icono: string;
  tono?: 'ok' | 'warn';
}

/** Una tarea pendiente o en curso, con el enlace para atenderla. */
interface Tarea {
  texto: string;
  estado: 'Pendiente' | 'Propuesta' | 'Asignada' | 'Informativa';
  ruta: string;
}

interface Atajo {
  label: string;
  icon: string;
  ruta: string;
}

interface Resumen {
  indicadores: Indicador[];
  tareas: Tarea[];
}

// Acciones directas que se suman a las secciones del menú en "Atajos".
const ACCIONES: Record<Role, Atajo[]> = {
  ADMINISTRADOR: [{ label: 'Registrar usuario', icon: 'user-plus', ruta: '/usuarios/nuevo' }],
  COORDINADOR: [
    { label: 'Nueva guía base', icon: 'plus', ruta: '/guias/nueva' },
    { label: 'Nuevo módulo', icon: 'plus', ruta: '/modulos/nuevo' },
    { label: 'Configurar estructura', icon: 'sliders', ruta: '/guias/estructura' },
  ],
  DOCENTE: [],
  DOCENTE_AUTORIZADO: [],
};

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Inicio de cada rol: resumen, tareas pendientes y atajos a todo lo que el rol puede hacer. */
@Component({
  selector: 'app-home',
  imports: [RouterLink, Icon],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private auth = inject(Auth);
  private users = inject(UserApi);
  private guides = inject(GuideApi);
  private suggestions = inject(SuggestionApi);
  private teacher = inject(TeacherApi);

  user = this.auth.user;
  rol = computed(() => (this.user() ? ROLE_LABELS[this.user()!.rol] : ''));
  primerNombre = computed(() => this.user()?.nombre.split(' ')[0] ?? '');

  resumen = signal<Resumen | null>(null);
  error = signal(false);

  /** Secciones del menú del rol (sin Inicio ni las que aún no existen) + acciones directas. */
  atajos = computed<Atajo[]>(() => {
    const rol = this.user()?.rol;
    if (!rol) return [];
    const secciones = navPara(rol)
      .items.filter((i) => i.route && i.route !== '/inicio')
      .map((i) => ({ label: i.label, icon: i.icon, ruta: i.route! }));
    return [...secciones, ...ACCIONES[rol]];
  });

  constructor() {
    const rol = this.user()?.rol;
    const carga: Observable<Resumen> | null =
      rol === 'ADMINISTRADOR'
        ? this.resumenAdministrador()
        : rol === 'COORDINADOR'
          ? this.resumenCoordinador()
          : rol
            ? this.resumenDocente()
            : null;
    carga?.subscribe({
      next: (r) => this.resumen.set(r),
      error: () => this.error.set(true),
    });
  }

  private resumenAdministrador(): Observable<Resumen> {
    return this.users.resumen().pipe(
      map((u) => ({
        indicadores: [
          { titulo: 'Usuarios registrados', valor: u.total, detalle: 'en el directorio', icono: 'users' },
          { titulo: 'Activos', valor: u.activos, detalle: 'pueden ingresar', icono: 'user-check', tono: 'ok' as const },
          { titulo: 'Desactivados', valor: u.desactivados, detalle: 'sin acceso', icono: 'user-x', tono: 'warn' as const },
        ],
        tareas: u.desactivados
          ? [{ texto: `${plural(u.desactivados, 'usuario desactivado', 'usuarios desactivados')}: revisa si deben seguir sin acceso`, estado: 'Informativa' as const, ruta: '/usuarios' }]
          : [],
      })),
    );
  }

  private resumenCoordinador(): Observable<Resumen> {
    return forkJoin({
      guias: this.guides.resumen(),
      sugerencias: this.suggestions.resumen().pipe(catchError(() => of(null))),
    }).pipe(
      map(({ guias, sugerencias }) => {
        const pendientes = sugerencias?.pendientes ?? 0;
        const tareas: Tarea[] = [];
        if (pendientes) {
          tareas.push({ texto: `${plural(pendientes, 'sugerencia', 'sugerencias')} de docentes por revisar`, estado: 'Pendiente', ruta: '/sugerencias' });
        }
        if (guias.borradores) {
          tareas.push({ texto: `${plural(guias.borradores, 'guía en borrador', 'guías en borrador')} por publicar`, estado: 'Pendiente', ruta: '/guias' });
        }
        return {
          indicadores: [
            { titulo: 'Guías base', valor: guias.total, detalle: `en ${plural(guias.modulos, 'módulo', 'módulos')}`, icono: 'file-text' },
            { titulo: 'Publicadas', valor: guias.publicadas, detalle: 'visibles para docentes', icono: 'circle-check', tono: 'ok' as const },
            { titulo: 'Sugerencias pendientes', valor: pendientes, detalle: 'por revisar', icono: 'message-square', tono: 'warn' as const },
          ],
          tareas,
        };
      }),
    );
  }

  private resumenDocente(): Observable<Resumen> {
    return forkJoin({
      guias: this.teacher.guiasAsignadas({ busqueda: '', moduleId: null }),
      sugerencias: this.suggestions.misSugerencias().pipe(catchError(() => of([]))),
    }).pipe(
      map(({ guias, sugerencias }) => {
        const enRevision = sugerencias.filter((s) => s.status === 'Pendiente').length;
        const rechazadas = sugerencias.filter((s) => s.status === 'Rechazada').length;
        const sinVersion = guias.guias.filter((g) => g.misVersiones.length === 0).length;
        const tareas: Tarea[] = [];
        if (sinVersion) {
          tareas.push({ texto: `${plural(sinVersion, 'guía asignada', 'guías asignadas')} sin versión propia`, estado: 'Asignada', ruta: '/mis-modulos' });
        }
        if (enRevision) {
          tareas.push({ texto: `${plural(enRevision, 'sugerencia enviada', 'sugerencias enviadas')} en revisión por coordinación`, estado: 'Propuesta', ruta: '/mis-sugerencias' });
        }
        if (rechazadas) {
          tareas.push({ texto: `${plural(rechazadas, 'sugerencia rechazada', 'sugerencias rechazadas')} con retroalimentación para leer`, estado: 'Informativa', ruta: '/mis-sugerencias' });
        }
        return {
          indicadores: [
            { titulo: 'Guías disponibles', valor: guias.guias.length, detalle: 'para consultar', icono: 'book-open' },
            { titulo: 'Mis versiones', valor: guias.guias.reduce((n, g) => n + g.misVersiones.length, 0), detalle: 'adaptadas por ti', icono: 'folder', tono: 'ok' as const },
            { titulo: 'Sugerencias en revisión', valor: enRevision, detalle: 'esperando respuesta', icono: 'message-square', tono: 'warn' as const },
          ],
          tareas,
        };
      }),
    );
  }
}
