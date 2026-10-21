import test from "node:test";
import assert from "node:assert/strict";
import { getMarketMultiplier, getMarketPrice, getMarketOffer } from "../src/game/market.ts";

test("market quotes are deterministic and bounded for each species and day", () => {
  for (const day of [1, 7, 30, 180, 365, 1000]) {
    const multiplier = getMarketMultiplier("alocasia-polly", "Common", day);
    assert.ok(multiplier >= 0.65 && multiplier <= 1.45);
    assert.equal(multiplier, getMarketMultiplier("alocasia-polly", "Common", day));
  }
});

test("market quotes vary over time and rare stock has wider price swings", () => {
  const common = Array.from({ length: 180 }, (_, i) => getMarketMultiplier("market-test", "Common", i + 1));
  const rare = Array.from({ length: 180 }, (_, i) => getMarketMultiplier("market-test", "Ultra Rare", i + 1));
  assert.ok(new Set(common).size > 20);
  const range = (values) => Math.max(...values) - Math.min(...values);
  assert.ok(range(rare) > range(common));
});

test("purchase prices and buyback offers remain integer and safely handle invalid values", () => {
  assert.equal(getMarketPrice(100, "market-test", "Common", 1) % 1, 0);
  assert.ok(getMarketOffer(100, "market-test", "Common", 1) >= 0);
  assert.equal(getMarketPrice(Number.NaN, "market-test", "Common", 1), 1);
  assert.equal(getMarketOffer(-20, "market-test", "Common", 1), 0);
});


test("excess local stock lowers buyback offers", () => {
  const normal = getMarketOffer(100, "market-saturation", "Rare", 50, 0);
  const saturated = getMarketOffer(100, "market-saturation", "Rare", 50, 10);
  assert.ok(saturated < normal);
});
