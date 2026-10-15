import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRouteSnapshot,
  NavigationEnd,
  NavigationStart,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, map, of, startWith, switchMap } from 'rxjs';
import { Auth } from '../../auth/auth';
import { MockDb } from '../../mock/mock-db';
import { Miga } from '../miga';
import { ROLES_DOCENTES, ROLE_LABELS } from '../../../shared/models/user';
import { Icon } from '../../../shared/ui/icon/icon';
import { TeacherApi } from '../../../features/teacher-space/teacher-api';
import { SuggestionApi } from '../../../features/suggestions/suggestion-api';
import { navPara } from './nav';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  host: { '(document:keydown.escape)': 'menuAbierto.set(false)' },
})
export class Shell {
  private auth = inject(Auth);
  private router = inject(Router);
  private teacherApi = inject(TeacherApi);
  private programa = inject(MockDb).programa;
  private miga = inject(Miga);
  private suggestionApi = inject(SuggestionApi);

  user = this.auth.user;
  menuAbierto = signal(false);

  nav = computed(() => {
    const rol = this.user()?.rol;
    return rol ? navPara(rol) : null;
  });

  esDocente = computed(() => {
    const rol = this.user()?.rol;
    return !!rol && ROLES_DOCENTES.includes(rol);
  });

  // Recuadro "MÓDULOS ASIGNADOS" del docente
  private modulosAsignados = toSignal(
    toObservable(this.esDocente).pipe(
      switchMap((docente) => (docente ? this.teacherApi.misModulos() : of([]))),
    ),
    { initialValue: [] },
  );

  recuadro = computed(() => {
    switch (this.nav()?.recuadro) {
      case 'programa':
        return { titulo: 'Programa activo', texto: `${this.programa.name} · ${this.programa.campus}` };
      case 'modulos': {
        const nombres = this.modulosAsignados().map((m) => m.name);
        return { titulo: 'Módulos asignados', texto: nombres.join(' · ') || 'Sin módulos asignados' };
      }
      default:
        return { titulo: 'Entorno seguro', texto: 'Sesión cifrada y persistente durante la jornada institucional.' };
    }
  });

  // Miga de pan: data.titulo y data.subtitulo de la ruta más profunda.
  // Una pantalla puede cambiar el último nivel con el servicio Miga.
  private datosRuta = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      startWith(null),
      map(() => this.leerMiga()),
    ),
    { initialValue: { titulo: '', subtitulo: null } },
  );

  // Contador "Sugerencias" del coordinador: se actualiza al navegar y al decidir una sugerencia
  pendientesSugerencias = toSignal(
    toObservable(computed(() => ({ ruta: this.datosRuta(), decisiones: this.suggestionApi.decisiones(), rol: this.user()?.rol }))).pipe(
      switchMap(({ rol }) => (rol === 'COORDINADOR' ? this.suggestionApi.resumen().pipe(map((r) => r.pendientes)) : of(0))),
    ),
    { initialValue: 0 },
  );

  titulo = computed(() => this.datosRuta().titulo);
  subtitulo = computed(() => this.miga.detalle() ?? this.datosRuta().subtitulo);

  constructor() {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationStart), takeUntilDestroyed())
      .subscribe(() => this.miga.detalle.set(null));
  }

  // Primera y última palabra del nombre, como en Figma: Julián Andrés Ospina → JO
  iniciales = computed(() => {
    const partes = (this.user()?.nombre ?? '').split(' ').filter(Boolean);
    if (partes.length === 0) return '';
    const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
    return (partes[0][0] + ultima).toUpperCase();
  });

  rolVisible = computed(() => {
    const rol = this.user()?.rol;
    return rol ? ROLE_LABELS[rol] : '';
  });

  salir(): void {
    this.menuAbierto.set(false);
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  private leerMiga(): { titulo: string; subtitulo: string | null } {
    let ruta: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let titulo = '';
    let subtitulo: string | null = null;
    while (ruta) {
      titulo = (ruta.data['titulo'] as string | undefined) ?? titulo;
      subtitulo = (ruta.data['subtitulo'] as string | undefined) ?? subtitulo;
      ruta = ruta.firstChild;
    }
    return { titulo, subtitulo };
  }
}
