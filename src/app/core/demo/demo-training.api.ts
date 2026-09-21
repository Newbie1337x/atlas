import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { OffsetPage } from '@core/pagination.model';
import { TrainingApi } from '@core/training/training.api';
import {
  CatalogExercise, ExerciseInputPreference, InputPreferenceRequest,
} from '@core/training/exercise.model';
import { RoutineFolder, RoutineFolderRequest } from '@core/training/folder.model';
import {
  CreateRoutineRequest, RoutineDetail, RoutineExercise, RoutineSummary, UpdateRoutineRequest,
} from '@core/training/routine.model';
import {
  UpsertWorkoutRequest, WorkoutDetail, WorkoutDetailExercise, WorkoutStatus, WorkoutSummaryDetail,
} from '@core/training/workout.model';
import { PersonalRecord } from '@core/training/personal-record.model';
import { WorkoutPrepare } from '@core/training/workout-prepare.model';
import {
  DEMO_EXERCISES, DEMO_FOLDERS, DEMO_PERSONAL_RECORDS, DEMO_PREVIOUS_SETS, DEMO_ROUTINES,
} from './demo-data';

function toSummary(r: RoutineDetail): RoutineSummary {
  const totalSetCount = r.exercises.reduce((n, ex) => n + ex.sets.length, 0);
  return {
    id: r.id,
    organizationId: r.organizationId,
    ownerType: r.ownerType,
    ownerGlobalProfileId: r.ownerGlobalProfileId,
    title: r.title,
    folderId: r.folderId,
    displayOrder: r.displayOrder,
    exercisePreviews: r.exercises.map((ex) => ({
      exerciseId: ex.exerciseId, name: ex.exerciseName, iconUrl: ex.exerciseIconUrl, supersetGroupId: ex.supersetGroupId,
    })),
    totalExerciseCount: r.exercises.length,
    totalSetCount,
    estimatedDurationMinutes: totalSetCount > 0 ? Math.round(totalSetCount * 2.5) : null,
  };
}

let nextRoutineId = 900;
let nextFolderId = 900;

/**
 * In-memory stand-in for TrainingApi in the public showcase build — see
 * environment.demo.ts. Every mutation writes straight into the module-level
 * arrays from demo-data.ts, so reads immediately reflect it (no real
 * network round-trip, same request/response shape the real API returns).
 * State resets on page reload — that's expected for a public demo.
 */
@Injectable({ providedIn: 'root' })
export class DemoTrainingApi extends TrainingApi {
  private readonly workouts = new Map<string, WorkoutDetail>();
  private readonly workoutStartedAt = new Map<string, number>();
  private readonly inputPreferences = new Map<number, ExerciseInputPreference>();

  override listMyRoutines(offset = 0, size = 20): Observable<OffsetPage<RoutineSummary>> {
    const items = DEMO_ROUTINES.slice(offset, offset + size).map(toSummary);
    return of({ items, offset, size, totalCount: DEMO_ROUTINES.length, hasMore: offset + size < DEMO_ROUTINES.length });
  }

  override listFolders(): Observable<RoutineFolder[]> {
    return of(DEMO_FOLDERS.map((f) => ({ ...f, routineCount: DEMO_ROUTINES.filter((r) => r.folderId === f.id).length })));
  }

  override getRoutine(id: number): Observable<RoutineDetail> {
    const r = DEMO_ROUTINES.find((x) => x.id === id);
    return of(r ?? DEMO_ROUTINES[0]);
  }

  override createFolder(body: RoutineFolderRequest): Observable<RoutineFolder> {
    const folder: RoutineFolder = {
      id: nextFolderId++, organizationId: 1, ownerGlobalProfileId: 1,
      name: body.name ?? 'Nueva carpeta', displayOrder: DEMO_FOLDERS.length, createdAt: new Date().toISOString(), routineCount: 0,
    };
    DEMO_FOLDERS.push(folder);
    return of(folder);
  }

  override updateFolder(id: number, body: RoutineFolderRequest): Observable<RoutineFolder> {
    const f = DEMO_FOLDERS.find((x) => x.id === id);
    if (f) {
      if (body.name !== undefined) f.name = body.name;
      if (body.displayOrder !== undefined) f.displayOrder = body.displayOrder;
    }
    return of(f ?? DEMO_FOLDERS[0]);
  }

  override deleteFolder(id: number): Observable<void> {
    const idx = DEMO_FOLDERS.findIndex((x) => x.id === id);
    if (idx >= 0) DEMO_FOLDERS.splice(idx, 1);
    DEMO_ROUTINES.filter((r) => r.folderId === id).forEach((r) => (r.folderId = null));
    return of(void 0);
  }

  override createRoutine(body: CreateRoutineRequest): Observable<RoutineDetail> {
    const routine = this.toRoutineDetail(nextRoutineId++, body);
    DEMO_ROUTINES.push(routine);
    return of(routine);
  }

  override deleteRoutine(id: number): Observable<void> {
    const idx = DEMO_ROUTINES.findIndex((x) => x.id === id);
    if (idx >= 0) DEMO_ROUTINES.splice(idx, 1);
    return of(void 0);
  }

