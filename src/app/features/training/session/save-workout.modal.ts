import {
  ChangeDetectionStrategy, Component, Input, OnInit, ViewContainerRef,
  computed, inject, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonIcon, IonTextarea, IonItem, IonLabel,
  IonNote,
  AlertController, ModalController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  chevronBackOutline, closeOutline, imageOutline, calendarOutline,
  locationOutline, eyeOutline, clipboardOutline, timeOutline,
  barbellOutline, layersOutline, chevronForwardOutline,
} from 'ionicons/icons';
import { WorkoutSaveMetadata } from './session-to-upsert';
import { WorkoutVisibility } from '@core/training/workout.model';
import { SelectSheetService } from '@shared/ui/select-sheet.service';

/**
 * "Guardar entreno" screen — presented as a full-screen ion-modal
 * over session.page so the shared RoutineEditFormService stays alive.
 * Collects the metadata the backend accepts on complete (title,
 * duration override, notes, visibility) plus surfaces the workout's
 * KPIs so the user sees what they're saving.
 *
 * "Ajustes de Rutina" is a single row that opens the same 3-option
 * sheet the alert used before (mantener / descartar cambios /
 * actualizar rutina). It only renders when the draft is dirty — no
 * changes means no template-update prompt to show.
 *
 * Dismisses via ModalController with a role telling session.page what
 * to do next: 'save' + a { metadata, updateRoutine } payload,
 * 'discard' / 'cancel' with no payload. Session page reads the role
 * via onDidDismiss() and branches from there — it owns the actual
 * upsert + complete + navigate to summary.
 */
