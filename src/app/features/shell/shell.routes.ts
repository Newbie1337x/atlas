import { Routes } from '@angular/router';

/**
 * Authenticated shell — parent is app.routes.ts's '' path (authGuard'd).
 * Adding a new feature:
 *   1. Create features/<name>/<name>.routes.ts + <name>.page.ts
 *   2. Add one entry here with lazy loadChildren
 *   3. Optional: guard with moduleGuard('<MODULE>') when the feature only
 *      exists for tenants with that Proteus module active
 *
 * All feature routes render INSIDE the shell's <router-outlet>, so the
 * shell's chrome (offline banner + temp nav) surrounds them.
 */
export const shellRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./shell.page').then((m) => m.ShellPage),
    children: [
      { path: '',         redirectTo: 'home', pathMatch: 'full' },
      { path: 'home',     loadChildren: () => import('@features/home/home.routes').then((m) => m.homeRoutes) },
      { path: 'routines', loadChildren: () => import('@features/routines/routines.routes').then((m) => m.routinesRoutes) },
      { path: 'session',  loadChildren: () => import('@features/session/session.routes').then((m) => m.sessionRoutes) },
      { path: 'social',   loadChildren: () => import('@features/social/social.routes').then((m) => m.socialRoutes) },
      { path: 'chat',     loadChildren: () => import('@features/chat/chat.routes').then((m) => m.chatRoutes) },
      { path: 'profile',  loadChildren: () => import('@features/profile/profile.routes').then((m) => m.profileRoutes) },
    ],
  },
];
