import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Role, ROLE_LABELS, User } from '../../../shared/models/user';
import { Icon } from '../../../shared/ui/icon/icon';
import { UserApi } from '../user-api';

interface InfoRol {
  value: Role;
  icono: string;
  descripcion: string;
  permisos: string[];
}

// Las descripciones salen del Figma. Los permisos del Coordinador también;
// los de los otros roles son provisionales hasta confirmarlos con el equipo.
const ROLES: InfoRol[] = [
  {
    value: 'ADMINISTRADOR',
    icono: 'shield-check',
    descripcion: 'Gestión total de usuarios, configuración y auditoría.',
    permisos: ['Gestionar usuarios y roles', 'Configurar el sistema', 'Consultar auditoría'],
  },
  {
    value: 'COORDINADOR',
    icono: 'clipboard-check',
    descripcion: 'Coordina programas, docentes, horarios y seguimiento.',
    permisos: [
      'Gestionar oferta académica',
      'Coordinar cargas docentes',
      'Consultar reportes',
      'Supervisar asistencia',
    ],
  },
  {
    value: 'DOCENTE',
    icono: 'book-open',
    descripcion: 'Gestiona cursos, asistencia y resultados de sus grupos.',
    permisos: ['Consultar guías base', 'Crear versiones personalizadas', 'Gestionar sus grupos'],
  },
  {
    value: 'DOCENTE_AUTORIZADO',
    icono: 'badge-check',
    descripcion: 'Funciones docentes con autorizaciones académicas ampliadas.',
    permisos: [
      'Todas las funciones de Docente',
      'Revisar y validar cambios de otros docentes',
    ],
  },
];

@Component({
  selector: 'app-user-role',
  imports: [RouterLink, Icon],
  templateUrl: './user-role.html',
  styleUrl: './user-role.scss',
})
export class UserRole {
  private api = inject(UserApi);
  private route = inject(ActivatedRoute);

  private id = Number(this.route.snapshot.paramMap.get('id'));

  roles = ROLES;
  labels = ROLE_LABELS;

  usuario = signal<User | null>(null);
  seleccionado = signal<Role | null>(null);
  cargando = signal(true);
  guardando = signal(false);
  guardado = signal(false);
  error = signal(false);

  hayCambio = computed(() => {
    const u = this.usuario();
    const s = this.seleccionado();
    return !!u && !!s && s !== u.rol;
  });

  permisos = computed(() => ROLES.find((r) => r.value === this.seleccionado())?.permisos ?? []);

  iniciales = computed(() =>
    (this.usuario()?.nombre ?? '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join(''),
  );

  constructor() {
    this.api.obtener(this.id).subscribe({
      next: (u) => {
        this.usuario.set(u);
        this.seleccionado.set(u.rol);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false), // usuario null → se muestra "no encontrado"
    });
  }

  seleccionar(rol: Role): void {
    this.seleccionado.set(rol);
    this.guardado.set(false);
    this.error.set(false);
  }

  guardar(): void {
    const rol = this.seleccionado();
    if (!rol || !this.hayCambio()) return;

    this.guardando.set(true);
    this.error.set(false);

    this.api.cambiarRol(this.id, rol).subscribe({
      next: (u) => {
        this.usuario.set(u);
        this.seleccionado.set(u.rol);
        this.guardando.set(false);
        this.guardado.set(true);
      },
      error: () => {
        this.guardando.set(false);
        this.error.set(true);
      },
    });
  }
}