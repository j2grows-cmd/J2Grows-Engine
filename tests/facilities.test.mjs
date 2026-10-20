import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ENVIRONMENT } from "../src/game/genetics.ts";
import { applyEnvironmentalController, canPurchaseFacilityUpgrade, nextFacilityUpgradeCost, normalizeFacilityLevels, propagationDaysRequired, weeklyFacilityOperatingCost } from "../src/game/facilities.ts";

const empty = { propagationBench: 0, environmentalController: 0 };

test("facility upgrades have progressive prices, enforce maximum level and reject invalid purchases", () => {
  assert.equal(nextFacilityUpgradeCost("Propagation bench", empty, 0), 1200);
  assert.equal(nextFacilityUpgradeCost("Propagation bench", { ...empty, propagationBench: 1 }, 0), 2400);
  assert.equal(nextFacilityUpgradeCost("Environmental controller", empty, 0), 2400);
  assert.equal(nextFacilityUpgradeCost("Analysis workstation", empty, 2), 105);
  assert.equal(nextFacilityUpgradeCost("Analysis workstation", empty, 3), null);
  assert.equal(nextFacilityUpgradeCost("Made-up upgrade", empty, 0), null);
  assert.equal(canPurchaseFacilityUpgrade("Propagation bench", empty, 0, 1199), false);
  assert.equal(canPurchaseFacilityUpgrade("Propagation bench", empty, 0, 1200), true);
  assert.equal(canPurchaseFacilityUpgrade("Analysis workstation", empty, 0, Number.NaN), false);
});

test("environmental controller improves growing conditions without exceeding bounds or mutating base settings", () => {
  const base = { ...DEFAULT_ENVIRONMENT, light: 70, nutrition: 95, humidity: 98 };
  const improved = applyEnvironmentalController(base, 2);
  assert.equal(improved.light, 80);
  assert.equal(improved.nutrition, 100);
  assert.equal(improved.humidity, 100);
  assert.equal(base.light, 70);
  assert.equal(applyEnvironmentalController(base, 0).light, 70);
});

test("propagation bench shortens each phase but never makes it instantaneous", () => {
  assert.equal(propagationDaysRequired(5, 0), 5);
  assert.equal(propagationDaysRequired(5, 2), 3);
  assert.equal(propagationDaysRequired(1, 3), 1);
});

test("weekly operating costs include owned facilities and automation", () => {
  assert.equal(weeklyFacilityOperatingCost(empty, 0, false), 0);
  assert.equal(weeklyFacilityOperatingCost({ propagationBench: 2, environmentalController: 1 }, 1, true), 26);
});

test("facility levels migrate safely from old saves and clamp malformed or excessive values", () => {
  assert.deepEqual(normalizeFacilityLevels(undefined), empty);
  assert.deepEqual(normalizeFacilityLevels({ propagationBench: 2 }), { propagationBench: 2, environmentalController: 0 });
  assert.deepEqual(normalizeFacilityLevels({ propagationBench: 99, environmentalController: -3 }), { propagationBench: 3, environmentalController: 0 });
  assert.deepEqual(normalizeFacilityLevels({ propagationBench: Number.NaN, environmentalController: 1.8 }), { propagationBench: 0, environmentalController: 1 });
});