  override updateRoutine(id: number, body: UpdateRoutineRequest): Observable<RoutineDetail> {
    const idx = DEMO_ROUTINES.findIndex((x) => x.id === id);
    const updated = this.toRoutineDetail(id, body);
    if (idx >= 0) DEMO_ROUTINES[idx] = updated;
    return of(updated);
  }

  override patchRoutineMetadata(
    id: number,
    body: { title?: string; notes?: string | null; folderId?: number | null; displayOrder?: number },
  ): Observable<RoutineDetail> {
    const r = DEMO_ROUTINES.find((x) => x.id === id);
    if (r) {
      if (body.title !== undefined) r.title = body.title;
      if (body.notes !== undefined) r.notes = body.notes;
      if (body.folderId !== undefined) r.folderId = body.folderId;
      if (body.displayOrder !== undefined) r.displayOrder = body.displayOrder;
    }
    return of(r ?? DEMO_ROUTINES[0]);
  }

  override reorderRoutinesInFolder(folderId: number | null, routineIds: number[]): Observable<void> {
    routineIds.forEach((id, index) => {
      const r = DEMO_ROUTINES.find((x) => x.id === id);
      if (r) r.displayOrder = index;
    });
    void folderId;
    return of(void 0);
  }

  override cloneRoutine(id: number): Observable<RoutineDetail> {
    const source = DEMO_ROUTINES.find((x) => x.id === id);
    if (!source) return of(DEMO_ROUTINES[0]);
    const clone: RoutineDetail = {
      ...structuredClone(source),
      id: nextRoutineId++,
      title: `${source.title} (copia)`,
      displayOrder: DEMO_ROUTINES.length,
    };
    DEMO_ROUTINES.push(clone);
    return of(clone);
  }

  override listExercises(): Observable<CatalogExercise[]> {
    return of(DEMO_EXERCISES);
  }

  override getInputPreference(exerciseId: number): Observable<ExerciseInputPreference | null> {
    return of(this.inputPreferences.get(exerciseId) ?? null);
  }

  override putInputPreference(exerciseId: number, body: InputPreferenceRequest): Observable<ExerciseInputPreference> {
    const pref: ExerciseInputPreference = {
      id: exerciseId, globalProfileId: 1, exerciseId, inputMode: body.inputMode, brickWeightKg: body.brickWeightKg ?? 5,
    };
    this.inputPreferences.set(exerciseId, pref);
    return of(pref);
  }

  override upsertWorkout(clientUuid: string, body: UpsertWorkoutRequest): Observable<WorkoutDetail> {
    if (!this.workoutStartedAt.has(clientUuid)) this.workoutStartedAt.set(clientUuid, Date.now());
    const existing = this.workouts.get(clientUuid);
    const detail: WorkoutDetail = {
      id: clientUuid,
      globalProfileId: 1,
      routineId: body.routineId,
      title: body.title ?? existing?.title ?? null,
      status: existing?.status ?? 'IN_PROGRESS',
      startedAt: body.startedAt,
      completedAt: existing?.completedAt ?? null,
      durationSeconds: existing?.durationSeconds ?? null,
      totalVolumeKg: existing?.totalVolumeKg ?? null,
      totalSets: existing?.totalSets ?? null,
      notes: body.notes ?? null,
      mediaUrls: body.mediaUrls ?? [],
      visibility: body.visibility ?? 'PRIVATE',
      exercises: body.exercises.map((ex): WorkoutDetailExercise => ({
        id: ex.id,
        orderIndex: ex.orderIndex,
        exerciseId: ex.exerciseId,
        exerciseName: DEMO_EXERCISES.find((e) => e.id === ex.exerciseId)?.name ?? null,
        exerciseIconUrl: null,
        supersetGroupId: ex.supersetGroupId ?? null,
        restSeconds: ex.restSeconds ?? null,
        notes: ex.notes ?? null,
        sets: ex.sets.map((s) => ({
          id: s.id, orderIndex: s.orderIndex, setType: s.setType,
          reps: s.reps ?? null, weightKg: s.weightKg ?? null,
          durationSeconds: s.durationSeconds ?? null, distanceKm: s.distanceKm ?? null,
          rpe: s.rpe ?? null, actualRestSeconds: s.actualRestSeconds ?? null,
          inputMode: s.inputMode ?? null, brickWeightKg: s.brickWeightKg ?? null,
          completed: s.completed,
          isPersonalRecord: this.checkPersonalRecord(ex.exerciseId, s.weightKg ?? null),
        })),
      })),
    };
    this.workouts.set(clientUuid, detail);
    return of(detail);
  }

