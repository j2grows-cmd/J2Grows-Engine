import test from "node:test";
import assert from "node:assert/strict";
import { createGameState, purchasePlant, sellPlant, setSpecimenProtection, observeSpecimen, advanceGameDay, startMutationAnalysis, unlockResearchNode, startBreeding, setGreenhouseEnvironment, beginStaffTraining, propagatePlant, treatSpecimen, borrowFunds, repayLoan, liquidateAssets, fulfillCustomerOrder, hireEmployee, dismissEmployee } from "../src/game/engine.ts";
import { findSpecies, species } from "../src/data.ts";
import { getMarketOffer } from "../src/game/market.ts";

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


test("breeding rejects mature parents until both are breeding-ready", () => {
  const plant = species.find((candidate) => candidate.latin.split(" ")[0] === "Alocasia") ?? species[0] ?? findSpecies("alocasia-polly");
  const first = purchasePlant(createGameState("breeding-eligibility"), plant);
  const second = purchasePlant(first.state, plant);
  const [a, b] = second.state.specimens;
  const matureState = {
    ...second.state,
    specimens: second.state.specimens.map((specimen) => ({ ...specimen, stage: "Mature" })),
  };
  const blocked = startBreeding(matureState, a.id, b.id);
  assert.equal(blocked.ok, false);
  assert.match(blocked.message, /breeding-ready/i);

  const readyState = {
    ...second.state,
    specimens: second.state.specimens.map((specimen) => ({ ...specimen, stage: "Breeding-ready" })),
  };
  const started = startBreeding(readyState, a.id, b.id);
  assert.equal(started.ok, true);
  assert.equal(started.state.breedingProjects.length, 1);
  assert.ok(started.state.specimens.every((specimen) => specimen.reservedByProjectId));
});

test("greenhouse controls clamp values to the supported 0–100 range", () => {
  const initial = createGameState("environment-clamp");
  const changed = setGreenhouseEnvironment(initial, { light: 140, humidity: -20, nutrition: Number.NaN });
  assert.equal(changed.state.greenhouseEnvironment.light, 100);
  assert.equal(changed.state.greenhouseEnvironment.humidity, 0);
  assert.equal(changed.state.greenhouseEnvironment.nutrition, initial.greenhouseEnvironment.nutrition);
});

test("staff training charges once and refuses a second concurrent course", () => {
  const initial = createGameState("staff-training");
  const started = beginStaffTraining(initial);
  assert.equal(started.ok, true);
  assert.equal(started.state.cash, initial.cash - 25);
  assert.equal(started.state.staffState.trainingDaysRemaining, 3);
  const duplicate = beginStaffTraining(started.state);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.state.cash, started.state.cash);
});


test("day advancement preserves dead specimens at zero health and zero value", () => {
  const bought = purchasePlant(createGameState("dead-day-test"), species[0] ?? findSpecies("alocasia-polly"));
  const id = bought.state.specimens[0].id;
  const damaged = {
    ...bought.state,
    specimens: bought.state.specimens.map((specimen) =>
      specimen.id === id ? { ...specimen, health: 0, dead: true, value: 50 } : specimen
    ),
  };
  const advanced = advanceGameDay(damaged);
  const dead = advanced.state.specimens.find((specimen) => specimen.id === id);
  assert.equal(advanced.state.day, damaged.day + 1);
  assert.equal(dead.dead, true);
  assert.equal(dead.health, 0);
  assert.equal(dead.value, 0);
});

test("day advancement completes mutation analysis once and clears project state", () => {
  const bought = purchasePlant(createGameState("analysis-completion-test"), species[0] ?? findSpecies("alocasia-polly"));
  const id = bought.state.specimens[0].id;
  const started = startMutationAnalysis(bought.state, id);
  assert.equal(started.ok, true);
  let state = started.state;
  state = { ...state, day: state.day + 2 };
  const completed = advanceGameDay(state);
  const specimen = completed.state.specimens.find((item) => item.id === id);
  assert.equal(completed.state.projectStarted, false);
  assert.equal(completed.state.analysisTargetSpecimenId, undefined);
  assert.equal(completed.state.research, 10);
  assert.equal(specimen.mutationAnalysisCompleted, true);
  const next = advanceGameDay(completed.state);
  assert.equal(next.state.research, 10);
});

test("completed breeding projects release both parents and create one offspring", () => {
  const plant = species.find((candidate) => candidate.latin.split(" ")[0] === "Alocasia") ?? species[0] ?? findSpecies("alocasia-polly");
  const one = purchasePlant(createGameState("breeding-completion-test"), plant);
  const two = purchasePlant(one.state, plant);
  const [a, b] = two.state.specimens;
  const ready = {
    ...two.state,
    specimens: two.state.specimens.map((specimen) => ({ ...specimen, stage: "Breeding-ready", health: 100 })),
  };
  const started = startBreeding(ready, a.id, b.id);
  assert.equal(started.ok, true);
  const project = started.state.breedingProjects[0];
  const primed = {
    ...started.state,
    breedingProjects: started.state.breedingProjects.map((item) => ({ ...item, completesOnDay: started.state.day + 1, failureChance: 0 })),
  };
  const completed = advanceGameDay(primed);
  const finished = completed.state.breedingProjects.find((item) => item.id === project.id);
  assert.equal(finished.status, "completed");
  assert.equal(completed.state.specimens.length, 3);
  assert.ok(completed.state.specimens.filter((specimen) => specimen.id === a.id || specimen.id === b.id).every((specimen) => !specimen.reservedByProjectId));
});


