export const OFFLINE_PROGRESS_INTERVAL_MS = 60 * 60 * 1000;
export const MAX_OFFLINE_PROGRESS_DAYS = 14;

/** Returns whole in-game days earned while away, with a one-hour interval and a hard cap. */
export function getOfflineProgressDays(savedAt: number, now: number, enabled = true): number {
  if (!enabled || !Number.isFinite(savedAt) || !Number.isFinite(now) || now <= savedAt) return 0;
  return Math.min(MAX_OFFLINE_PROGRESS_DAYS, Math.floor((now - savedAt) / OFFLINE_PROGRESS_INTERVAL_MS));
}
