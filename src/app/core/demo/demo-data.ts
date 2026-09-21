import { ExerciseCapabilities, RoutineDetail, RoutineSet, SetType } from '@core/training/routine.model';
import { RoutineFolder } from '@core/training/folder.model';
import { CatalogExercise } from '@core/training/exercise.model';
import { PersonalRecord } from '@core/training/personal-record.model';
import { PreviousSet } from '@core/training/workout-prepare.model';
import { UserProfile } from '@core/users/user.model';

/**
 * Static seed data for the public showcase build (environment.demo.ts).
 * Everything here is fictional — no real account, no real workout
 * history. Mutated in-memory by DemoTrainingApi; resets on page reload.
 */

export const DEMO_USER: UserProfile = {
  id: 1,
  organizationId: 1,
  email: 'demo@atlas.app',
  firstName: 'Demo',
  lastName: 'Atlas',
  role: 'CUSTOMER',
  active: true,
  emailVerified: true,
  avatarUrl: null,
  linkedProviders: [],
  hasLocalPassword: false,
  createdAt: new Date().toISOString(),
  attributes: null,
};

const WEIGHT_REPS: ExerciseCapabilities = {
  weight: true, reps: true, duration: false, distance: false, rpe: true, bricks: true,
  allowedSetTypes: ['WARMUP', 'NORMAL', 'WORKING', 'FAILURE', 'DROP_SET'] as SetType[],
};

const BODYWEIGHT_REPS: ExerciseCapabilities = {
  weight: false, reps: true, duration: false, distance: false, rpe: true, bricks: false,
  allowedSetTypes: ['WARMUP', 'NORMAL', 'WORKING', 'FAILURE'] as SetType[],
};

export const DEMO_EXERCISES: CatalogExercise[] = [
  { id: 1, organizationId: null, name: 'Press de banca', exerciseType: 'REPS_WEIGHT', equipmentType: 'BARBELL', primaryMuscles: ['CHEST'], secondaryMuscles: ['TRICEPS'], demoMediaUrl: null, isCustom: false, capabilities: WEIGHT_REPS },
  { id: 2, organizationId: null, name: 'Press militar', exerciseType: 'REPS_WEIGHT', equipmentType: 'BARBELL', primaryMuscles: ['SHOULDERS'], secondaryMuscles: ['TRICEPS'], demoMediaUrl: null, isCustom: false, capabilities: WEIGHT_REPS },
  { id: 3, organizationId: null, name: 'Dominadas', exerciseType: 'BODYWEIGHT_REPS', equipmentType: 'BODYWEIGHT', primaryMuscles: ['UPPER_BACK'], secondaryMuscles: ['BICEPS'], demoMediaUrl: null, isCustom: false, capabilities: BODYWEIGHT_REPS },
  { id: 4, organizationId: null, name: 'Remo con barra', exerciseType: 'REPS_WEIGHT', equipmentType: 'BARBELL', primaryMuscles: ['UPPER_BACK'], secondaryMuscles: ['BICEPS'], demoMediaUrl: null, isCustom: false, capabilities: WEIGHT_REPS },
  { id: 5, organizationId: null, name: 'Peso muerto', exerciseType: 'REPS_WEIGHT', equipmentType: 'BARBELL', primaryMuscles: ['LOWER_BACK'], secondaryMuscles: ['GLUTES', 'HAMSTRINGS'], demoMediaUrl: null, isCustom: false, capabilities: WEIGHT_REPS },
  { id: 6, organizationId: null, name: 'Sentadilla', exerciseType: 'REPS_WEIGHT', equipmentType: 'BARBELL', primaryMuscles: ['QUADS'], secondaryMuscles: ['GLUTES'], demoMediaUrl: null, isCustom: false, capabilities: WEIGHT_REPS },
  { id: 7, organizationId: null, name: 'Prensa de piernas', exerciseType: 'REPS_WEIGHT', equipmentType: 'MACHINE', primaryMuscles: ['QUADS'], secondaryMuscles: ['GLUTES'], demoMediaUrl: null, isCustom: false, capabilities: WEIGHT_REPS },
  { id: 8, organizationId: null, name: 'Zancadas', exerciseType: 'BODYWEIGHT_REPS', equipmentType: 'BODYWEIGHT', primaryMuscles: ['QUADS'], secondaryMuscles: ['GLUTES'], demoMediaUrl: null, isCustom: false, capabilities: BODYWEIGHT_REPS },
];

