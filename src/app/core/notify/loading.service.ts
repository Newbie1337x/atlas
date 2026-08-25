import { Injectable, inject } from '@angular/core';
import { LoadingController } from '@ionic/angular';
import { Observable, finalize, from, switchMap } from 'rxjs';

/**
 * Blocking loading spinner. Prefer feature-local loading state via signals
 * for anything that's part of the page layout — use THIS only for actions
 * that must block interaction (submitting a form, running a critical write).
 *
 *   this.loading.wrap(this.api.saveRoutine(payload), 'Guardando…')
 *     .subscribe({ next: … });
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly loadings = inject(LoadingController);

  wrap<T>(source$: Observable<T>, message = 'Cargando…'): Observable<T> {
    const loading$ = from(
      this.loadings.create({ message, spinner: 'crescent' }).then((l) => {
        void l.present();
        return l;
      }),
    );

    return loading$.pipe(
      switchMap((l) => source$.pipe(finalize(() => void l.dismiss()))),
    );
  }
}