  override completeWorkout(id: string): Observable<void> {
    const w = this.workouts.get(id);
    if (w) {
      const startedMs = this.workoutStartedAt.get(id) ?? Date.now();
      w.status = 'COMPLETED' as WorkoutStatus;
      w.completedAt = new Date().toISOString();
      w.durationSeconds = Math.max(1, Math.round((Date.now() - startedMs) / 1000));
      let totalSets = 0;
      let totalVolumeKg = 0;
      for (const ex of w.exercises) {
        for (const s of ex.sets) {
          if (!s.completed) continue;
          totalSets++;
          if (s.weightKg && s.reps) totalVolumeKg += s.weightKg * s.reps;
        }
      }
      w.totalSets = totalSets;
      w.totalVolumeKg = Math.round(totalVolumeKg);
    }
    return of(void 0);
  }

  override getWorkout(id: string): Observable<WorkoutDetail> {
    const w = this.workouts.get(id);
    return w ? of(w) : of(this.emptyWorkout(id));
  }

  override getWorkoutSummary(id: string): Observable<WorkoutSummaryDetail> {
    const w = this.workouts.get(id) ?? this.emptyWorkout(id);
    return of({
      id: w.id, title: w.title, startedAt: w.startedAt, completedAt: w.completedAt,
      durationSeconds: w.durationSeconds, totalVolumeKg: w.totalVolumeKg, totalSets: w.totalSets,
      exercises: w.exercises.map((ex) => ({
        exerciseId: ex.exerciseId, exerciseName: ex.exerciseName, exerciseIconUrl: ex.exerciseIconUrl,
        sets: ex.sets.map((s) => ({
          reps: s.reps, weightKg: s.weightKg, durationSeconds: s.durationSeconds, distanceKm: s.distanceKm,
          completed: s.completed, isPersonalRecord: s.isPersonalRecord,
        })),
      })),
    });
  }

  override discardWorkout(id: string): Observable<void> {
    this.workouts.delete(id);
    this.workoutStartedAt.delete(id);
    return of(void 0);
  }

  override prepareWorkout(routineId: number): Observable<WorkoutPrepare> {
    const routine = DEMO_ROUTINES.find((r) => r.id === routineId) ?? DEMO_ROUTINES[0];
    const exerciseIds = new Set(routine.exercises.map((e) => e.exerciseId));
    return of({
      routine,
      personalRecords: DEMO_PERSONAL_RECORDS.filter((pr) => exerciseIds.has(pr.exerciseId)),
      previousSets: DEMO_PREVIOUS_SETS.filter((ps) => exerciseIds.has(ps.exerciseId)),
    });
  }

  override listPersonalRecordsBatch(exerciseIds: readonly number[]): Observable<PersonalRecord[]> {
    const ids = new Set(exerciseIds);
    return of(DEMO_PERSONAL_RECORDS.filter((pr) => ids.has(pr.exerciseId)));
  }

  private checkPersonalRecord(exerciseId: number, weightKg: number | null): boolean {
    if (!weightKg) return false;
    const pr = DEMO_PERSONAL_RECORDS.find((p) => p.exerciseId === exerciseId && p.recordType === 'MAX_WEIGHT');
    return !pr || weightKg > pr.value;
  }

  private emptyWorkout(id: string): WorkoutDetail {
    return {
      id, globalProfileId: 1, routineId: null, title: null, status: 'IN_PROGRESS' as WorkoutStatus,
      startedAt: new Date().toISOString(), completedAt: null, durationSeconds: null,
      totalVolumeKg: null, totalSets: null, notes: null, mediaUrls: [], visibility: 'PRIVATE', exercises: [],
    };
  }

  private toRoutineDetail(id: number, body: CreateRoutineRequest | UpdateRoutineRequest): RoutineDetail {
    const exercises: RoutineExercise[] = body.exercises.map((ex, i) => ({
      id: 2000 + id * 10 + i,
      orderIndex: ex.orderIndex,
      exerciseId: ex.exerciseId,
      exerciseName: DEMO_EXERCISES.find((e) => e.id === ex.exerciseId)?.name ?? null,
      exerciseIconUrl: null,
      restSeconds: ex.restSeconds ?? null,
      supersetGroupId: ex.supersetGroupId ?? null,
      notes: ex.notes ?? null,
      repsMode: ex.repsMode ?? 'SINGLE',
      capabilities: DEMO_EXERCISES.find((e) => e.id === ex.exerciseId)?.capabilities ?? null,
      sets: ex.sets.map((s, j) => ({
        id: 3000 + id * 100 + i * 10 + j,
        orderIndex: s.orderIndex,
        setType: s.setType,
        targetRepsMin: s.targetRepsMin ?? null,
        targetRepsMax: s.targetRepsMax ?? null,
        targetWeightKg: s.targetWeightKg ?? null,
        targetDurationSeconds: s.targetDurationSeconds ?? null,
        targetDistanceKm: s.targetDistanceKm ?? null,
        targetRpe: s.targetRpe ?? null,
        restSecondsAfter: s.restSecondsAfter ?? null,
      })),
    }));
    return {
      id, organizationId: 1, ownerType: 'MEMBER', ownerGlobalProfileId: 1, sourceRoutineId: null,
      title: body.title, notes: body.notes ?? null, folderId: body.folderId ?? null,
      displayOrder: body.displayOrder ?? 0, exercises,
    };
  }
}
