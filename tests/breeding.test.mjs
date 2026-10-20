import test from "node:test";
import assert from "node:assert/strict";
import { assessCrossEligibility, createBreedingIdentity, forecastTraitTargeting } from "../src/game/breeding.ts";

const parent = (overrides = {}) => ({ id: "plant-a", genus: "Alocasia", stage: "Breeding-ready", health: 90, ...overrides });

test("cross eligibility rejects self-crosses, incompatible genera, unhealthy and reserved parents", () => {
  assert.equal(assessCrossEligibility(parent(), parent({ id: "plant-b" })).eligible, true);
  assert.equal(assessCrossEligibility(parent(), parent()).eligible, false);
  assert.equal(assessCrossEligibility(parent(), parent({ id: "plant-b", genus: "Anthurium" })).reason, "This prototype supports crosses within the same genus.");
  assert.equal(assessCrossEligibility(parent(), parent({ id: "plant-b", health: 0 })).eligible, false);
  assert.equal(assessCrossEligibility(parent(), parent({ id: "plant-b", reserved: true })).eligible, false);
  assert.equal(assessCrossEligibility(parent(), parent({ id: "plant-b", stage: "Mature" })).eligible, false);
});

test("breeding identities are stable, sanitised and independent of parent selection order", () => {
  const first = createBreedingIdentity(12, 3, "specimen/a", "specimen-b");
  assert.deepEqual(first, createBreedingIdentity(12, 3, "specimen-b", "specimen/a"));
  assert.equal(first.projectId, "BRD-12-3-specimen-a--specimen-b");
  assert.equal(first.lineId, "LINE-12-specimen-a--specimen-b");
  assert.notEqual(first.projectId, createBreedingIdentity(13, 3, "specimen/a", "specimen-b").projectId);
});

test("trait targeting forecast is probabilistic, bounded and cannot guarantee improvement", () => {
  const a = { variegationPotential: 90, stability: 80, hiddenPotential: 60, growthPotential: 50, mutationGenePresent: false, mutationIds: [] };
  const b = { variegationPotential: 30, stability: 40, hiddenPotential: 60, growthPotential: 70, mutationGenePresent: false, mutationIds: [] };
  const forecast = forecastTraitTargeting(a, b, "variegationPotential");
  assert.equal(forecast.baselineMean, 60);
  assert.equal(forecast.strongestParent, 90);
  assert.equal(forecast.probabilityOfNudge, 0.7);
  assert.ok(forecast.expectedMeanAfterTargeting > forecast.baselineMean);
  assert.ok(forecast.expectedMeanAfterTargeting < forecast.strongestParent);
});
