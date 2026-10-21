import test from "node:test";
import assert from "node:assert/strict";
import { getOfflineProgressDays, applyOfflineProgress, MAX_OFFLINE_PROGRESS_DAYS, OFFLINE_PROGRESS_INTERVAL_MS } from "../src/game/offline-progress.ts";
import { createGameState } from "../src/game/engine.ts";

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


test("offline progress replays the daily engine and advances the saved timestamp", () => {
  const savedAt = 10_000;
  const state = { ...createGameState("offline-replay"), savedAt, offlineProgressEnabled: true };
  const result = applyOfflineProgress(state, savedAt + OFFLINE_PROGRESS_INTERVAL_MS * 3);
  assert.equal(result.daysAdvanced, 3);
  assert.equal(result.state.day, state.day + 3);
  assert.equal(result.state.savedAt, savedAt + OFFLINE_PROGRESS_INTERVAL_MS * 3);
});

test("disabled offline progress advances no days but refreshes the timestamp", () => {
  const savedAt = 20_000;
  const state = { ...createGameState("offline-disabled"), savedAt, offlineProgressEnabled: false };
  const result = applyOfflineProgress(state, savedAt + OFFLINE_PROGRESS_INTERVAL_MS * 4);
  assert.equal(result.daysAdvanced, 0);
  assert.equal(result.state.day, state.day);
  assert.equal(result.state.savedAt, savedAt + OFFLINE_PROGRESS_INTERVAL_MS * 4);
});
