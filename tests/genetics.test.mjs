import test from "node:test";
import assert from "node:assert/strict";
import { SPECIES_ECONOMY, getSpeciesEconomy, STARTING_CASH } from "../src/game/catalog.ts";
import { species } from "../src/data.ts";
import { createSeededRandom } from "../src/game/random.ts";
import { phenotypeFromGenome } from "../src/game/alleles.ts";
import { calculateHealthFactor, calculateMaturityFactor, calculateSpecimenValue, environmentalSuitability, getShopAvailability, growVariegation, inheritGenetics, observePlant, analyseGenetics, createSpecimenGenetics } from "../src/game/genetics.ts";

test("catalogue has unique species and positive prices", () => {
  assert.ok(SPECIES_ECONOMY.length > 0);
  assert.ok(species.length > 0, "offline catalogue should contain species");
  assert.equal(new Set(species.map((plant) => plant.id)).size, species.length, "offline species IDs must be unique");
  assert.equal(new Set(SPECIES_ECONOMY.map((item) => item.name.toLowerCase())).size, SPECIES_ECONOMY.length);
  assert.ok(SPECIES_ECONOMY.every((item) => item.basePrice > 0));
  assert.equal(STARTING_CASH, 100);
  assert.equal(getSpeciesEconomy("Alocasia Amazonica")?.basePrice, 15);
  assert.equal(getSpeciesEconomy("philodendron-luxurians")?.basePrice, 45);
});

test("health and maturity valuation bands follow the proposed rules", () => {
  assert.equal(calculateHealthFactor(100), 1);
  assert.equal(calculateHealthFactor(89), 0.85);
  assert.equal(calculateHealthFactor(74), 0.6);
  assert.equal(calculateHealthFactor(49), 0.3);
  assert.equal(calculateHealthFactor(24), 0.1);
  assert.equal(calculateHealthFactor(0), 0);
  assert.equal(calculateMaturityFactor("Juvenile"), 1);
  assert.equal(calculateMaturityFactor("Growing"), 1.25);
  assert.equal(calculateMaturityFactor("Mature"), 1.6);
});

test("strong stable variegation is worth more than weak unstable variegation", () => {
  const base = { basePrice: 20, health: 100, stage: "Juvenile" };
  const strong = calculateSpecimenValue({ ...base, variegationStrength: 80, stability: 90 });
  const weak = calculateSpecimenValue({ ...base, variegationStrength: 15, stability: 25 });
  assert.ok(strong > weak);
  assert.equal(calculateSpecimenValue({ ...base, variegationStrength: 0, stability: 20 }), 20, "base price is neutral for a non-variegated juvenile");
  assert.equal(calculateSpecimenValue({ ...base, variegationStrength: 80, stability: 90, health: 0 }), 0);
});

test("inheritance blends parental profiles with bounded variation", () => {
  const a = { variegationPotential: 90, stability: 80, hiddenPotential: 75, growthPotential: 60, mutationIds: ["a"] };
  const b = { variegationPotential: 50, stability: 60, hiddenPotential: 45, growthPotential: 40, mutationIds: ["b"] };
  const child = inheritGenetics(a, b, () => 0.5);
  assert.equal(child.variegationPotential, 70);
  assert.equal(child.stability, 70);
  assert.ok(child.mutationIds.every((id) => ["a", "b"].includes(id)));
});

test("environment changes suitability and variegation expression is bounded", () => {
  const profile = { variegationPotential: 80, stability: 70, hiddenPotential: 50, growthPotential: 50, mutationIds: [] };
  const good = { light: 65, nutrition: 65, humidity: 65, health: 100 };
  const poor = { light: 0, nutrition: 0, humidity: 0, health: 20 };
  assert.ok(environmentalSuitability(good) > environmentalSuitability(poor));
  const result = growVariegation(profile, good, 70, () => 0.5);
  assert.ok(result.expression >= 0 && result.expression <= 100);
  assert.equal(result.reverted, false);
});

test("observation earns research and genetic analysis spends it", () => {
  const record = {
    genetics: { variegationPotential: 70, stability: 80, hiddenPotential: 75, growthPotential: 50, mutationIds: [] },
    expression: 70, environment: { light: 65, nutrition: 65, humidity: 65, health: 100 },
    observations: [], research: { points: 0, observationCount: 0, analysisLevel: 0, discoveredTraits: [], mutations: [] },
  };
  const observedOnce = observePlant(record);
  assert.equal(observedOnce.research.points, 2);
  assert.equal(observedOnce.research.observationCount, 1);
  assert.equal(analyseGenetics(observedOnce, 25), null);
  const observedTwice = observePlant(observedOnce);
  const observed = observePlant(observedTwice);
  assert.equal(observed.research.observationCount, 3);
  const funded = { ...observed, research: { ...observed.research, points: 30 } };
  const analysed = analyseGenetics(funded, 25);
  assert.ok(analysed);
  assert.equal(analysed.research.points, 5);
  assert.ok(analysed.research.discoveredTraits.includes("visible-trait-profile"));
});

