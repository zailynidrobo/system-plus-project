import { Routes } from '@angular/router';
import { Login } from './features/auth/login/login';
import { NoAccess } from './features/auth/no-access/no-access';
import { UserList } from './features/users/user-list/user-list';
import { UserForm } from './features/users/user-form/user-form';
import { UserCreated } from './features/users/user-created/user-created';
import { UserEdit } from './features/users/user-edit/user-edit';
import { UserDeactivate } from './features/users/user-deactivate/user-deactivate';
import { UserRole } from './features/users/user-role/user-role';
import { Shell } from './core/layout/shell/shell';
import { ComingSoon } from './core/layout/coming-soon/coming-soon';
import { authGuard } from './core/guards/auth-guard';
import { roleGuard } from './core/guards/role-guard';
import { guestGuard, redirectToHome } from './core/guards/guest-guard';
import { ROLES_DOCENTES, Role } from './shared/models/user';

// data.roles: quién puede entrar · data.titulo: miga de pan del encabezado
const usuarios = { roles: ['ADMINISTRADOR'] as Role[], titulo: 'Gestión de usuarios' };

export const routes: Routes = [
  { path: 'login', component: Login, canActivate: [guestGuard] },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      // HE-01 · Administrador
      { path: 'usuarios', component: UserList, canActivate: [roleGuard], data: usuarios },
      { path: 'usuarios/nuevo', component: UserForm, canActivate: [roleGuard], data: usuarios },
      { path: 'usuarios/registro-exitoso', component: UserCreated, canActivate: [roleGuard], data: usuarios },
      { path: 'usuarios/:id/editar', component: UserEdit, canActivate: [roleGuard], data: usuarios },
      { path: 'usuarios/:id/desactivar', component: UserDeactivate, canActivate: [roleGuard], data: usuarios },
      { path: 'usuarios/:id/rol', component: UserRole, canActivate: [roleGuard], data: usuarios },

      // Inicio del Coordinador (HE-02) y del Docente (HE-04): se completan en las fases 1 y 3
      {
        path: 'modulos',
        component: ComingSoon,
        canActivate: [roleGuard],
        data: { roles: ['COORDINADOR'], titulo: 'Programa académico' },
      },
      {
        path: 'mis-modulos',
        component: ComingSoon,
        canActivate: [roleGuard],
        data: { roles: ROLES_DOCENTES, titulo: 'Guías base' },
      },

      { path: 'sin-acceso', component: NoAccess, data: { titulo: 'Sin acceso' } },
      { path: '', pathMatch: 'full', redirectTo: redirectToHome },
    ],
  },
  { path: '**', redirectTo: '' },
];
