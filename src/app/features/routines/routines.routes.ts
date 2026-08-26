import { Routes } from '@angular/router';

export const routinesRoutes: Routes = [
  { path: '', loadComponent: () => import('./routines.page').then((m) => m.RoutinesPage) },
];
