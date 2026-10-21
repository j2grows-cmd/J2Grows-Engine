export type SupplierRegion = "uk" | "europe" | "asia" | "americas";
export type SupplierShipment = { id: string; speciesId: string; quantity: number; region: SupplierRegion; unitCost: number; freight: number; orderedDay: number; arrivesDay: number; delayDays: number; status: "shipping" | "arrived" | "collected" };

export const SUPPLIER_REGIONS: Record<SupplierRegion, { label: string; priceMultiplier: number; transitDays: number; freightPerPlant: number; biosecurityLoad: number; reliability: number }> = {
  uk: { label: "United Kingdom", priceMultiplier: 1.05, transitDays: 2, freightPerPlant: 2, biosecurityLoad: 0, reliability: 0.98 },
  europe: { label: "Europe", priceMultiplier: 0.95, transitDays: 4, freightPerPlant: 4, biosecurityLoad: 5, reliability: 0.9 },
  asia: { label: "Southeast Asia", priceMultiplier: 0.78, transitDays: 8, freightPerPlant: 7, biosecurityLoad: 12, reliability: 0.78 },
  americas: { label: "Americas", priceMultiplier: 1.1, transitDays: 10, freightPerPlant: 8, biosecurityLoad: 8, reliability: 0.8 },
};

export function quoteSupplierShipment(basePrice: number, region: SupplierRegion, quantity: number): { unitCost: number; freight: number; totalCost: number; arrivesInDays: number } | null {
  const details = SUPPLIER_REGIONS[region];
  if (!details || !Number.isFinite(basePrice) || basePrice <= 0 || !Number.isInteger(quantity) || quantity < 1 || quantity > 5) return null;
  const unitCost = Math.max(1, Math.round(basePrice * details.priceMultiplier));
  const freight = details.freightPerPlant * quantity;
  return { unitCost, freight, totalCost: unitCost * quantity + freight, arrivesInDays: details.transitDays };
}
