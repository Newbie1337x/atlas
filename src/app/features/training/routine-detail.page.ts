import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonButtons, IonBackButton, IonNote,
} from '@ionic/angular';

/**
 * Single routine detail / edit page. Reads the routine id from the URL.
 * Placeholder — wired to the router so /training/routines/:id resolves.
 */
@Component({
  selector: 'page-training-routine-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonContent, IonHeader, IonTitle, IonToolbar,
    IonButtons, IonBackButton, IonNote,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/training" />
        </ion-buttons>
        <ion-title>Rutina #{{ routineId() }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-note>Placeholder — detalle/edición de la rutina.</ion-note>
    </ion-content>
  `,
})
export class RoutineDetailPage {
  private readonly route = inject(ActivatedRoute);
  protected routineId(): string { return this.route.snapshot.paramMap.get('id') ?? ''; }
}
