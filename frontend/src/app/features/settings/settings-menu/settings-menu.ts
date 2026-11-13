import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Icon } from '../../../shared/ui/icon/icon';

/** Menú lateral de Configuración del sistema (HE-09). Solo lista secciones que existen. */
@Component({
  selector: 'app-settings-menu',
  imports: [Icon, RouterLink, RouterLinkActive],
  template: `
    <nav class="ui-card menu" aria-label="Secciones de configuración">
      @for (s of secciones; track s.ruta) {
        <a class="menu__item" [routerLink]="s.ruta" routerLinkActive="menu__item--activo" ariaCurrentWhenActive="page">
          <app-icon [name]="s.icono" [size]="15" /> {{ s.texto }}
        </a>
      }
    </nav>
  `,
  styleUrl: './settings-menu.scss',
})
export class SettingsMenu {
  readonly secciones = [
    { texto: 'Sugerencias', icono: 'message-square', ruta: '/configuracion/sugerencias' },
    { texto: 'Periodos de bloqueo', icono: 'lock', ruta: '/configuracion/periodos-bloqueo' },
  ];
}
