import { Component, computed, inject, signal } from '@angular/core';
import { Role, ROLE_LABELS, User } from '../../../shared/models/user';
import { Icon } from '../../../shared/ui/icon/icon';
import { ResumenUsuarios, UserApi } from '../user-api';
import { RouterLink } from '@angular/router';

const POR_PAGINA = 6;
type EstadoFiltro = 'TODOS' | 'ACTIVO' | 'DESACTIVADO';

@Component({
  selector: 'app-user-list',
  imports: [Icon, RouterLink],
  templateUrl: './user-list.html',
  styleUrl: './user-list.scss',
})
export class UserList {
  private api = inject(UserApi);

  labels = ROLE_LABELS;
  roles = (Object.keys(ROLE_LABELS) as Role[]).map((r) => ({ value: r, label: ROLE_LABELS[r] }));

  busqueda = signal('');
  rol = signal<Role | 'TODOS'>('TODOS');
  estado = signal<EstadoFiltro>('TODOS');
  pagina = signal(1);

  usuarios = signal<User[]>([]);
  total = signal(0);
  resumen = signal<ResumenUsuarios | null>(null);
  cargando = signal(true);

  totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / POR_PAGINA)));
  paginas = computed(() => Array.from({ length: this.totalPaginas() }, (_, i) => i + 1));
  desde = computed(() => (this.total() === 0 ? 0 : (this.pagina() - 1) * POR_PAGINA + 1));
  hasta = computed(() => Math.min(this.pagina() * POR_PAGINA, this.total()));

  porcentajeActivos = computed(() => {
    const r = this.resumen();
    if (!r || r.total === 0) return '0';
    return ((r.activos / r.total) * 100).toFixed(1).replace('.', ',');
  });

  constructor() {
    this.cargar();
    this.api.resumen().subscribe((r) => this.resumen.set(r));
  }

  cargar(): void {
    this.cargando.set(true);
    this.api
      .listar({
        busqueda: this.busqueda(),
        rol: this.rol(),
        estado: this.estado(),
        pagina: this.pagina(),
        porPagina: POR_PAGINA,
      })
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

  filtrarEstado(valor: string): void {
    this.estado.set(valor as EstadoFiltro);
    this.pagina.set(1);
    this.cargar();
  }

  irA(p: number): void {
    if (p < 1 || p > this.totalPaginas() || p === this.pagina()) return;
    this.pagina.set(p);
    this.cargar();
  }

  iniciales(nombre: string): string {
    return nombre
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('');
  }
}