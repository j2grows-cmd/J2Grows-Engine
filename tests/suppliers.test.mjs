import test from "node:test";
import assert from "node:assert/strict";
import { quoteSupplierShipment, SUPPLIER_REGIONS } from "../src/game/suppliers.ts";

test("supplier quotes apply region-specific pricing, freight, and bounded transit", () => {
  const local = quoteSupplierShipment(20, "uk", 2);
  const asia = quoteSupplierShipment(20, "asia", 2);
  assert.ok(local && asia);
  assert.equal(local.arrivesInDays, SUPPLIER_REGIONS.uk.transitDays);
  assert.equal(asia.arrivesInDays, SUPPLIER_REGIONS.asia.transitDays);
  assert.ok(asia.unitCost < local.unitCost);
  assert.ok(asia.freight > 0);
  assert.equal(asia.totalCost, asia.unitCost * 2 + asia.freight);
});

test("supplier quotes reject invalid quantities, regions, and prices", () => {
  assert.equal(quoteSupplierShipment(20, "uk", 0), null);
  assert.equal(quoteSupplierShipment(20, "uk", 6), null);
  assert.equal(quoteSupplierShipment(Number.NaN, "asia", 1), null);
  assert.equal(quoteSupplierShipment(20, "antarctica", 1), null);
});
