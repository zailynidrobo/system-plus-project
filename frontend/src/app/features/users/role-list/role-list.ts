import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ROLE_LABELS, Role, User } from '../../../shared/models/user';
import { Icon } from '../../../shared/ui/icon/icon';
import { UserApi } from '../user-api';

const POR_PAGINA = 8;

// Mismos íconos que las opciones de "Asignar rol" (Figma HE-01-HU-04)
const ICONO_ROL: Record<Role, string> = {
  ADMINISTRADOR: 'shield-check',
  COORDINADOR: 'clipboard-check',
  DOCENTE: 'book-open',
  DOCENTE_AUTORIZADO: 'badge-check',
};

// "Roles y permisos" (menú del Administrador): buscar al usuario y abrir "Asignar rol".
// Esta lista no tiene frame en Figma; sigue el estilo del listado de usuarios.
@Component({
  selector: 'app-role-list',
  imports: [RouterLink, Icon],
  templateUrl: './role-list.html',
})
export class RoleList {
  private api = inject(UserApi);

  labels = ROLE_LABELS;
  roles = (Object.keys(ROLE_LABELS) as Role[]).map((r) => ({ value: r, label: ROLE_LABELS[r], icono: ICONO_ROL[r] }));

  busqueda = signal('');
  rol = signal<Role | 'TODOS'>('TODOS');
  pagina = signal(1);

  usuarios = signal<User[]>([]);
  total = signal(0);
  conteo = signal<Record<Role, number> | null>(null);
  cargando = signal(true);

  totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / POR_PAGINA)));
  desde = computed(() => (this.total() === 0 ? 0 : (this.pagina() - 1) * POR_PAGINA + 1));
  hasta = computed(() => Math.min(this.pagina() * POR_PAGINA, this.total()));

  constructor() {
    this.cargar();
    this.api.conteoPorRol().subscribe((c) => this.conteo.set(c));
  }

  cargar(): void {
    this.cargando.set(true);
    this.api
      .listar({ busqueda: this.busqueda(), rol: this.rol(), estado: 'TODOS', pagina: this.pagina(), porPagina: POR_PAGINA })
      .subscribe((res) => {
        this.usuarios.set(res.items);
        this.total.set(res.total);
        this.cargando.set(false);
      });
  }

  buscar(valor: string): void {
    this.busqueda.set(valor);
    this.pagina.set(1);
    this.cargar();
  }

  filtrarRol(valor: string): void {
    this.rol.set(valor as Role | 'TODOS');
    this.pagina.set(1);
    this.cargar();
  }

  irA(p: number): void {
    if (p < 1 || p > this.totalPaginas()) return;
    this.pagina.set(p);
    this.cargar();
  }

  iniciales(nombre: string): string {
    const partes = nombre.split(' ').filter(Boolean);
    return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
  }
}
