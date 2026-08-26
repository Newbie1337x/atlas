import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

/**
 * Social feed — posts, likes, follows, leaderboards. Only exists when the
 * backend SOCIAL module is active for the tenant (moduleGuard applies at
 * the route). Skinless placeholder until Phase 4.
 */
@Component({
  selector: 'page-social',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Social</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <p>Placeholder — feed, follows, leaderboards del gym.</p>
    </ion-content>
  `,
})
export class SocialPage {}
