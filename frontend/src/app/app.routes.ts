import { Routes } from '@angular/router';
import { Login } from './features/auth/login/login';
import { Shell } from './core/layout/shell/shell';
import { authGuard } from './core/guards/auth-guard';
import { roleGuard } from './core/guards/role-guard';
import { guestGuard, redirectToHome } from './core/guards/guest-guard';
import { ROLES_DOCENTES, Role } from './shared/models/user';

// data.roles: quién puede entrar · data.titulo: miga de pan del encabezado
const usuarios = { roles: ['ADMINISTRADOR'] as Role[], titulo: 'Gestión de usuarios' };
const programa = { roles: ['COORDINADOR'] as Role[], titulo: 'Programa académico' };
const guias = { roles: ['COORDINADOR'] as Role[], titulo: 'Guías de aprendizaje' };
const guiasBase = { roles: ROLES_DOCENTES, titulo: 'Guías base' };
const misVersiones = { roles: ROLES_DOCENTES, titulo: 'Mis versiones' };
const misSugerencias = { roles: ROLES_DOCENTES, titulo: 'Mis sugerencias' };
const sugerencias = { roles: ['COORDINADOR'] as Role[], titulo: 'Sugerencias' };

export const routes: Routes = [
  { path: 'login', component: Login, canActivate: [guestGuard] },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      // HE-01 · Administrador
      { path: 'usuarios', loadComponent: () => import('./features/users/user-list/user-list').then((m) => m.UserList), canActivate: [roleGuard], data: usuarios },
      { path: 'usuarios/nuevo', loadComponent: () => import('./features/users/user-form/user-form').then((m) => m.UserForm), canActivate: [roleGuard], data: usuarios },
      { path: 'usuarios/registro-exitoso', loadComponent: () => import('./features/users/user-created/user-created').then((m) => m.UserCreated), canActivate: [roleGuard], data: usuarios },
      { path: 'usuarios/:id/editar', loadComponent: () => import('./features/users/user-edit/user-edit').then((m) => m.UserEdit), canActivate: [roleGuard], data: usuarios },
      { path: 'usuarios/:id/desactivar', loadComponent: () => import('./features/users/user-deactivate/user-deactivate').then((m) => m.UserDeactivate), canActivate: [roleGuard], data: usuarios },
      // "Asignar rol" vive bajo "Roles y permisos", como en Figma (HE-01-HU-04)
      { path: 'roles', loadComponent: () => import('./features/users/role-list/role-list').then((m) => m.RoleList), canActivate: [roleGuard], data: { ...usuarios, titulo: 'Roles y permisos' } },
      { path: 'roles/:id', loadComponent: () => import('./features/users/user-role/user-role').then((m) => m.UserRole), canActivate: [roleGuard], data: usuarios },
      { path: 'usuarios/:id/rol', redirectTo: 'roles/:id' },

      // HE-02 · Coordinador Académico (carga diferida para no inflar el bundle inicial)
      { path: 'modulos', loadComponent: () => import('./features/academic-program/module-list/module-list').then((m) => m.ModuleList), canActivate: [roleGuard], data: programa },
      { path: 'modulos/nuevo', loadComponent: () => import('./features/academic-program/module-form/module-form').then((m) => m.ModuleForm), canActivate: [roleGuard], data: programa },
      { path: 'modulos/:id', loadComponent: () => import('./features/academic-program/module-detail/module-detail').then((m) => m.ModuleDetail), canActivate: [roleGuard], data: programa },
      { path: 'modulos/:id/editar', loadComponent: () => import('./features/academic-program/module-edit/module-edit').then((m) => m.ModuleEdit), canActivate: [roleGuard], data: programa },
      { path: 'modulos/:id/inhabilitar', loadComponent: () => import('./features/academic-program/module-deactivate/module-deactivate').then((m) => m.ModuleDeactivate), canActivate: [roleGuard], data: programa },
      { path: 'modulos/:id/competencias/nueva', loadComponent: () => import('./features/academic-program/competency-new/competency-new').then((m) => m.CompetencyNew), canActivate: [roleGuard], data: programa },
      { path: 'modulos/:id/competencias/:competenciaId/editar', loadComponent: () => import('./features/academic-program/competency-edit/competency-edit').then((m) => m.CompetencyEdit), canActivate: [roleGuard], data: programa },
      { path: 'modulos/:id/competencias/:competenciaId/eliminar', loadComponent: () => import('./features/academic-program/competency-delete/competency-delete').then((m) => m.CompetencyDelete), canActivate: [roleGuard], data: programa },

      // HE-03 · Coordinador Académico
      { path: 'guias', loadComponent: () => import('./features/guides/guide-list/guide-list').then((m) => m.GuideList), canActivate: [roleGuard], data: guias },
      { path: 'guias/nueva', loadComponent: () => import('./features/guides/guide-form/guide-form').then((m) => m.GuideForm), canActivate: [roleGuard], data: { ...guias, subtitulo: 'Nueva guía base' } },
      { path: 'guias/estructura', loadComponent: () => import('./features/guides/field-config/field-config').then((m) => m.FieldConfigPage), canActivate: [roleGuard], data: { ...guias, subtitulo: 'Configurar estructura' } },
      { path: 'guias/:id', loadComponent: () => import('./features/guides/guide-detail/guide-detail').then((m) => m.GuideDetail), canActivate: [roleGuard], data: { ...guias, subtitulo: 'Guía base' } },
      { path: 'guias/:id/editar', loadComponent: () => import('./features/guides/guide-edit/guide-edit').then((m) => m.GuideEdit), canActivate: [roleGuard], data: { ...guias, subtitulo: 'Editar guía base' } },

      // HE-04 · Docente y Docente Autorizado
      { path: 'mis-modulos', loadComponent: () => import('./features/teacher-space/assigned-guides/assigned-guides').then((m) => m.AssignedGuides), canActivate: [roleGuard], data: guiasBase },
      { path: 'mis-modulos/guias/:id', loadComponent: () => import('./features/teacher-space/teacher-guide/teacher-guide').then((m) => m.TeacherGuide), canActivate: [roleGuard], data: guiasBase },
      { path: 'mis-versiones', loadComponent: () => import('./features/teacher-space/version-list/version-list').then((m) => m.VersionList), canActivate: [roleGuard], data: misVersiones },
      { path: 'mis-versiones/:id', loadComponent: () => import('./features/teacher-space/version-edit/version-edit').then((m) => m.VersionEdit), canActivate: [roleGuard], data: misVersiones },

      // HE-05 · Sugerencias (docentes envían, coordinación decide)
      { path: 'mis-modulos/guias/:id/sugerir', loadComponent: () => import('./features/suggestions/suggest-change/suggest-change').then((m) => m.SuggestChange), canActivate: [roleGuard], data: { ...guiasBase, subtitulo: 'Sugerir cambio' } },
      { path: 'mis-sugerencias', loadComponent: () => import('./features/suggestions/my-suggestions/my-suggestions').then((m) => m.MySuggestions), canActivate: [roleGuard], data: misSugerencias },
      { path: 'mis-sugerencias/:id', loadComponent: () => import('./features/suggestions/my-suggestion/my-suggestion').then((m) => m.MySuggestion), canActivate: [roleGuard], data: misSugerencias },
      { path: 'sugerencias', loadComponent: () => import('./features/suggestions/suggestion-inbox/suggestion-inbox').then((m) => m.SuggestionInbox), canActivate: [roleGuard], data: sugerencias },
      { path: 'sugerencias/:id', loadComponent: () => import('./features/suggestions/suggestion-review/suggestion-review').then((m) => m.SuggestionReview), canActivate: [roleGuard], data: sugerencias },

      { path: 'sin-acceso', loadComponent: () => import('./features/auth/no-access/no-access').then((m) => m.NoAccess), data: { titulo: 'Sin acceso' } },
      { path: '', pathMatch: 'full', redirectTo: redirectToHome },
    ],
  },
  { path: '**', redirectTo: '' },
];
