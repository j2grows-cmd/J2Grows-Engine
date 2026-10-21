import { advanceGameDay, type GameState } from "./engine.ts";

export const OFFLINE_PROGRESS_INTERVAL_MS = 60 * 60 * 1000;
export const MAX_OFFLINE_PROGRESS_DAYS = 14;

/** Returns whole in-game days earned while away, with a one-hour interval and a hard cap. */
export function getOfflineProgressDays(savedAt: number, now: number, enabled = true): number {
  if (!enabled || !Number.isFinite(savedAt) || !Number.isFinite(now) || now <= savedAt) return 0;
  return Math.min(MAX_OFFLINE_PROGRESS_DAYS, Math.floor((now - savedAt) / OFFLINE_PROGRESS_INTERVAL_MS));
}

/** Replays the normal deterministic daily simulation for bounded offline time. */
export function applyOfflineProgress(state: GameState, now = Date.now()): { state: GameState; daysAdvanced: number } {
  const days = getOfflineProgressDays(state.savedAt ?? now, now, state.offlineProgressEnabled);
  let next = state;
  for (let day = 0; day < days; day++) next = advanceGameDay(next).state;
  return { state: { ...next, savedAt: now }, daysAdvanced: days };
}
