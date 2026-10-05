import { Routes } from '@angular/router';
import { Login } from './features/auth/login/login';
import { UserList } from './features/users/user-list/user-list';
import { Shell } from './core/layout/shell/shell';
import { authGuard } from './core/guards/auth-guard';
import { roleGuard } from './core/guards/role-guard';

export const routes: Routes = [
  { path: 'login', component: Login },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      {
        path: 'usuarios',
        component: UserList,
        canActivate: [roleGuard],
        data: { roles: ['ADMINISTRADOR'] },
      },
      { path: '', pathMatch: 'full', redirectTo: 'usuarios' },
    ],
  },
  { path: '**', redirectTo: 'login' },
];