import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from '../../auth/auth';
import { ROLE_LABELS } from '../../../shared/models/user';
import { Icon } from '../../../shared/ui/icon/icon';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private auth = inject(Auth);
  private router = inject(Router);

  user = this.auth.user;

  // route = null: la pantalla es de otra épica y aún no existe
  nav = [
    { label: 'Inicio', icon: 'dashboard', route: null },
    { label: 'Usuarios', icon: 'users', route: '/usuarios' },
    { label: 'Roles y permisos', icon: 'shield', route: null },
    { label: 'Auditoría', icon: 'scroll', route: null },
  ];

  iniciales = computed(() => {
    const nombre = this.user()?.nombre ?? '';
    return nombre
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('');
  });

  rolVisible = computed(() => {
    const rol = this.user()?.rol;
    return rol ? ROLE_LABELS[rol] : '';
  });

  salir(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}