test("mutation analysis cancels without reward when its target dies", () => {
  const bought = purchasePlant(createGameState("analysis-target-dies"), species[0] ?? findSpecies("alocasia-polly"));
  const id = bought.state.specimens[0].id;
  const started = startMutationAnalysis(bought.state, id);
  assert.equal(started.ok, true);
  const doomed = {
    ...started.state,
    day: started.state.day + 2,
    specimens: started.state.specimens.map((specimen) =>
      specimen.id === id ? { ...specimen, health: 0, dead: true, value: 0 } : specimen
    ),
  };
  const result = advanceGameDay(doomed);
  assert.equal(result.state.projectStarted, false);
  assert.equal(result.state.analysisTargetSpecimenId, undefined);
  assert.equal(result.state.research, 0);
  assert.equal(result.state.specimens.find((specimen) => specimen.id === id).mutationAnalysisCompleted, undefined);
  assert.match(result.message, /cancelled/i);
});


test("dead specimens cannot be propagated or sold for a forged positive value", () => {
  const bought = purchasePlant(createGameState("dead-specimen-actions"), species[0] ?? findSpecies("alocasia-polly"));
  const id = bought.state.specimens[0].id;
  const deadState = {
    ...bought.state,
    specimens: bought.state.specimens.map((specimen) =>
      specimen.id === id ? { ...specimen, health: 0, dead: true, value: 500 } : specimen
    ),
  };
  const propagation = propagatePlant(deadState, id, "tissue-culture");
  assert.equal(propagation.ok, false);
  assert.equal(propagation.state.cash, deadState.cash);
  const sale = sellPlant(deadState, id);
  assert.equal(sale.ok, false);
  assert.equal(sale.state.cash, deadState.cash);
  assert.match(sale.message, /dead specimens/i);
});

test("an Alocasia can only yield one corm per in-game year", () => {
  const alocasia = species.find((candidate) => candidate.latin.split(" ")[0].toLowerCase() === "alocasia");
  assert.ok(alocasia, "test catalogue should include an Alocasia");
  const bought = purchasePlant(createGameState("annual-corm-limit"), alocasia);
  const parent = bought.state.specimens[0];
  const mature = {
    ...bought.state,
    specimens: bought.state.specimens.map((specimen) =>
      specimen.id === parent.id ? { ...specimen, stage: "Mature", health: 100 } : specimen
    ),
  };
  const first = propagatePlant(mature, parent.id, "corm");
  assert.equal(first.ok, true);
  assert.equal(first.state.specimens.find((specimen) => specimen.id === parent.id).lastCormHarvestYear, 0);
  const second = propagatePlant(first.state, parent.id, "corm");
  assert.equal(second.ok, false);
  assert.match(second.message, /already yielded a corm this year/i);
  assert.equal(second.state.specimens.length, first.state.specimens.length);
});


test("pest and disease treatment reduces the selected pressure and records its cost", () => {
  const bought = purchasePlant(createGameState("treatment-test"), species[0]);
  const id = bought.state.specimens[0].id;
  const affected = {
    ...bought.state,
    specimens: bought.state.specimens.map((specimen) =>
      specimen.id === id ? { ...specimen, pestLoad: 80, diseaseLoad: 70 } : specimen
    ),
  };
  const treated = treatSpecimen(affected, id, "both");
  assert.equal(treated.ok, true);
  const plant = treated.state.specimens.find((specimen) => specimen.id === id);
  assert.equal(plant.pestLoad, 20);
  assert.equal(plant.diseaseLoad, 10);
  assert.equal(treated.state.cash, affected.cash - 15);
  assert.equal(treated.state.ledger.at(-1).category, "treatment");
});

test("treatment rejects dead specimens and does not charge for absent problems", () => {
  const bought = purchasePlant(createGameState("treatment-guards"), species[0]);
  const id = bought.state.specimens[0].id;
  const dead = { ...bought.state, specimens: bought.state.specimens.map((specimen) => specimen.id === id ? { ...specimen, dead: true, health: 0, pestLoad: 90 } : specimen) };
  assert.equal(treatSpecimen(dead, id, "pests").ok, false);
  assert.equal(treatSpecimen(bought.state, id, "pests").ok, false);
  assert.equal(treatSpecimen(bought.state, id, "pests").state.cash, bought.state.cash);
});


