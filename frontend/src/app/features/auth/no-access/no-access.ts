import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth } from '../../../core/auth/auth';
import { homeForRole } from '../../../core/auth/role-home';
import { ROLE_LABELS } from '../../../shared/models/user';
import { Icon } from '../../../shared/ui/icon/icon';

// Pantalla sin frame en Figma: diseñada con el estilo de las demás.
@Component({
  selector: 'app-no-access',
  imports: [RouterLink, Icon],
  templateUrl: './no-access.html',
  styleUrl: './no-access.scss',
})
export class NoAccess {
  private user = inject(Auth).user;

  rol = computed(() => {
    const u = this.user();
    return u ? ROLE_LABELS[u.rol] : '';
  });

  inicio = computed(() => {
    const u = this.user();
    return u ? homeForRole(u.rol) : '/login';
  });
}
