import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonButtons, IonBackButton, IonNote,
} from '@ionic/angular';

/**
 * Community routine templates — search + preview + import to own routines.
 * Deferred per product decision; route exists so deep-links won't 404 and
 * so we don't have to refactor when we do build it.
 */
@Component({
  selector: 'page-training-explore',
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
        <ion-title>Explorar rutinas</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-note>Placeholder — deferido. Acá va la búsqueda/preview/import de templates comunitarios.</ion-note>
    </ion-content>
  `,
})
export class ExplorePage {}