function exName(id: number): string {
  return DEMO_EXERCISES.find((e) => e.id === id)?.name ?? '?';
}

let nextSetId = 1000;
function set(partial: Partial<RoutineSet> & { targetRepsMin: number; targetRepsMax: number }): RoutineSet {
  return {
    id: nextSetId++,
    orderIndex: 0,
    setType: 'WORKING',
    targetWeightKg: null,
    targetDurationSeconds: null,
    targetDistanceKm: null,
    targetRpe: null,
    restSecondsAfter: null,
    ...partial,
  };
}

export const DEMO_FOLDERS: RoutineFolder[] = [
  { id: 1, organizationId: 1, ownerGlobalProfileId: 1, name: 'Semanal', displayOrder: 0, createdAt: new Date().toISOString(), routineCount: 3 },
];

export const DEMO_ROUTINES: RoutineDetail[] = [
  {
    id: 101, organizationId: 1, ownerType: 'MEMBER', ownerGlobalProfileId: 1, sourceRoutineId: null,
    title: 'Lunes (Pecho)', notes: null, folderId: 1, displayOrder: 0,
    exercises: [
      { id: 1001, orderIndex: 0, exerciseId: 1, exerciseName: exName(1), exerciseIconUrl: null, restSeconds: 90, supersetGroupId: null, notes: null, repsMode: 'RANGE', capabilities: WEIGHT_REPS,
        sets: [
          set({ orderIndex: 0, targetRepsMin: 8, targetRepsMax: 10, targetWeightKg: 60 }),
          set({ orderIndex: 1, targetRepsMin: 8, targetRepsMax: 10, targetWeightKg: 60 }),
          set({ orderIndex: 2, targetRepsMin: 6, targetRepsMax: 8, targetWeightKg: 65 }),
        ] },
      { id: 1002, orderIndex: 1, exerciseId: 2, exerciseName: exName(2), exerciseIconUrl: null, restSeconds: 90, supersetGroupId: null, notes: null, repsMode: 'RANGE', capabilities: WEIGHT_REPS,
        sets: [
          set({ orderIndex: 0, targetRepsMin: 8, targetRepsMax: 10, targetWeightKg: 35 }),
          set({ orderIndex: 1, targetRepsMin: 8, targetRepsMax: 10, targetWeightKg: 35 }),
        ] },
    ],
  },
  {
    id: 102, organizationId: 1, ownerType: 'MEMBER', ownerGlobalProfileId: 1, sourceRoutineId: null,
    title: 'Martes (Espalda)', notes: null, folderId: 1, displayOrder: 1,
    exercises: [
      { id: 1003, orderIndex: 0, exerciseId: 3, exerciseName: exName(3), exerciseIconUrl: null, restSeconds: 90, supersetGroupId: null, notes: null, repsMode: 'RANGE', capabilities: BODYWEIGHT_REPS,
        sets: [
          set({ orderIndex: 0, targetRepsMin: 8, targetRepsMax: 12 }),
          set({ orderIndex: 1, targetRepsMin: 8, targetRepsMax: 12 }),
          set({ orderIndex: 2, targetRepsMin: 6, targetRepsMax: 10 }),
        ] },
      { id: 1004, orderIndex: 1, exerciseId: 4, exerciseName: exName(4), exerciseIconUrl: null, restSeconds: 75, supersetGroupId: null, notes: null, repsMode: 'RANGE', capabilities: WEIGHT_REPS,
        sets: [
          set({ orderIndex: 0, targetRepsMin: 10, targetRepsMax: 12, targetWeightKg: 40 }),
          set({ orderIndex: 1, targetRepsMin: 10, targetRepsMax: 12, targetWeightKg: 40 }),
        ] },
      { id: 1005, orderIndex: 2, exerciseId: 5, exerciseName: exName(5), exerciseIconUrl: null, restSeconds: 120, supersetGroupId: null, notes: null, repsMode: 'RANGE', capabilities: WEIGHT_REPS,
        sets: [
          set({ orderIndex: 0, targetRepsMin: 5, targetRepsMax: 5, targetWeightKg: 90 }),
          set({ orderIndex: 1, targetRepsMin: 5, targetRepsMax: 5, targetWeightKg: 90 }),
        ] },
    ],
  },
  {
    id: 103, organizationId: 1, ownerType: 'MEMBER', ownerGlobalProfileId: 1, sourceRoutineId: null,
    title: 'Miércoles (Piernas)', notes: null, folderId: 1, displayOrder: 2,
    exercises: [
      { id: 1006, orderIndex: 0, exerciseId: 6, exerciseName: exName(6), exerciseIconUrl: null, restSeconds: 120, supersetGroupId: null, notes: null, repsMode: 'RANGE', capabilities: WEIGHT_REPS,
        sets: [
          set({ orderIndex: 0, targetRepsMin: 6, targetRepsMax: 8, targetWeightKg: 80 }),
          set({ orderIndex: 1, targetRepsMin: 6, targetRepsMax: 8, targetWeightKg: 80 }),
          set({ orderIndex: 2, targetRepsMin: 6, targetRepsMax: 8, targetWeightKg: 85 }),
        ] },
      { id: 1007, orderIndex: 1, exerciseId: 7, exerciseName: exName(7), exerciseIconUrl: null, restSeconds: 90, supersetGroupId: null, notes: null, repsMode: 'RANGE', capabilities: WEIGHT_REPS,
        sets: [
          set({ orderIndex: 0, targetRepsMin: 10, targetRepsMax: 12, targetWeightKg: 120 }),
          set({ orderIndex: 1, targetRepsMin: 10, targetRepsMax: 12, targetWeightKg: 120 }),
        ] },
      { id: 1008, orderIndex: 2, exerciseId: 8, exerciseName: exName(8), exerciseIconUrl: null, restSeconds: 60, supersetGroupId: null, notes: null, repsMode: 'RANGE', capabilities: BODYWEIGHT_REPS,
        sets: [
          set({ orderIndex: 0, targetRepsMin: 10, targetRepsMax: 12 }),
          set({ orderIndex: 1, targetRepsMin: 10, targetRepsMax: 12 }),
        ] },
    ],
  },
];

