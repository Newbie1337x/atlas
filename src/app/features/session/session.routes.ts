import { Routes } from '@angular/router';

export const sessionRoutes: Routes = [
  { path: '', loadComponent: () => import('./session.page').then((m) => m.SessionPage) },
];
