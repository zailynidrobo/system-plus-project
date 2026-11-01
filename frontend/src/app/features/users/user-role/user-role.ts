import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Role, ROLE_LABELS, User } from '../../../shared/models/user';
import { Icon } from '../../../shared/ui/icon/icon';
import { Auth } from '../../../core/auth/auth';
import { UserApi } from '../user-api';
import { esMismoUsuario, mensajeDeError } from '../mismo-usuario';

interface InfoRol {
  value: Role;
  icono: string;
  descripcion: string;
  permisos: string[];
}

// Permisos que hoy tiene cada rol en el sistema.
const ROLES: InfoRol[] = [
  {
    value: 'ADMINISTRADOR',
    icono: 'shield-check',
    descripcion: 'Gestiona las cuentas de usuario y sus roles.',
    permisos: ['Registrar y editar usuarios', 'Desactivar usuarios', 'Asignar roles'],
  },
  {
    value: 'COORDINADOR',
    icono: 'clipboard-check',
    descripcion: 'Gestiona el programa académico y las guías base.',
    permisos: [
      'Gestionar módulos y competencias',
      'Crear, editar y publicar guías base',
      'Asignar docentes a los módulos',
      'Revisar las sugerencias de los docentes',
    ],
  },
  {
    value: 'DOCENTE',
    icono: 'book-open',
    descripcion: 'Trabaja con las guías de los módulos que tiene asignados.',
    permisos: ['Consultar guías base', 'Crear versiones personalizadas', 'Sugerir cambios a una guía base'],
  },
  {
    value: 'DOCENTE_AUTORIZADO',
    icono: 'badge-check',
    descripcion: 'Por ahora tiene los mismos permisos que el Docente.',
    permisos: ['Todas las funciones de Docente'],
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
  private auth = inject(Auth);
  private route = inject(ActivatedRoute);

  private id = Number(this.route.snapshot.paramMap.get('id'));

  roles = ROLES;
  labels = ROLE_LABELS;

  usuario = signal<User | null>(null);
  seleccionado = signal<Role | null>(null);
  cargando = signal(true);
  guardando = signal(false);
  guardado = signal(false);
  error = signal('');

  esUnoMismo = computed(() => esMismoUsuario(this.auth.user(), this.usuario()));

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
      error: () => this.cargando.set(false), // usuario null: se muestra "no encontrado"
    });
  }

  seleccionar(rol: Role): void {
    this.seleccionado.set(rol);
    this.guardado.set(false);
    this.error.set('');
  }

  guardar(): void {
    const rol = this.seleccionado();
    if (!rol || !this.hayCambio() || this.esUnoMismo()) return;

    this.guardando.set(true);
    this.error.set('');

    this.api.cambiarRol(this.id, rol).subscribe({
      next: (u) => {
        this.usuario.set(u);
        this.seleccionado.set(u.rol);
        this.guardando.set(false);
        this.guardado.set(true);
      },
      error: (e: unknown) => {
        this.guardando.set(false);
        this.error.set(mensajeDeError(e, 'No pudimos actualizar el rol. Inténtalo de nuevo en unos minutos.'));
      },
    });
  }
}