@Component({
  selector: 'app-save-workout-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
    IonContent, IonIcon, IonTextarea, IonItem, IonLabel,
    IonNote,
  ],
  styleUrl: './save-workout.modal.css',
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="onCancel()" aria-label="Volver">
            <ion-icon slot="icon-only" name="chevron-back-outline" />
          </ion-button>
        </ion-buttons>
        <ion-title>Guardar Entreno</ion-title>
        <ion-buttons slot="end">
          <ion-button class="save-cta" (click)="onSave()" [disabled]="saving()">
            Guardar
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="title-row">
        <input
          class="title-input"
          type="text"
          [ngModel]="title()"
          (ngModelChange)="title.set($event)"
          placeholder="Nombre del entreno" />
      </div>

      <div class="kpis">
        <button type="button" class="kpi editable" (click)="editDuration()">
          <span class="kpi-label">Duración</span>
          <span class="kpi-value">{{ durationLabel() }}</span>
        </button>
        <div class="kpi">
          <span class="kpi-label">Volumen</span>
          <span class="kpi-value">{{ volumeLabel() }}</span>
        </div>
        <div class="kpi">
          <span class="kpi-label">Series</span>
          <span class="kpi-value">{{ completedSets() }}</span>
        </div>
      </div>

      <button type="button" class="upload" disabled>
        <ion-icon name="image-outline" aria-hidden="true" />
        <span>Agregar foto / video</span>
        <ion-note slot="end">Próximamente</ion-note>
      </button>

      <ion-item lines="none" class="notes-item">
        <ion-label position="stacked">Descripción</ion-label>
        <ion-textarea
          [autoGrow]="true"
          [rows]="2"
          placeholder="¿Cómo estuvo tu entreno? Dejá algunas notas acá…"
          [ngModel]="notes()"
          (ngModelChange)="notes.set($event)" />
      </ion-item>

      <ion-item button="true" detail="false" class="row" disabled>
        <ion-icon slot="start" name="location-outline" aria-hidden="true" />
        <ion-label>Gimnasio</ion-label>
        <ion-note slot="end">Próximamente</ion-note>
      </ion-item>

      <ion-item button="true" detail="false" class="row" (click)="pickVisibility()">
        <ion-icon slot="start" name="eye-outline" aria-hidden="true" />
        <ion-label>Visibilidad</ion-label>
        <ion-note slot="end">{{ visibilityLabel() }}</ion-note>
        <ion-icon slot="end" name="chevron-forward-outline" aria-hidden="true" />
      </ion-item>

      @if (isDirty) {
        <ion-item button="true" detail="false" class="row" (click)="pickRoutineAction()">
          <ion-icon slot="start" name="clipboard-outline" aria-hidden="true" />
          <ion-label>Ajustes de Rutina</ion-label>
          <ion-note slot="end">{{ routineActionLabel() }}</ion-note>
          <ion-icon slot="end" name="chevron-forward-outline" aria-hidden="true" />
        </ion-item>
      }

      <div class="discard-wrap">
        <ion-button
          fill="clear"
          expand="block"
          color="danger"
          (click)="onDiscard()">
          Descartar Entreno
        </ion-button>
      </div>
    </ion-content>
  `,
})
export class SaveWorkoutModal implements OnInit {
  // Plain @Input fields (not signal input()) because Ionic
  // ModalController.componentProps assigns via Object.assign onto the
  // instance — that assignment does NOT set signal inputs (they are
  // internal getters bound by the component metadata). Once the modal
  // opens, none of these values change, so the classic @Input is a
  // clean fit.
  @Input() initialTitle = '';
  @Input() elapsedSeconds = 0;
  @Input() totalVolumeKg = 0;
  @Input() completedSetsCount = 0;
  @Input() totalSetsCount = 0;
  @Input() isDirty = false;

  private readonly alerts = inject(AlertController);
  private readonly sheets = inject(SelectSheetService);
  private readonly modal = inject(ModalController);
  private readonly vcr = inject(ViewContainerRef);

  protected readonly title = signal<string>('');
  protected readonly notes = signal<string>('');
  protected readonly visibility = signal<WorkoutVisibility>('PUBLIC');
  /** null = no override; use elapsedSeconds. Set when user edits duration. */
  protected readonly durationOverride = signal<number | null>(null);
  /** 'update' | 'discard' — determines what happens with the routine
   *  template changes at Guardar. Default 'discard' so template stays
   *  untouched unless the user explicitly opts in. */
  protected readonly routineAction = signal<'update' | 'discard'>('discard');
  protected readonly saving = signal<boolean>(false);

  constructor() {
    addIcons({
      'chevron-back-outline': chevronBackOutline,
      'close-outline': closeOutline,
      'image-outline': imageOutline,
      'calendar-outline': calendarOutline,
      'location-outline': locationOutline,
      'eye-outline': eyeOutline,
      'clipboard-outline': clipboardOutline,
      'time-outline': timeOutline,
      'barbell-outline': barbellOutline,
      'layers-outline': layersOutline,
      'chevron-forward-outline': chevronForwardOutline,
    });
  }

  ngOnInit(): void {
    // @Input values are already assigned by ModalController's
    // Object.assign before ngOnInit fires — safe to seed here.
    if (!this.title()) this.title.set(this.initialTitle);
  }

  protected readonly effectiveDurationSeconds = computed<number>(() =>
    this.durationOverride() ?? this.elapsedSeconds);

  protected readonly durationLabel = computed(() =>
    this.formatDuration(this.effectiveDurationSeconds()));

  protected readonly volumeLabel = computed(() => {
    const kg = this.totalVolumeKg;
    return kg >= 1000 ? `${(kg / 1000).toFixed(1)}t` : `${Math.round(kg)}kg`;
  });

  protected readonly completedSets = computed(() =>
    `${this.completedSetsCount}/${this.totalSetsCount}`);

  protected readonly visibilityLabel = computed(() => {
    switch (this.visibility()) {
      case 'PUBLIC':    return 'Todos';
      case 'FOLLOWERS': return 'Seguidores';
      case 'PRIVATE':   return 'Solo yo';
    }
  });

  protected readonly routineActionLabel = computed(() =>
    this.routineAction() === 'update' ? 'Actualizar rutina' : 'Descartar cambios');

  protected async editDuration(): Promise<void> {
    const totalSec = this.effectiveDurationSeconds();
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const alert = await this.alerts.create({
      header: 'Minutos entrenados',
      inputs: [
        { name: 'h', type: 'number', min: 0, max: 24, value: h, placeholder: 'horas' },
        { name: 'm', type: 'number', min: 0, max: 59, value: m, placeholder: 'minutos' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar', role: 'confirm', handler: (data: { h: string; m: string }) => {
            const hours = Math.max(0, Math.floor(Number(data.h) || 0));
            const minutes = Math.max(0, Math.min(59, Math.floor(Number(data.m) || 0)));
            this.durationOverride.set(hours * 3600 + minutes * 60);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  protected async pickVisibility(): Promise<void> {
    const picked = await this.sheets.open(this.vcr, {
      header: '¿Quién puede ver este entreno?',
      value: this.visibility(),
      options: [
        { label: 'Todos',      value: 'PUBLIC' },
        { label: 'Seguidores', value: 'FOLLOWERS' },
        { label: 'Solo yo',    value: 'PRIVATE' },
      ],
    });
    if (picked === 'PUBLIC' || picked === 'FOLLOWERS' || picked === 'PRIVATE') {
      this.visibility.set(picked);
    }
  }

  protected async pickRoutineAction(): Promise<void> {
    const picked = await this.sheets.open(this.vcr, {
      header: '¿Qué hacemos con los cambios de la rutina?',
      subtitle: 'Modificaste el template durante el entreno',
      value: this.routineAction(),
      options: [
        { label: 'Descartar cambios',  value: 'discard' },
        { label: 'Actualizar rutina',  value: 'update' },
      ],
    });
    if (picked === 'update' || picked === 'discard') this.routineAction.set(picked);
  }

  protected async onSave(): Promise<void> {
    this.saving.set(true);
    const trimmedTitle = this.title().trim();
    const trimmedNotes = this.notes().trim();
    const payload: SaveWorkoutResult = {
      metadata: {
        title: trimmedTitle || null,
        notes: trimmedNotes || null,
        visibility: this.visibility(),
        durationSeconds: this.durationOverride() ?? this.elapsedSeconds,
      },
      updateRoutine: this.isDirty && this.routineAction() === 'update',
    };
    await this.modal.dismiss(payload, 'save');
  }

  protected async onDiscard(): Promise<void> {
    const alert = await this.alerts.create({
      header: '¿Descartar entrenamiento?',
      message: 'Vas a perder lo que registraste hasta ahora.',
      buttons: [
        { text: 'Seguir editando', role: 'cancel' },
        { text: 'Descartar',       role: 'destructive' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role === 'destructive') await this.modal.dismiss(null, 'discard');
  }

  protected async onCancel(): Promise<void> {
    await this.modal.dismiss(null, 'cancel');
  }

  private formatDuration(totalSeconds: number): string {
    const s = Math.max(0, Math.round(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${m}min`;
    return `${m}min`;
  }
}

/** Payload emitted via `modal.dismiss(payload, 'save')` — session.page
 *  reads it back through `onDidDismiss().data` and calls finalize. */
export interface SaveWorkoutResult {
  metadata: WorkoutSaveMetadata;
  updateRoutine: boolean;
}
