import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonButtons, IonBackButton, IonNote,
} from '@ionic/angular';

/**
 * Body measurements — weight, body fat %, chest/waist/arm circumference,
 * etc. History log with charts. Backend: BodyMeasurement entity ready.
 */
@Component({
  selector: 'page-profile-measurements',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonContent, IonHeader, IonTitle, IonToolbar,
    IonButtons, IonBackButton, IonNote,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/profile" /></ion-buttons>
        <ion-title>Medidas</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-note>Placeholder — peso, medidas corporales, historial + chart.</ion-note>
    </ion-content>
  `,
})
export class MeasurementsPage {}
