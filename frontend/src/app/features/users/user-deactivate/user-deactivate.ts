import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Auth } from '../../../core/auth/auth';
import { ROLE_LABELS, User } from '../../../shared/models/user';
import { Icon } from '../../../shared/ui/icon/icon';
import { UserApi } from '../user-api';

@Component({
  selector: 'app-user-deactivate',
  imports: [RouterLink, Icon],
  templateUrl: './user-deactivate.html',
  styleUrl: './user-deactivate.scss',
})
export class UserDeactivate {
  private api = inject(UserApi);
  private auth = inject(Auth);
  private route = inject(ActivatedRoute);

  private id = Number(this.route.snapshot.paramMap.get('id'));

  usuario = signal<User | null>(null);
  cargando = signal(true);
  procesando = signal(false);
  hecho = signal(false);
  error = signal(false);
  hora = signal(this.ahora());

  responsable = computed(() => this.auth.user()?.nombre ?? '');

  rolVisible = computed(() => {
    const u = this.usuario();
    return u ? ROLE_LABELS[u.rol] : '';
  });

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
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false), // usuario null → se muestra "no encontrado"
    });
  }

  confirmar(): void {
    this.procesando.set(true);
    this.error.set(false);

    this.api.desactivar(this.id).subscribe({
      next: (u) => {
        this.usuario.set(u);
        this.hora.set(this.ahora());
        this.hecho.set(true);
        this.procesando.set(false);
      },
      error: () => {
        this.procesando.set(false);
        this.error.set(true);
      },
    });
  }

  private ahora(): string {
    return new Date().toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  }
}