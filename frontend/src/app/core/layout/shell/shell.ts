import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, map, of, startWith, switchMap } from 'rxjs';
import { Auth } from '../../auth/auth';
import { MockDb } from '../../mock/mock-db';
import { ROLES_DOCENTES, ROLE_LABELS } from '../../../shared/models/user';
import { Icon } from '../../../shared/ui/icon/icon';
import { TeacherApi } from '../../../features/teacher-space/teacher-api';
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

  // Miga de pan: el título de la ruta más profunda (data.titulo)
  titulo = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      startWith(null),
      map(() => this.leerTitulo()),
    ),
    { initialValue: '' },
  );

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

  private leerTitulo(): string {
    let ruta: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let titulo = '';
    while (ruta) {
      titulo = (ruta.data['titulo'] as string | undefined) ?? titulo;
      ruta = ruta.firstChild;
    }
    return titulo;
  }
}
