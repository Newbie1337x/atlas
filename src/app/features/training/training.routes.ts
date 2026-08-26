import { Routes } from '@angular/router';

/**
 * Training tab — routines list + active workout tracker + community
 * template exploration. Consolidates what used to be split across
 * /routines and /session.
 *
 *   /training                    → main: 'empty workout' btn + routines list
 *   /training/explore            → community routine templates (deferred)
 *   /training/session            → active workout tracker (rest timer, sets)
 *   /training/routines/:id       → single routine detail / edit
 */
export const trainingRoutes: Routes = [
  { path: '',              loadComponent: () => import('./training.page').then((m) => m.TrainingPage) },
  { path: 'explore',       loadComponent: () => import('./explore.page').then((m) => m.ExplorePage) },
  { path: 'session',       loadComponent: () => import('./session.page').then((m) => m.SessionPage) },
  { path: 'routines/:id',  loadComponent: () => import('./routine-detail.page').then((m) => m.RoutineDetailPage) },
];
