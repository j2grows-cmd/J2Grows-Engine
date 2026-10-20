import test from "node:test";
import assert from "node:assert/strict";
import { estimateRecoverySales, projectOperatingCash } from "../src/game/economy.ts";

test("cash projection counts weekly charges on the same calendar days as gameplay", () => {
  assert.deepEqual(projectOperatingCash(100, 1, 30, 20), { days: 30, charges: 4, operatingCost: 80, projectedCash: 20, deficit: 0 });
  assert.equal(projectOperatingCash(100, 1, 60, 20).charges, 8);
  assert.equal(projectOperatingCash(100, 1, 90, 20).charges, 13);
  assert.equal(projectOperatingCash(100, 6, 1, 20).charges, 1);
  assert.equal(projectOperatingCash(100, 7, 1, 20).charges, 0);
});

test("projection handles negative balances and invalid inputs safely", () => {
  assert.deepEqual(projectOperatingCash(10, 1, 14, 20), { days: 14, charges: 2, operatingCost: 40, projectedCash: -30, deficit: 30 });
  assert.equal(projectOperatingCash(Number.NaN, 0, -3, -1).projectedCash, 0);
});

test("recovery sales estimate includes a conservative sale reserve and reports insufficient stock", () => {
  assert.deepEqual(estimateRecoverySales(90, 200), { targetSaleValue: 100, inventoryShortfall: 0 });
  assert.deepEqual(estimateRecoverySales(100, 50), { targetSaleValue: 50, inventoryShortfall: 55 });
  assert.deepEqual(estimateRecoverySales(0, 20), { targetSaleValue: 0, inventoryShortfall: 0 });
});
