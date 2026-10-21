import test from "node:test";
import assert from "node:assert/strict";
import { createGameState, purchasePlant, advanceGameDay } from "../src/game/engine.ts";
import { species } from "../src/data.ts";

test("daily simulation processes a large specimen collection without dropping records", () => {
  const bought = purchasePlant(createGameState("large-collection"), species[0]);
  const template = bought.state.specimens[0];
  const count = 10_000;
  const state = {
    ...bought.state,
    specimens: Array.from({ length: count }, (_, index) => ({
      ...template,
      id: "performance-specimen-" + index,
      nickname: "Specimen " + index,
      health: 80,
      stage: "Juvenile",
      stageDays: 0,
    })),
  };
  const advanced = advanceGameDay(state);
  assert.equal(advanced.state.day, state.day + 1);
  assert.equal(advanced.state.specimens.length, count);
  assert.equal(new Set(advanced.state.specimens.map((specimen) => specimen.id)).size, count);
});
