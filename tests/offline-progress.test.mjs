import test from "node:test";
import assert from "node:assert/strict";
import { getOfflineProgressDays, MAX_OFFLINE_PROGRESS_DAYS, OFFLINE_PROGRESS_INTERVAL_MS } from "../src/game/offline-progress.ts";

test("offline progress awards one simulated day per full real-life hour", () => {
  const savedAt = 1_000_000;
  assert.equal(getOfflineProgressDays(savedAt, savedAt + OFFLINE_PROGRESS_INTERVAL_MS - 1), 0);
  assert.equal(getOfflineProgressDays(savedAt, savedAt + OFFLINE_PROGRESS_INTERVAL_MS), 1);
  assert.equal(getOfflineProgressDays(savedAt, savedAt + OFFLINE_PROGRESS_INTERVAL_MS * 3 + 15), 3);
});

test("offline progress is capped at fourteen days", () => {
  const savedAt = 1_000_000;
  assert.equal(MAX_OFFLINE_PROGRESS_DAYS, 14);
  assert.equal(getOfflineProgressDays(savedAt, savedAt + OFFLINE_PROGRESS_INTERVAL_MS * 40), 14);
});

test("offline progress can be disabled and ignores invalid or backwards timestamps", () => {
  const savedAt = 1_000_000;
  assert.equal(getOfflineProgressDays(savedAt, savedAt + OFFLINE_PROGRESS_INTERVAL_MS * 4, false), 0);
  assert.equal(getOfflineProgressDays(Number.NaN, savedAt + OFFLINE_PROGRESS_INTERVAL_MS), 0);
  assert.equal(getOfflineProgressDays(savedAt, Number.NaN), 0);
  assert.equal(getOfflineProgressDays(savedAt, savedAt - 1), 0);
});
