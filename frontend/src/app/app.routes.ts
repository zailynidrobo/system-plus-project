import { Routes } from '@angular/router';
import { Login } from './features/auth/login/login';
import { UserList } from './features/users/user-list/user-list';
import { UserForm } from './features/users/user-form/user-form';
import { UserCreated } from './features/users/user-created/user-created';
import { UserEdit } from './features/users/user-edit/user-edit';
import { UserDeactivate } from './features/users/user-deactivate/user-deactivate';
import { UserRole } from './features/users/user-role/user-role';
import { Shell } from './core/layout/shell/shell';
import { authGuard } from './core/guards/auth-guard';
import { roleGuard } from './core/guards/role-guard';

const soloAdmin = { roles: ['ADMINISTRADOR'] };

export const routes: Routes = [
  { path: 'login', component: Login },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: 'usuarios', component: UserList, canActivate: [roleGuard], data: soloAdmin },
      { path: 'usuarios/nuevo', component: UserForm, canActivate: [roleGuard], data: soloAdmin },
      { path: 'usuarios/registro-exitoso', component: UserCreated, canActivate: [roleGuard], data: soloAdmin },
      { path: 'usuarios/:id/editar', component: UserEdit, canActivate: [roleGuard], data: soloAdmin },
      { path: 'usuarios/:id/desactivar', component: UserDeactivate, canActivate: [roleGuard], data: soloAdmin },
      { path: 'usuarios/:id/rol', component: UserRole, canActivate: [roleGuard], data: soloAdmin },
      { path: '', pathMatch: 'full', redirectTo: 'usuarios' },
    ],
  },
  { path: '**', redirectTo: 'login' },
];