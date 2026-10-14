import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ROLE_LABELS, UsuarioCreado } from '../../../shared/models/user';
import { Icon } from '../../../shared/ui/icon/icon';

interface EstadoRegistro {
  usuario?: UsuarioCreado;
  creadoPor?: string;
  fecha?: number;
}

@Component({
  selector: 'app-user-created',
  imports: [RouterLink, Icon],
  templateUrl: './user-created.html',
  styleUrl: './user-created.scss',
})
export class UserCreated {
  private router = inject(Router);

  private estado = (history.state ?? {}) as EstadoRegistro;
  usuario = this.estado.usuario;
  creadoPor = this.estado.creadoPor ?? '';
  /** Solo llega cuando el backend la generó; se muestra una vez para entregarla al usuario. */
  contrasenaTemporal = this.usuario?.contrasenaTemporal ?? '';
  rol = this.usuario ? ROLE_LABELS[this.usuario.rol] : '';

  codigo = this.usuario ? `HE-01-${String(this.usuario.id).padStart(3, '0')}` : '';
  hora = new Date(this.estado.fecha ?? Date.now()).toLocaleTimeString('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
  });

  iniciales = (this.usuario?.nombre ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

  constructor() {
    // Si recargan la página se pierde el estado: volvemos al listado
    if (!this.usuario) this.router.navigate(['/usuarios']);
  }
}