import { Routes } from '@angular/router';

/**
 * Authenticated shell — parent is app.routes.ts's '' path (authGuard'd).
 *
 * Primary tabs (in bottom nav): home, training, profile
 * Secondary (accessed via icons/CTAs, NOT in bottom nav): chat, notifications
 *
 * Everything renders inside the shell's <router-outlet>, so the offline
 * banner + nav chrome surrounds every page.
 */
export const shellRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./shell.page').then((m) => m.ShellPage),
    children: [
      { path: '',              redirectTo: 'home', pathMatch: 'full' },
      // primary tabs
      { path: 'home',          loadChildren: () => import('@features/home/home.routes').then((m) => m.homeRoutes) },
      { path: 'training',      loadChildren: () => import('@features/training/training.routes').then((m) => m.trainingRoutes) },
      { path: 'profile',       loadChildren: () => import('@features/profile/profile.routes').then((m) => m.profileRoutes) },
      // secondary — accessed from header/CTAs
      { path: 'chat',          loadChildren: () => import('@features/chat/chat.routes').then((m) => m.chatRoutes) },
      { path: 'notifications', loadChildren: () => import('@features/notifications/notifications.routes').then((m) => m.notificationsRoutes) },
    ],
  },
];
