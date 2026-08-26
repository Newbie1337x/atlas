import { Routes } from '@angular/router';

export const profileRoutes: Routes = [
  { path: '', loadComponent: () => import('./profile.page').then((m) => m.ProfilePage) },
];
