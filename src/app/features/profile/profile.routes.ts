import { Routes } from '@angular/router';

/**
 * Profile tab + secondary pages. The main /profile page is the rich
 * landing (avatar + stats + sub-nav to the pages below). Each sub-page
 * is a lazy child so navigating into one doesn't load the others.
 */
export const profileRoutes: Routes = [
  { path: '',              loadComponent: () => import('./profile.page').then((m) => m.ProfilePage) },
  { path: 'stats',         loadComponent: () => import('./stats.page').then((m) => m.StatsPage) },
  { path: 'exercises',     loadComponent: () => import('./exercises.page').then((m) => m.ExercisesPage) },
  { path: 'measurements',  loadComponent: () => import('./measurements.page').then((m) => m.MeasurementsPage) },
  { path: 'calendar',      loadComponent: () => import('./calendar.page').then((m) => m.CalendarPage) },
  { path: 'settings',      loadComponent: () => import('./settings.page').then((m) => m.SettingsPage) },
];
