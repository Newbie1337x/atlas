import { Routes } from '@angular/router';

export const socialRoutes: Routes = [
  { path: '', loadComponent: () => import('./social.page').then((m) => m.SocialPage) },
];
