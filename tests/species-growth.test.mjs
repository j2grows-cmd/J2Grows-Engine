import test from "node:test";
import assert from "node:assert/strict";
import { calculateSpeciesSuitability } from "../src/game/species-growth.ts";

test("catalogue light and humidity preferences affect species suitability", () => {
  const environment = { light: 68, humidity: 70, nutrition: 70, health: 100 };
  const suitable = calculateSpeciesSuitability("Alocasia × amazonica", "Moderate", environment, {
    light: "Bright, indirect",
    humidity: "60–80%",
  });
  const unsuitable = calculateSpeciesSuitability("Alocasia × amazonica", "Moderate", environment, {
    light: "Low",
    humidity: "30–40%",
  });
  assert.ok(suitable > unsuitable);
  assert.equal(suitable, 100);
});

test("missing or malformed catalogue care descriptions fall back to genus profiles", () => {
  const environment = { light: 62, humidity: 78, nutrition: 70, health: 100 };
  assert.equal(
    calculateSpeciesSuitability("Alocasia × amazonica", "Moderate", environment),
    calculateSpeciesSuitability("Alocasia × amazonica", "Moderate", environment, { light: "", humidity: "very humid" }),
  );
});


test("temperature, root-zone moisture, and photoperiod affect species suitability", () => {
  const base = { light: 62, humidity: 78, nutrition: 70, health: 100 };
  const optimal = calculateSpeciesSuitability("Alocasia × amazonica", "Moderate", {
    ...base, temperature: 24, substrateMoisture: 62, lightHours: 12, airflow: 45, substratePH: 6,
  });
  const stressful = calculateSpeciesSuitability("Alocasia × amazonica", "Moderate", {
    ...base, temperature: 10, substrateMoisture: 5, lightHours: 2, airflow: 5, substratePH: 9,
  });
  assert.ok(optimal > stressful);
});
