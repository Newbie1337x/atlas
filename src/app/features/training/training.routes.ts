import { Routes } from '@angular/router';
import { routineEditDeactivateGuard } from './routine-edit/routine-edit-deactivate.guard';
import { sessionDeactivateGuard } from './session/session-deactivate.guard';

/**
 * Training tab — routines list + active workout tracker + community
 * template exploration. Consolidates what used to be split across
 * /routines and /session.
 *
 *   /training                    → main: 'empty workout' btn + routines list
 *   /training/explore            → community routine templates (deferred)
 *   /training/session            → active workout tracker (rest timer, sets)
 *   /training/routines/:id       → single routine detail (read only + actions)
 *   /training/routines/:id/edit  → routine editor (title / notes / exercises / sets)
 */
export const trainingRoutes: Routes = [
  { path: '',                  loadComponent: () => import('./training.page').then((m) => m.TrainingPage) },
  { path: 'explore',           loadComponent: () => import('./explore.page').then((m) => m.ExplorePage) },
  {
    path: 'session/:routineId',
    loadComponent: () => import('./session.page').then((m) => m.SessionPage),
    canDeactivate: [sessionDeactivateGuard],
  },
  { path: 'routines/:id',      loadComponent: () => import('./routine-detail.page').then((m) => m.RoutineDetailPage) },
  {
    // "new" is a reserved id — the editor treats it as create mode:
    // seeds an empty draft locally, POSTs on save, no backend call
    // until Guardar. See RoutineEditPage.isCreate().
    path: 'routines/new/edit',
    loadComponent: () => import('./routine-edit.page').then((m) => m.RoutineEditPage),
    canDeactivate: [routineEditDeactivateGuard],
  },
  {
    path: 'routines/:id/edit',
    loadComponent: () => import('./routine-edit.page').then((m) => m.RoutineEditPage),
    canDeactivate: [routineEditDeactivateGuard],
  },
];
