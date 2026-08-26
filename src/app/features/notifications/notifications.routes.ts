import { Routes } from '@angular/router';

export const notificationsRoutes: Routes = [
  { path: '', loadComponent: () => import('./notifications.page').then((m) => m.NotificationsPage) },
];
