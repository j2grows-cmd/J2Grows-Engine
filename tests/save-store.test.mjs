import test from "node:test";
import assert from "node:assert/strict";
import { createGameState, purchasePlant, sellPlant, advanceGameDay } from "../src/game/engine.ts";
import { species } from "../src/data.ts";
import { normalizeGameSave, rotateAndWriteSave, serializeGameSave } from "../src/game/save-store.ts";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    dump() { return values; },
  };
}

test("legacy engine saves are normalized with finance defaults and an opening ledger balance", () => {
  const legacy = { ...createGameState("legacy-save"), cash: 275 };
  delete legacy.ledger;
  delete legacy.financeArrears;
  delete legacy.financialStatus;
  delete legacy.savedAt;
  const normalized = normalizeGameSave(legacy, 1234);
  assert.ok(normalized.state);
  assert.equal(normalized.state.cash, 275);
  assert.equal(normalized.state.financeArrears, 0);
  assert.equal(normalized.state.financialStatus, "solvent");
  assert.equal(normalized.state.ledger[0].balance, 275);
  assert.equal(normalized.state.savedAt, 1234);
  assert.ok(normalized.repaired > 0);
});

test("save normalization rejects malformed specimen and unsupported game-state versions", () => {
  assert.equal(normalizeGameSave(null).state, null);
  assert.equal(normalizeGameSave({ ...createGameState(), version: 99 }).state, null);
  const malformed = { ...createGameState(), specimens: [{ id: "broken" }] };
  assert.equal(normalizeGameSave(malformed).state, null);
});

test("autosave rotates the previous valid payload and writes versioned metadata", () => {
  const storage = memoryStorage();
  const first = createGameState("save-rotation");
  assert.equal(rotateAndWriteSave(storage, "game", first, 100).ok, true);
  const firstRaw = storage.getItem("game");
  const second = { ...first, day: 2 };
  assert.equal(rotateAndWriteSave(storage, "game", second, 200).ok, true);
  assert.equal(storage.getItem("game.backup"), firstRaw);
  const parsed = JSON.parse(storage.getItem("game"));
  assert.equal(parsed.saveFormatVersion, 1);
  assert.equal(parsed.savedAt, 200);
  assert.equal(parsed.day, 2);
  assert.equal(JSON.parse(serializeGameSave(first, 300)).savedAt, 300);
});

test("cash-changing actions are recorded in the ledger", () => {
  const state = createGameState("ledger-purchase");
  const plant = species[0];
  const purchased = purchasePlant(state, plant);
  assert.equal(purchased.ok, true);
  assert.equal(purchased.state.ledger.length, 1);
  assert.equal(purchased.state.ledger[0].amount, purchased.state.cash - state.cash);
  assert.equal(purchased.state.ledger[0].balance, purchased.state.cash);
  const specimen = purchased.state.specimens[0];
  const sold = sellPlant(purchased.state, specimen.id);
  assert.equal(sold.ok, true);
  assert.equal(sold.state.ledger.length, 2);
  assert.ok(sold.state.ledger[1].amount > 0);
});

test("weekly staff costs are charged once on day seven and unpaid costs become arrears", () => {
  let state = createGameState("weekly-costs");
  for (let i = 0; i < 6; i++) state = advanceGameDay(state).state;
  assert.equal(state.day, 7);
  assert.equal(state.cash, 92);
  assert.equal(state.ledger.filter((entry) => entry.category === "operating-cost").length, 1);
  assert.equal(state.financeArrears, 0);

  let poor = { ...createGameState("arrears"), cash: 2, ledger: [{ id: "opening", day: 1, category: "other", description: "Opening balance", amount: 0, balance: 2 }] };
  for (let i = 0; i < 6; i++) poor = advanceGameDay(poor).state;
  assert.equal(poor.cash, 0);
  assert.equal(poor.financeArrears, 6);
  assert.equal(poor.financialStatus, "arrears");
});

test("positive cash flow automatically settles outstanding operating-cost arrears", () => {
  const bought = purchasePlant(createGameState("arrears-repayment"), species[0]);
  const specimen = bought.state.specimens[0];
  const state = {
    ...bought.state,
    cash: 50,
    financeArrears: 10,
    financialStatus: "arrears",
    ledger: [{ id: "opening", day: 1, category: "other", description: "Opening balance", amount: 0, balance: 50 }],
    specimens: bought.state.specimens.map((item) => item.id === specimen.id ? { ...item, value: 30 } : item),
  };
  const sold = sellPlant(state, specimen.id);
  assert.equal(sold.ok, true);
  assert.equal(sold.state.financeArrears, 0);
  assert.equal(sold.state.financialStatus, "solvent");
  assert.equal(sold.state.cash, 70);
  assert.equal(sold.state.ledger.at(-1).description, "Automatic repayment of outstanding operating-cost arrears");
  assert.equal(sold.state.ledger.at(-1).amount, -10);
});
