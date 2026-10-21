import type { GameState, LedgerEntry, FinancialStatus } from "./engine.ts";
import { DEFAULT_STAFF_STATE, normalizeStaffState } from "./staff.ts";
import { normalizeFacilityLevels } from "./facilities.ts";
import { DEFAULT_ENVIRONMENT } from "./genetics.ts";

export const SAVE_FORMAT_VERSION = 1;
export const SAVE_BACKUP_SUFFIX = ".recovery";
export const MAX_SAVE_BYTES = 5_000_000;

export type SaveNormalization = { state: GameState | null; reason?: string; repaired: number };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function finite(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/** Validates and upgrades the live engine save format while preserving compatible game data. */
export function normalizeGameSave(value: unknown, now = Date.now()): SaveNormalization {
  if (!record(value)) return { state: null, reason: "Save data is not an object.", repaired: 0 };
  if (value.version !== 1) return { state: null, reason: "Unsupported game-state version.", repaired: 0 };
  if (typeof value.simulationSeed !== "string" || !value.simulationSeed || !Array.isArray(value.specimens) || !Array.isArray(value.breedingProjects) || !Array.isArray(value.researchUnlocks)) {
    return { state: null, reason: "Required game data is missing.", repaired: 0 };
  }
  if (typeof value.cash !== "number" || !Number.isFinite(value.cash) || value.cash < 0 || typeof value.research !== "number" || !Number.isFinite(value.research) || value.research < 0 || !Number.isInteger(value.day) || value.day < 1) {
    return { state: null, reason: "Cash, research, or day values are invalid.", repaired: 0 };
  }
  if (!value.specimens.every((item: unknown) => record(item) && typeof item.id === "string" && typeof item.speciesId === "string" && typeof item.nickname === "string" && typeof item.location === "string" && typeof item.stage === "string" && typeof item.protected === "boolean" && typeof item.health === "number" && Number.isFinite(item.health) && typeof item.value === "number" && Number.isFinite(item.value) && typeof item.variegation === "number" && Number.isFinite(item.variegation))) {
    return { state: null, reason: "One or more specimen records are malformed.", repaired: 0 };
  }
  if (!value.breedingProjects.every((item: unknown) => record(item) && typeof item.id === "string" && typeof item.parentAId === "string" && typeof item.parentBId === "string" && typeof item.completesOnDay === "number" && Number.isFinite(item.completesOnDay) && ["active", "completed", "cancelled"].includes(String(item.status)))) {
    return { state: null, reason: "One or more breeding projects are malformed.", repaired: 0 };
  }
  const env = record(value.greenhouseEnvironment) ? value.greenhouseEnvironment : {};
  const environment = {
    ...DEFAULT_ENVIRONMENT,
    ...env,
    light: finite(env.light, DEFAULT_ENVIRONMENT.light, 0, 100),
    nutrition: finite(env.nutrition, DEFAULT_ENVIRONMENT.nutrition, 0, 100),
    humidity: finite(env.humidity, DEFAULT_ENVIRONMENT.humidity, 0, 100),
    health: finite(env.health, DEFAULT_ENVIRONMENT.health, 0, 100),
  };
  const rawLedger = Array.isArray(value.ledger) ? value.ledger : [];
  const ledger: LedgerEntry[] = rawLedger.filter((item: unknown) => record(item)
    && typeof item.id === "string" && typeof item.day === "number" && Number.isFinite(item.day)
    && typeof item.category === "string" && typeof item.description === "string"
    && typeof item.amount === "number" && Number.isFinite(item.amount)
    && typeof item.balance === "number" && Number.isFinite(item.balance)
  ).slice(-499) as LedgerEntry[];
  if (ledger.length === 0) ledger.push({ id: String(value.simulationSeed) + ":opening-balance", day: Math.floor(finite(value.day, 1, 1, 1_000_000_000)), category: "other", description: "Opening balance carried forward", amount: 0, balance: finite(value.cash, 0, 0, 1_000_000_000) });
  const financialStatus: FinancialStatus = value.financialStatus === "arrears" || finite(value.financeArrears, 0, 0, 1_000_000_000) > 0 ? "arrears" : "solvent";
  const repaired = (value.saveFormatVersion === SAVE_FORMAT_VERSION ? 0 : 1)
    + (Array.isArray(value.ledger) ? 0 : 1)
    + (typeof value.financeArrears === "number" && Number.isFinite(value.financeArrears) ? 0 : 1)
    + (record(value.staffState) ? 0 : 1)
    + (record(value.facilityLevels) ? 0 : 1);
  const state = {
    ...value,
    version: 1 as const,
    saveFormatVersion: SAVE_FORMAT_VERSION,
    savedAt: finite(value.savedAt, now, 0, Number.MAX_SAFE_INTEGER),
    simulationSeed: value.simulationSeed,
    specimens: value.specimens,
    breedingProjects: value.breedingProjects,
    cash: finite(value.cash, 0, 0, 1_000_000_000),
    research: finite(value.research, 0, 0, 1_000_000_000),
    day: finite(value.day, 1, 1, 1_000_000_000),
    projectStarted: value.projectStarted === true,
    analysisEquipmentLevel: finite(value.analysisEquipmentLevel, 0, 0, 3),
    greenhouseEnvironment: environment,
    researchUnlocks: value.researchUnlocks.filter((item: unknown): item is string => typeof item === "string"),
    facilityLevels: normalizeFacilityLevels(record(value.facilityLevels) ? value.facilityLevels : undefined),
    staffState: normalizeStaffState(record(value.staffState) ? value.staffState : DEFAULT_STAFF_STATE),
    ledger,
    financeArrears: finite(value.financeArrears, 0, 0, 1_000_000_000),
    financialStatus,
  } as unknown as GameState;
  return { state, repaired };
}

export function serializeGameSave(state: GameState, now = Date.now()): string {
  return JSON.stringify({ ...state, saveFormatVersion: SAVE_FORMAT_VERSION, savedAt: now });
}

export function preserveRecoveryPayload(storage: Pick<Storage, "getItem" | "setItem">, key: string, raw: string): boolean {
  try {
    const recoveryKey = key + SAVE_BACKUP_SUFFIX;
    if (storage.getItem(recoveryKey) === null) storage.setItem(recoveryKey, raw);
    return true;
  } catch {
    return false;
  }
}

export function rotateAndWriteSave(
  storage: Pick<Storage, "getItem" | "setItem">,
  key: string,
  state: GameState,
  now = Date.now(),
): { ok: boolean; reason?: string } {
  try {
    const raw = serializeGameSave(state, now);
    if (raw.length > MAX_SAVE_BYTES) return { ok: false, reason: "Save exceeds the 5 MB safety limit." };
    const current = storage.getItem(key);
    if (current !== null) {
      const previousBackup = storage.getItem(key + ".backup");
      if (previousBackup !== null) storage.setItem(key + ".backup.previous", previousBackup);
      storage.setItem(key + ".backup", current);
    }
    storage.setItem(key, raw);
    return { ok: true };
  } catch {
    return { ok: false, reason: "Browser storage rejected the save. Existing save data was left untouched where possible." };
  }
}
