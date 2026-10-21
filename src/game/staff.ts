import type { PlantEnvironment } from "./genetics.ts";

export type StaffRole = "horticulturist" | "research-technician" | "nursery-manager" | "maintenance-technician";
export type StaffMember = { id: string; role: StaffRole; name: string; weeklyWage: number; morale: number; experienceDays: number };
export const STAFF_ROLE_DETAILS: Record<StaffRole, { label: string; hireCost: number; weeklyWage: number; description: string }> = {
  horticulturist: { label: "Horticulturist", hireCost: 70, weeklyWage: 14, description: "Improves routine care and species-specific diagnosis." },
  "research-technician": { label: "Research technician", hireCost: 110, weeklyWage: 18, description: "Adds research points to specimen observations." },
  "nursery-manager": { label: "Nursery manager", hireCost: 125, weeklyWage: 20, description: "Improves reputation gains from fulfilled orders." },
  "maintenance-technician": { label: "Maintenance technician", hireCost: 90, weeklyWage: 16, description: "Reduces pest and disease risk through preventive checks." },
};

export type StaffState = {
  routineCareEnabled: boolean;
  trainingDaysRemaining: number;
  trainingLevel: number;
  employees: StaffMember[];
};

export const DEFAULT_STAFF_STATE: StaffState = {
  routineCareEnabled: true,
  trainingDaysRemaining: 0,
  trainingLevel: 0,
  employees: [],
};
export const STAFF_TRAINING_COST = 25;
export const STAFF_TRAINING_DAYS = 3;
export const MAX_STAFF_TRAINING_LEVEL = 3;
export const MAX_EMPLOYEES = 12;

function clampLevel(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(MAX_STAFF_TRAINING_LEVEL, Math.floor(value))) : 0;
}
function normalizeRole(value: unknown): value is StaffRole {
  return typeof value === "string" && Object.hasOwn(STAFF_ROLE_DETAILS, value);
}
export function normalizeStaffState(input?: Partial<StaffState> | null): StaffState {
  const employees = Array.isArray(input?.employees) ? input.employees.filter((item): item is StaffMember => Boolean(item)
    && typeof item.id === "string" && normalizeRole(item.role) && typeof item.name === "string"
    && typeof item.weeklyWage === "number" && Number.isFinite(item.weeklyWage) && item.weeklyWage >= 0
    && typeof item.morale === "number" && Number.isFinite(item.morale)
    && typeof item.experienceDays === "number" && Number.isFinite(item.experienceDays)
  ).slice(0, MAX_EMPLOYEES).map((item) => ({ ...item, weeklyWage: Math.max(0, Math.min(1000, item.weeklyWage)), morale: Math.max(0, Math.min(100, Math.floor(item.morale))), experienceDays: Math.max(0, Math.floor(item.experienceDays)) })) : [];
  return {
    routineCareEnabled: typeof input?.routineCareEnabled === "boolean" ? input.routineCareEnabled : DEFAULT_STAFF_STATE.routineCareEnabled,
    trainingDaysRemaining: typeof input?.trainingDaysRemaining === "number" && Number.isFinite(input.trainingDaysRemaining) ? Math.max(0, Math.min(STAFF_TRAINING_DAYS, Math.floor(input.trainingDaysRemaining))) : 0,
    trainingLevel: clampLevel(input?.trainingLevel),
    employees,
  };
}

export function canStartStaffTraining(cash: number, state: StaffState): boolean {
  return Number.isFinite(cash) && cash >= STAFF_TRAINING_COST && state.trainingDaysRemaining === 0 && state.trainingLevel < MAX_STAFF_TRAINING_LEVEL;
}
export function startStaffTraining(state: StaffState): StaffState | null {
  if (state.trainingDaysRemaining > 0 || state.trainingLevel >= MAX_STAFF_TRAINING_LEVEL) return null;
  return { ...state, trainingDaysRemaining: STAFF_TRAINING_DAYS };
}

/** Advances training, experience, and weekly morale using the same in-game calendar. */
export function advanceStaffDay(state: StaffState, day = 1): StaffState {
  const remaining = state.trainingDaysRemaining > 0 ? state.trainingDaysRemaining - 1 : 0;
  const weeklyTick = day % 7 === 0;
  const employees = (state.employees ?? []).map((employee) => ({
    ...employee,
    experienceDays: employee.experienceDays + 1,
    morale: weeklyTick ? Math.max(0, Math.min(100, employee.morale + (state.routineCareEnabled ? 1 : -2))) : employee.morale,
  }));
  return {
    ...state,
    employees,
    trainingDaysRemaining: remaining,
    trainingLevel: remaining === 0 && state.trainingDaysRemaining > 0 ? Math.min(MAX_STAFF_TRAINING_LEVEL, state.trainingLevel + 1) : state.trainingLevel,
  };
}

/** Routine care buffers poor conditions; training and horticulturists improve the safety floor. */
export function effectiveStaffCareCondition(environment: PlantEnvironment, state: StaffState): number {
  const raw = (environment.light + environment.nutrition + environment.humidity) / 3;
  if (!state.routineCareEnabled) return raw;
  const horticulturists = (state.employees ?? []).filter((employee) => employee.role === "horticulturist" && employee.morale >= 20).length;
  const floor = Math.min(85, 55 + clampLevel(state.trainingLevel) * 5 + Math.min(3, horticulturists) * 5);
  return Math.max(floor, raw);
}

/** Weekly wages include the starter care assistant and every hired employee. */
export function weeklyStaffOperatingCost(state: StaffState): number {
  const assistant = state.routineCareEnabled ? 8 : 0;
  return assistant + (state.employees ?? []).reduce((sum, employee) => sum + employee.weeklyWage, 0);
}