test("mutation strength controls observation confirmation and equipment can confirm weak phenotypes", () => {
  const base = {
    genetics: { variegationPotential: 0, stability: 70, hiddenPotential: 50, growthPotential: 50, mutationGenePresent: false, mutationIds: ["strong", "weak"] },
    expression: 0, environment: { light: 65, nutrition: 65, humidity: 65, health: 100 },
    observations: [], research: { points: 0, observationCount: 0, analysisLevel: 0, discoveredTraits: [], mutations: [
      { id: "strong", name: "Strong phenotype", category: "colour", rarity: "Rare", inheritance: "mixed", strength: 21, stability: 64, detected: false, beneficial: null, evidenceCount: 0 },
      { id: "weak", name: "Weak phenotype", category: "growth", rarity: "Minor", inheritance: "unstable", strength: 20, stability: 28, detected: false, beneficial: null, evidenceCount: 0 },
    ] },
  };
  const first = observePlant(base);
  assert.equal(first.research.mutations.find((mutation) => mutation.id === "strong").detected, true, "strength above 20% confirms on first observation");
  assert.equal(first.research.mutations.find((mutation) => mutation.id === "weak").detected, false, "strength at 20% is not above the threshold");
  const second = observePlant(first);
  assert.equal(second.research.mutations.find((mutation) => mutation.id === "weak").detected, false);
  const third = observePlant(second);
  assert.equal(third.research.mutations.find((mutation) => mutation.id === "weak").detected, true, "three observations confirm a weak phenotype");
  const equipmentConfirmed = observePlant(base, base.expression, true);
  assert.equal(equipmentConfirmed.research.mutations.find((mutation) => mutation.id === "weak").detected, true, "equipped analysis can confirm a weak phenotype");
});

test("rarity affects shop availability", () => {
  assert.equal(getShopAvailability("Common", () => 0.5), true);
  assert.equal(getShopAvailability("Mythic", () => 0.5), false);
});

test("mutation carriers receive a latent record before analysis and can be replayed from a seed", () => {
  let carrier;
  for (let seed = 0; seed < 100; seed += 1) {
    const candidate = createSpecimenGenetics(0, createSeededRandom(seed));
    if (candidate.genetics.mutationGenePresent) { carrier = candidate; break; }
  }
  assert.ok(carrier, "the seeded fixture search should find a mutation carrier");
  assert.ok(carrier.genetics.mutationIds.length > 0);
  assert.equal(carrier.research.mutations.length, 1);
  assert.equal(carrier.research.mutations[0].detected, false);
  assert.equal(carrier.research.mutations[0].origin, "latent");
  const replay = createSpecimenGenetics(0, createSeededRandom(0));
  const replayAgain = createSpecimenGenetics(0, createSeededRandom(0));
  assert.deepEqual(replay.research.mutations, replayAgain.research.mutations);
});

test("mutation carrier inheritance follows independent Mendelian transmission probabilities", () => {
  const profile = (carrier, mutationIds = []) => ({ variegationPotential: 50, stability: 50, hiddenPotential: 50, growthPotential: 50, mutationGenePresent: carrier, mutationIds });
  let bothCarrierCount = 0;
  let oneCarrierCount = 0;
  const trials = 3000;
  for (let index = 0; index < trials; index += 1) {
    if (inheritGenetics(profile(true), profile(true), createSeededRandom("both-" + index)).mutationGenePresent) bothCarrierCount += 1;
    if (inheritGenetics(profile(true), profile(false), createSeededRandom("one-" + index)).mutationGenePresent) oneCarrierCount += 1;
  }
  const bothRate = bothCarrierCount / trials;
  const oneRate = oneCarrierCount / trials;
  assert.ok(bothRate > 0.70 && bothRate < 0.80, "two heterozygous carriers should produce about 75% carriers");
  assert.ok(oneRate > 0.45 && oneRate < 0.55, "one carrier and one non-carrier should produce about 50% carriers");
});

test("mutation records are not guaranteed to pass to every offspring", () => {
  const a = { variegationPotential: 50, stability: 50, hiddenPotential: 50, growthPotential: 50, mutationGenePresent: false, mutationIds: ["mutation-a"] };
  const b = { ...a, mutationIds: [] };
  const childA = inheritGenetics(a, b, createSeededRandom("mutation-child"));
  const childB = inheritGenetics(a, b, createSeededRandom("mutation-child"));
  assert.deepEqual(childA, childB);
  assert.ok(childA.mutationIds.length <= 1);
});
test("offspring numeric traits remain consistent with their heritable genome after spontaneous mutation", () => {
  const genome = { variegation:{maternal:"5",paternal:"5"}, stability:{maternal:"5",paternal:"5"}, growth:{maternal:"5",paternal:"5"}, hiddenPotential:{maternal:"5",paternal:"5"} };
  const parent = { variegationPotential:50, stability:50, hiddenPotential:50, growthPotential:50, mutationGenePresent:false, mutationIds:[], genome };
  let mutatedChild;
  for (let seed = 0; seed < 500; seed += 1) {
    const candidate = inheritGenetics(parent, parent, createSeededRandom("genome-mutation-" + seed));
    if (candidate.mutationIds.some((id) => id.startsWith("spontaneous-"))) { mutatedChild = candidate; break; }
  }
  assert.ok(mutatedChild, "seeded fixtures should include a spontaneous mutation");
  assert.ok(mutatedChild.genome);
  const phenotype = phenotypeFromGenome(mutatedChild.genome);
  assert.equal(mutatedChild.variegationPotential, phenotype.variegationPotential);
  assert.equal(mutatedChild.stability, phenotype.stability);
  assert.equal(mutatedChild.growthPotential, phenotype.growthPotential);
  assert.equal(mutatedChild.hiddenPotential, phenotype.hiddenPotential);
});