export const DEMO_PERSONAL_RECORDS: PersonalRecord[] = [
  { id: 1, exerciseId: 1, recordType: 'MAX_WEIGHT', value: 65, achievedInWorkoutSetId: null, achievedAt: new Date(Date.now() - 7 * 86400_000).toISOString(), bodyweightSnapshotKg: null },
  { id: 2, exerciseId: 6, recordType: 'MAX_WEIGHT', value: 85, achievedInWorkoutSetId: null, achievedAt: new Date(Date.now() - 3 * 86400_000).toISOString(), bodyweightSnapshotKg: null },
  { id: 3, exerciseId: 5, recordType: 'ESTIMATED_1RM', value: 105, achievedInWorkoutSetId: null, achievedAt: new Date(Date.now() - 10 * 86400_000).toISOString(), bodyweightSnapshotKg: null },
];

/** ANTERIOR ghost values — one exercise-session ago, slightly under today's targets. */
export const DEMO_PREVIOUS_SETS: PreviousSet[] = [
  { exerciseId: 1, orderIndex: 0, setType: 'WORKING', reps: 9, weightKg: 57.5, durationSeconds: null, distanceKm: null, achievedAt: new Date(Date.now() - 7 * 86400_000).toISOString() },
  { exerciseId: 1, orderIndex: 1, setType: 'WORKING', reps: 8, weightKg: 57.5, durationSeconds: null, distanceKm: null, achievedAt: new Date(Date.now() - 7 * 86400_000).toISOString() },
  { exerciseId: 2, orderIndex: 0, setType: 'WORKING', reps: 9, weightKg: 32.5, durationSeconds: null, distanceKm: null, achievedAt: new Date(Date.now() - 7 * 86400_000).toISOString() },
  { exerciseId: 3, orderIndex: 0, setType: 'WORKING', reps: 9, weightKg: null, durationSeconds: null, distanceKm: null, achievedAt: new Date(Date.now() - 6 * 86400_000).toISOString() },
  { exerciseId: 6, orderIndex: 0, setType: 'WORKING', reps: 6, weightKg: 77.5, durationSeconds: null, distanceKm: null, achievedAt: new Date(Date.now() - 4 * 86400_000).toISOString() },
];
