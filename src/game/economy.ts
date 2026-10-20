export type CashProjection = { days: number; charges: number; operatingCost: number; projectedCash: number; deficit: number };

export function projectOperatingCash(currentCash: number, currentDay: number, days: number, weeklyCost: number): CashProjection {
  const safeCash = Number.isFinite(currentCash) ? currentCash : 0;
  const safeDay = Math.max(1, Math.floor(Number.isFinite(currentDay) ? currentDay : 1));
  const safeDays = Math.max(0, Math.floor(Number.isFinite(days) ? days : 0));
  const safeWeeklyCost = Math.max(0, Number.isFinite(weeklyCost) ? weeklyCost : 0);
  // The game charges at the end of absolute calendar days divisible by seven.
  const charges = Math.floor((safeDay + safeDays) / 7) - Math.floor(safeDay / 7);
  const operatingCost = charges * safeWeeklyCost;
  const projectedCash = safeCash - operatingCost;
  return { days: safeDays, charges, operatingCost, projectedCash, deficit: Math.max(0, -projectedCash) };
}

export function estimateRecoverySales(deficit: number, eligibleInventoryValue: number, recoveryReserve = 0.1): { targetSaleValue: number; inventoryShortfall: number } {
  const safeDeficit = Math.max(0, Number.isFinite(deficit) ? deficit : 0);
  const safeInventory = Math.max(0, Number.isFinite(eligibleInventoryValue) ? eligibleInventoryValue : 0);
  const reserve = Math.max(0, Math.min(0.9, Number.isFinite(recoveryReserve) ? recoveryReserve : 0.1));
  const targetSaleValue = Math.min(safeInventory, Math.ceil(safeDeficit / Math.max(0.1, 1 - reserve)));
  return { targetSaleValue, inventoryShortfall: Math.max(0, safeDeficit - safeInventory * (1 - reserve)) };
}
