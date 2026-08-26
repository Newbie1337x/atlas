import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

/**
 * DM chat — 1:1 and small-group. Real-time via STOMP over WebSocket
 * (see PLAYBOOK §5). Requires backend chat module (planned addition).
 * Skinless placeholder for now.
 */
@Component({
  selector: 'page-chat',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Chat</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <p>Placeholder — DMs y grupos.</p>
    </ion-content>
  `,
})
export class ChatPage {}