test("loans have a fixed cap, accrue weekly interest, and can be repaid", () => {
  const initial = createGameState("loan-lifecycle");
  const borrowed = borrowFunds(initial, 100);
  assert.equal(borrowed.ok, true);
  assert.equal(borrowed.state.cash, initial.cash + 100);
  assert.equal(borrowed.state.financeDebt, 100);
  assert.equal(borrowFunds(borrowed.state, 500).ok, true);
  const capped = { ...borrowed.state, financeDebt: 950 };
  assert.equal(borrowFunds(capped, 100).ok, false);
  let state = borrowed.state;
  for (let i = 0; i < 6; i++) state = advanceGameDay(state).state;
  assert.equal(state.day, 7);
  assert.equal(state.financeDebt, 102);
  const repaid = repayLoan(state, 100);
  assert.equal(repaid.ok, true);
  assert.equal(repaid.state.financeDebt, 2);
  assert.equal(repayLoan(repaid.state, 100).state.financeDebt, 0);
});


test("voluntary liquidation sells eligible assets and settles arrears before loan principal", () => {
  const bought = purchasePlant(createGameState("liquidation"), species[0]);
  const specimen = bought.state.specimens[0];
  const state = {
    ...bought.state,
    cash: 0,
    financeArrears: 10,
    financeDebt: 5,
    financialStatus: "arrears",
    ledger: [{ id: "opening", day: 1, category: "other", description: "Opening balance", amount: 0, balance: 0 }],
    specimens: bought.state.specimens.map((item) => item.id === specimen.id ? { ...item, value: 50 } : item),
  };
  const liquidated = liquidateAssets(state);
  assert.equal(liquidated.ok, true);
  assert.equal(liquidated.state.specimens.length, 0);
  assert.equal(liquidated.state.financeArrears, 0);
  assert.equal(liquidated.state.financeDebt, 0);
  assert.equal(liquidated.state.cash, getMarketOffer(50, species[0].id, species[0].rarity, state.day) - 15);
  assert.equal(liquidated.state.financialStatus, "solvent");
});

test("liquidation protects reserved and protected specimens", () => {
  const bought = purchasePlant(createGameState("liquidation-protection"), species[0]);
  const specimen = bought.state.specimens[0];
  const state = {
    ...bought.state,
    financeDebt: 20,
    specimens: bought.state.specimens.map((item) => item.id === specimen.id ? { ...item, protected: true } : item),
  };
  const liquidated = liquidateAssets(state);
  assert.equal(liquidated.ok, false);
  assert.equal(liquidated.state.specimens.length, 1);
});


test("weekly customer orders generate from eligible stock and fulfilment rewards revenue and reputation", () => {
  const bought = purchasePlant(createGameState("customer-order"), species[0]);
  let state = bought.state;
  for (let i = 0; i < 6; i++) state = advanceGameDay(state).state;
  assert.equal(state.day, 7);
  assert.equal(state.customerOrders.length, 1);
  const order = state.customerOrders[0];
  assert.equal(order.status, "open");
  assert.equal(order.quantity, 1);
  const fulfilled = fulfillCustomerOrder(state, order.id);
  assert.equal(fulfilled.ok, true);
  assert.equal(fulfilled.state.customerOrders[0].status, "fulfilled");
  assert.equal(fulfilled.state.specimens.length, 0);
  assert.equal(fulfilled.state.reputation, 52);
  assert.equal(fulfilled.state.cash, state.cash + order.unitPrice);
  assert.equal(fulfilled.state.ledger.at(-1).category, "sales");
});

test("overdue customer orders expire and reduce reputation", () => {
  const state = {
    ...createGameState("customer-order-expiry"),
    day: 20,
    customerOrders: [{ id: "late-order", speciesId: species[0].id, quantity: 1, unitPrice: 20, channel: "retail", createdDay: 1, dueDay: 20, status: "open" }],
    reputation: 50,
  };
  const advanced = advanceGameDay(state);
  assert.equal(advanced.state.customerOrders[0].status, "expired");
  assert.equal(advanced.state.reputation, 47);
  assert.match(advanced.message, /expired/i);
});


test("hiring specialists changes payroll and dismissal removes future wages", () => {
  const initial = createGameState("staff-roster");
  const hired = hireEmployee(initial, "horticulturist");
  assert.equal(hired.ok, true);
  assert.equal(hired.state.cash, initial.cash - 70);
  assert.equal(hired.state.staffState.employees.length, 1);
  assert.equal(hired.state.staffState.employees[0].role, "horticulturist");
  assert.equal(hired.state.staffState.employees[0].weeklyWage, 14);
  assert.equal(hired.state.ledger.at(-1).category, "staff");
  const dismissed = dismissEmployee(hired.state, hired.state.staffState.employees[0].id);
  assert.equal(dismissed.ok, true);
  assert.equal(dismissed.state.staffState.employees.length, 0);
});

test("research technicians improve observation yield", () => {
  const bought = purchasePlant(createGameState("research-staff"), species[0]);
  const state = { ...bought.state, cash: 200, ledger: [{ id: "opening", day: 1, category: "other", description: "Opening balance", amount: 0, balance: 200 }] };
  const hired = hireEmployee(state, "research-technician");
  assert.equal(hired.ok, true);
  const observed = observeSpecimen(hired.state, hired.state.specimens[0].id);
  assert.equal(observed.ok, true);
  assert.equal(observed.state.research, 3);
});
