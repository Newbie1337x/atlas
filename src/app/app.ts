import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';

/**
 * Root shell. IonApp is the Ionic runtime wrapper (owns modal stack, toast
 * root, back-button routing). IonRouterOutlet integrates Ionic's page
 * transitions with the Angular router — use this instead of plain
 * <router-outlet> at the top level.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonApp, IonRouterOutlet],
  template: `
    <ion-app>
      <ion-router-outlet></ion-router-outlet>
    </ion-app>
  `,
})
export class App {}
