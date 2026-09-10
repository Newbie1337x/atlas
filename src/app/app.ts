import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';

/**
 * Root shell. IonApp is the Ionic runtime wrapper (owns modal stack, toast
 * root, back-button routing). IonRouterOutlet integrates Ionic's page
 * transitions with the Angular router — use this instead of plain
 * <router-outlet> at the top level.
 *
 * `[animated]="false"` on the outlet drops the horizontal slide between
 * top-level pages (tab switches, Empezar rutina → tracker, etc). Modal
 * / sheet animations are unaffected — they live on `ion-modal`, not on
 * the outlet, so vertical-up sheets (reorder, exercise picker, save
 * workout) keep their transition.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonApp, IonRouterOutlet],
  template: `
    <ion-app>
      <ion-router-outlet [animated]="false"></ion-router-outlet>
    </ion-app>
  `,
})
export class App {}
