import { Routes } from '@angular/router';

export const homeRoutes: Routes = [
  { path: '', loadComponent: () => import('./home.page').then((m) => m.HomePage) },
];
