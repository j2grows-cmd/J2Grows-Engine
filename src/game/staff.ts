import type { PlantEnvironment } from "./genetics.ts";

export type StaffState = {
  routineCareEnabled: boolean;
  trainingDaysRemaining: number;
  trainingLevel: number;
};

export const DEFAULT_STAFF_STATE: StaffState = {
  routineCareEnabled: true,
  trainingDaysRemaining: 0,
  trainingLevel: 0,
};
export const STAFF_TRAINING_COST = 25;
export const STAFF_TRAINING_DAYS = 3;
export const MAX_STAFF_TRAINING_LEVEL = 3;

function clampLevel(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(MAX_STAFF_TRAINING_LEVEL, Math.floor(value))) : 0;
}

export function normalizeStaffState(input?: Partial<StaffState> | null): StaffState {
  return {
    routineCareEnabled: typeof input?.routineCareEnabled === "boolean" ? input.routineCareEnabled : DEFAULT_STAFF_STATE.routineCareEnabled,
    trainingDaysRemaining: typeof input?.trainingDaysRemaining === "number" && Number.isFinite(input.trainingDaysRemaining) ? Math.max(0, Math.min(STAFF_TRAINING_DAYS, Math.floor(input.trainingDaysRemaining))) : 0,
    trainingLevel: clampLevel(input?.trainingLevel),
  };
}

export function canStartStaffTraining(cash: number, state: StaffState): boolean {
  return Number.isFinite(cash) && cash >= STAFF_TRAINING_COST && state.trainingDaysRemaining === 0 && state.trainingLevel < MAX_STAFF_TRAINING_LEVEL;
}

export function startStaffTraining(state: StaffState): StaffState | null {
  if (state.trainingDaysRemaining > 0 || state.trainingLevel >= MAX_STAFF_TRAINING_LEVEL) return null;
  return { ...state, trainingDaysRemaining: STAFF_TRAINING_DAYS };
}

/** Advances training by one simulated day and awards the next skill level on completion. */
export function advanceStaffDay(state: StaffState): StaffState {
  if (state.trainingDaysRemaining <= 0) return state;
  const remaining = state.trainingDaysRemaining - 1;
  return { ...state, trainingDaysRemaining: remaining, trainingLevel: remaining === 0 ? Math.min(MAX_STAFF_TRAINING_LEVEL, state.trainingLevel + 1) : state.trainingLevel };
}

/** Routine care buffers poor conditions; each completed training level raises the safety floor by five. */
export function effectiveStaffCareCondition(environment: PlantEnvironment, state: StaffState): number {
  const raw = (environment.light + environment.nutrition + environment.humidity) / 3;
  if (!state.routineCareEnabled) return raw;
  const floor = Math.min(75, 55 + clampLevel(state.trainingLevel) * 5);
  return Math.max(floor, raw);
}

/** Weekly wage for the starter assistant while routine care automation is enabled. */
export function weeklyStaffOperatingCost(state: StaffState): number {
  return state.routineCareEnabled ? 8 : 0;
}
