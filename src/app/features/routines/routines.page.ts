import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

/**
 * Rutinas — list of user's routines + template gallery. Skinless placeholder
 * until the training feature ships (Phase 3 per PLAYBOOK). Real page will
 * pull from /api/training/routines + /api/training/templates, offline-first
 * via TanStack Query + IndexedDB persist.
 */
@Component({
  selector: 'page-routines',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Rutinas</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <p>Placeholder — acá van tus rutinas + templates del gym.</p>
    </ion-content>
  `,
})
export class RoutinesPage {}
