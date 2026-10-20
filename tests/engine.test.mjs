import test from "node:test";
import assert from "node:assert/strict";
import { createGameState, purchasePlant, sellPlant, setSpecimenProtection, observeSpecimen, advanceGameDay, startMutationAnalysis, unlockResearchNode } from "../src/game/engine.ts";
import { findSpecies, species } from "../src/data.ts";

test("new game is headless and starts with the intended economy", () => {
  const state = createGameState("test-seed");
  assert.equal(state.cash, 100);
  assert.equal(state.day, 1);
  assert.equal(state.specimens.length, 0);
  assert.equal(state.simulationSeed, "test-seed");
});

test("purchase charges the player and adds a unique specimen", () => {
  const state = createGameState("purchase-test");
  const plant = species[0] ?? findSpecies("alocasia-polly");
  const result = purchasePlant(state, plant);
  assert.equal(result.ok, true);
  assert.equal(result.state.specimens.length, 1);
  assert.ok(result.state.cash < state.cash);
  assert.equal(result.state.specimens[0].speciesId, plant.id);
  assert.ok(result.state.specimens[0].id);
});

test("protected specimens cannot be sold until protection is removed", () => {
  const state = createGameState("sell-test");
  const bought = purchasePlant(state, species[0] ?? findSpecies("alocasia-polly"));
  const id = bought.state.specimens[0].id;
  const protectedResult = setSpecimenProtection(bought.state, id, true);
  const blocked = sellPlant(protectedResult.state, id);
  assert.equal(blocked.ok, false);
  const unprotected = setSpecimenProtection(protectedResult.state, id, false);
  const sold = sellPlant(unprotected.state, id);
  assert.equal(sold.ok, true);
  assert.equal(sold.state.specimens.length, 0);
});

test("a specimen cannot be observed twice on the same simulation day", () => {
  const bought = purchasePlant(createGameState("observe-test"), species[0] ?? findSpecies("alocasia-polly"));
  const id = bought.state.specimens[0].id;
  const first = observeSpecimen(bought.state, id);
  const second = observeSpecimen(first.state, id);
  assert.equal(first.ok, true);
  assert.equal(first.state.research, 2);
  assert.equal(second.ok, false);
  assert.equal(second.state.research, 2);
});

test("advancing the day updates simulation time without mutating the prior state", () => {
  const initial = createGameState("day-test");
  const advanced = advanceGameDay(initial);
  assert.equal(advanced.ok, true);
  assert.equal(advanced.state.day, 2);
  assert.equal(initial.day, 1);
});

test("research unlocks enforce costs and prerequisites", () => {
  const initial = createGameState("research-test");
  const blocked = unlockResearchNode(initial, "mutation-screening");
  assert.equal(blocked.ok, false);
  assert.equal(blocked.state.research, 0);
});

test("mutation analysis cannot start without a living specimen", () => {
  const result = startMutationAnalysis(createGameState("analysis-test"), "missing-specimen");
  assert.equal(result.ok, false);
  assert.equal(result.state.cash, 100);
});
