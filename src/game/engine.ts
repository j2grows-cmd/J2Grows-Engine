import { findSpecies, type Species, type Specimen } from "../data.ts";
import { createUniqueSpecimenId } from "./specimen-id.ts";
import { createEventRandom } from "./random.ts";
import { assessCrossEligibility, createBreedingIdentity } from "./breeding.ts";
import { calculateSpeciesSuitability, speciesGrowthDurationFactor } from "./species-growth.ts";
import { advanceEstablishedGrowthStage, advancePropagationPhase, calculateDailyHealth } from "./simulation.ts";
import { applyEnvironmentalController, canPurchaseFacilityUpgrade, nextFacilityUpgradeCost, normalizeFacilityLevels, weeklyFacilityOperatingCost, type FacilityLevels, type FacilityName } from "./facilities.ts";
import { advanceStaffDay, canStartStaffTraining, DEFAULT_STAFF_STATE, effectiveStaffCareCondition, startStaffTraining, STAFF_TRAINING_COST, weeklyStaffOperatingCost, STAFF_ROLE_DETAILS, MAX_EMPLOYEES, type StaffRole, type StaffState } from "./staff.ts";
import { canCreateOffset } from "./propagation-eligibility.ts";
import { getSpeciesEconomy, STARTING_CASH, type RarityTier } from "./catalog.ts";
import { getMarketOffer, getMarketPrice } from "./market.ts";
import { analyseGenetics, createMutation, createSpecimenGenetics, growVariegation, observePlant, calculateSpecimenValue, DEFAULT_ENVIRONMENT, type PlantEnvironment, type SpecimenGenetics } from "./genetics.ts";
import { applyTraitTargeting, breedingDurationDays, breedingFailureChance, calculateBreedingCost, calculateTargetedBreedingCost, calculateTargetedFailureChance, inheritTraits, mutationOccurs, type BreedingProject, type TargetableTrait, RESEARCH_TREE, unlockResearch } from "./progression.ts";

export type PropagationMethod = "cutting" | "division" | "corm" | "tissue-culture";
export type LedgerCategory = "plant-purchase" | "plant-sale" | "propagation" | "breeding" | "research" | "facility" | "staff" | "operating-cost" | "treatment" | "debt" | "sales" | "other";
export type LedgerEntry = { id: string; day: number; category: LedgerCategory; description: string; amount: number; balance: number };
export type FinancialStatus = "solvent" | "arrears" | "insolvent";
export type SalesChannel = "retail" | "wholesale" | "auction";
export type CustomerOrder = { id: string; speciesId: string; quantity: number; unitPrice: number; channel: SalesChannel; createdDay: number; dueDay: number; status: "open" | "fulfilled" | "expired" };
export type GameState = {
  version: 1; saveFormatVersion?: number; savedAt?: number; offlineProgressEnabled: boolean; simulationSeed: string; specimens: Specimen[]; breedingProjects: BreedingProject[];
  cash: number; research: number; day: number; projectStarted: boolean;
  analysisTargetSpecimenId?: string; analysisStartedDay?: number; analysisEquipmentLevel: number;
  greenhouseEnvironment: PlantEnvironment; researchUnlocks: string[];
  facilityLevels: FacilityLevels; facilityCondition: number; staffState: StaffState;
  ledger: LedgerEntry[]; financeArrears: number; financeDebt: number; financialStatus: FinancialStatus;
  customerOrders: CustomerOrder[]; reputation: number;
};
export type ActionResult = { state: GameState; ok: boolean; message: string; createdSpecimenIds?: string[] };
function ledgerCategory(message: string, amount: number): LedgerCategory {
  const text = message.toLowerCase();
  if (text.includes("propagation") || text.includes("corm") || text.includes("cutting") || text.includes("division") || text.includes("tissue culture")) return "propagation";
  if (text.includes("breeding")) return "breeding";
  if (text.includes("research") || text.includes("analysis") || text.includes("observation") || text.includes("mutation")) return "research";
  if (text.includes("facility") || text.includes("upgrade") || text.includes("controller") || text.includes("workstation") || text.includes("bench")) return "facility";
  if (text.includes("training") || text.includes("staff") || text.includes("hired") || text.includes("dismissed")) return "staff";
  if (text.includes("treatment") || text.includes("treated")) return "treatment";
  if (text.includes("loan") || text.includes("debt") || text.includes("interest")) return "debt";
  if (text.includes("sold")) return "plant-sale";
  if (text.includes("order fulfilled")) return "sales";
  if (text.includes("acquired")) return "plant-purchase";
  if (text.includes("operating cost") || text.includes("wage") || text.includes("overhead")) return "operating-cost";
  return amount === 0 ? "other" : "other";
}
const MAX_LEDGER_ENTRIES = 500;
const result = (state: GameState, ok: boolean, message: string, extra: Partial<ActionResult> = {}): ActionResult => {
  let next = state;
  const last = state.ledger?.[state.ledger.length - 1];
  const baseline = last ? last.balance : STARTING_CASH;
  const delta = Math.round((state.cash - baseline) * 100) / 100;
  if (ok && delta !== 0) {
    const entries: LedgerEntry[] = [...(state.ledger ?? [])];
    const category = ledgerCategory(message, delta);
    entries.push({ id: state.simulationSeed + ":" + state.day + ":" + entries.length, day: state.day, category, description: message, amount: delta, balance: state.cash });
    let cash = state.cash;
    let financeArrears = state.financeArrears ?? 0;
    if (delta > 0 && financeArrears > 0) {
      const repayment = Math.min(delta, financeArrears);
      cash = Math.max(0, cash - repayment);
      financeArrears = Math.max(0, financeArrears - repayment);
      entries.push({ id: state.simulationSeed + ":" + state.day + ":" + entries.length, day: state.day, category: "operating-cost", description: "Automatic repayment of outstanding operating-cost arrears", amount: -repayment, balance: cash });
    }
    next = { ...state, cash, financeArrears, financialStatus: financeArrears > 0 ? "arrears" : "solvent", ledger: entries.slice(-MAX_LEDGER_ENTRIES) };
  }
  return { state: next, ok, message, ...extra };
};
export function createGameState(seed = "j2grows-new-game"): GameState {
  return { version: 1, simulationSeed: seed, savedAt: Date.now(), offlineProgressEnabled: false, specimens: [], breedingProjects: [], cash: STARTING_CASH, research: 0, day: 1, projectStarted: false, analysisEquipmentLevel: 0, greenhouseEnvironment: { ...DEFAULT_ENVIRONMENT }, researchUnlocks: [], facilityLevels: normalizeFacilityLevels(), facilityCondition: 100, staffState: { ...DEFAULT_STAFF_STATE }, ledger: [], financeArrears: 0, financeDebt: 0, financialStatus: "solvent", customerOrders: [], reputation: 50 };
}
function valueOf(specimen: Specimen): number {
  const plant = findSpecies(specimen.speciesId);
  const economy = getSpeciesEconomy(specimen.speciesId) ?? getSpeciesEconomy(plant.name);
  const record = specimen.genetics ?? createSpecimenGenetics(specimen.variegation);
  const calculated = calculateSpecimenValue({ basePrice: economy?.basePrice ?? plant.basePrice ?? 15, health: specimen.health, stage: specimen.stage, variegationStrength: specimen.variegation, stability: record.genetics.stability, geneticsBonus: Math.min(2, 1 + Math.max(0, record.genetics.growthPotential - 50) / 100 + (record.research.analysisLevel >= 2 ? record.genetics.hiddenPotential / 200 : 0)), discoveryBonus: specimen.discovered ? 1.1 : 1 });
  if (specimen.purchasePrice === undefined) return calculated;
  return Math.min(calculated, Math.round(specimen.purchasePrice * .8 * (specimen.stage === "Mature" ? 1.6 : specimen.stage === "Growing" ? 1.25 : 1)));
}
export function purchasePlant(state: GameState, plant: Species): ActionResult {
  const economy = getSpeciesEconomy(plant.id) ?? getSpeciesEconomy(plant.name);
  const basePrice = economy?.basePrice ?? plant.basePrice ?? 15;
  const rarity = (economy?.rarity ?? plant.rarity) as RarityTier;
  const cost = getMarketPrice(basePrice, plant.id, rarity, state.day);
  if (state.cash < cost) return result(state, false, "Not enough funds to purchase " + plant.name + ".");
  const id = createUniqueSpecimenId(new Set(state.specimens.map(s => s.id)));
  const specimen: Specimen = { id, speciesId: plant.id, nickname: plant.name, location: "Home greenhouse", health: 100, stage: "Juvenile", value: 0, purchasePrice: cost, protected: false, variegation: 0, discovered: false, genetics: createSpecimenGenetics(0, createEventRandom(state.simulationSeed, "purchase:" + state.day + ":" + id)) };
  specimen.value = valueOf(specimen);
  return result({ ...state, cash: state.cash - cost, specimens: [...state.specimens, specimen] }, true, plant.name + " acquired.", { createdSpecimenIds: [id] });
}
export function sellPlant(state: GameState, id: string): ActionResult {
  const specimen = state.specimens.find(s => s.id === id);
  if (!specimen) return result(state, false, "Specimen not found.");
  if (specimen.dead || specimen.health <= 0) return result(state, false, "Dead specimens have no sale value.");
  if (specimen.protected) return result(state, false, "Remove specimen protection before selling.");
  if (specimen.reservedByProjectId || (state.projectStarted && state.analysisTargetSpecimenId === id)) return result(state, false, "This specimen is reserved by an active project.");
  const plant = findSpecies(specimen.speciesId);
  const economy = getSpeciesEconomy(plant.id) ?? getSpeciesEconomy(plant.name);
  const rarity = (economy?.rarity ?? plant.rarity) as RarityTier;
  const payout = getMarketOffer(specimen.value, plant.id, rarity, state.day);
  return result({ ...state, cash: state.cash + payout, specimens: state.specimens.filter(s => s.id !== id) }, true, specimen.nickname + " sold for £" + payout + ".");
}
export function setSpecimenProtection(state: GameState, id: string, protectedValue: boolean): ActionResult {
  const specimen = state.specimens.find(s => s.id === id);
  if (!specimen) return result(state, false, "Specimen not found.");
  if (specimen.reservedByProjectId || (state.projectStarted && state.analysisTargetSpecimenId === id)) return result(state, false, "A reserved specimen cannot change protection.");
  return result({ ...state, specimens: state.specimens.map(s => s.id === id ? { ...s, protected: protectedValue } : s) }, true, protectedValue ? "Specimen protected." : "Specimen protection removed.");
}
export function observeSpecimen(state: GameState, id: string): ActionResult {
  const specimen = state.specimens.find(s => s.id === id);
  if (!specimen) return result(state, false, "Specimen not found.");
  if (specimen.dead || specimen.health <= 0) return result(state, false, "Dead specimens cannot be observed.");
  if (specimen.lastObservedDay === state.day) return result(state, false, "This specimen has already been observed today.");
  const record = specimen.genetics ?? createSpecimenGenetics(specimen.variegation, createEventRandom(state.simulationSeed, "observe:" + state.day + ":" + id));
  const genetics = observePlant(record, specimen.variegation, state.researchUnlocks.includes("mutation-screening") && state.analysisEquipmentLevel > 0);
  const updated = { ...specimen, genetics, lastObservedDay: state.day, discovered: Boolean(specimen.discovered || genetics.research.mutations.some(m => m.detected)) };
  updated.value = valueOf(updated);
  const researchGain = 2 + (state.researchUnlocks.includes("field-notes") ? 1 : 0) + (state.researchUnlocks.includes("genetic-baseline") ? 1 : 0) + Math.min(3, state.staffState.employees.filter((employee) => employee.role === "research-technician" && employee.morale >= 20).length);
  return result({ ...state, research: state.research + researchGain, specimens: state.specimens.map(s => s.id === id ? updated : s) }, true, "Observation recorded for " + specimen.nickname + " (" + researchGain + " research points).");
}
export function analyseSpecimen(state: GameState, id: string): ActionResult {
  const specimen = state.specimens.find(s => s.id === id);
  if (!specimen) return result(state, false, "Specimen not found.");
  if (specimen.dead || specimen.health <= 0) return result(state, false, "Dead specimens cannot be analysed.");
  const record = specimen.genetics ?? createSpecimenGenetics(specimen.variegation);
  if (record.research.analysisLevel >= 3) return result(state, false, "All analysis levels are complete.");
  if (record.research.observationCount < 3) return result(state, false, "Record at least three observations first.");
  if (state.research < 25 || record.research.points < 25) return result(state, false, "Analysis requires 25 global research points and 25 specimen evidence points.");
  const genetics = analyseGenetics(record, 25);
  if (!genetics) return result(state, false, "More evidence is required.");
  const updated = { ...specimen, genetics, discovered: Boolean(specimen.discovered || genetics.research.mutations.some(m => m.detected)) };
  updated.value = valueOf(updated);
  return result({ ...state, research: state.research - 25, specimens: state.specimens.map(s => s.id === id ? updated : s) }, true, "Genetic analysis completed.");
}
export function propagatePlant(state: GameState, parentId: string, method: PropagationMethod): ActionResult {
  const parent = state.specimens.find(s => s.id === parentId);
  if (!parent) return result(state, false, "Parent specimen not found.");
  const plant = findSpecies(parent.speciesId), genus = plant.latin.split(" ")[0].toLowerCase();
  const allowed = !parent.dead && parent.health > 0 && !parent.reservedByProjectId && ((method === "division" && canCreateOffset(parent.stage)) || method === "tissue-culture" || (method === "cutting" && ["monstera","philodendron","anthurium"].includes(genus) && ["Mature","Breeding-ready"].includes(parent.stage)) || (method === "corm" && genus === "alocasia" && ["Mature","Breeding-ready"].includes(parent.stage)));
  if (!allowed) return result(state, false, "This specimen is not eligible for that propagation method.");
  if (method === "corm" && parent.lastCormHarvestYear === Math.floor((state.day - 1) / 365)) return result(state, false, "This Alocasia has already yielded a corm this year.");
  const rarity = (getSpeciesEconomy(plant.id)?.rarity ?? getSpeciesEconomy(plant.name)?.rarity ?? plant.rarity) as RarityTier;
  const costs: Record<PropagationMethod, Record<RarityTier, number>> = { division:{Common:2,Uncommon:3,Rare:4,"Very Rare":5,"Ultra Rare":7,Mythic:10}, corm:{Common:2,Uncommon:3,Rare:4,"Very Rare":5,"Ultra Rare":7,Mythic:10}, cutting:{Common:4,Uncommon:5,Rare:7,"Very Rare":10,"Ultra Rare":12,Mythic:15}, "tissue-culture":{Common:10,Uncommon:15,Rare:20,"Very Rare":30,"Ultra Rare":40,Mythic:60} };
  const details = ({cutting:{location:"Propagation Bench",health:85,label:"Cutting"},division:{location:"Propagation Bench",health:90,label:"Division"},corm:{location:"Corm Nursery",health:75,label:"Corm"},"tissue-culture":{location:"Tissue Culture Lab",health:70,label:"Tissue culture"}} as const)[method];
  const random = createEventRandom(state.simulationSeed, "propagate:" + state.day + ":" + parent.id + ":" + method + ":" + state.specimens.length);
  const count = method === "cutting" ? 1 + Math.floor(random() * 3) : 1, totalCost = costs[method][rarity] * count;
  if (state.cash < totalCost) return result(state, false, "Not enough funds for propagation.");
  const used = new Set(state.specimens.map(s => s.id)), children: Specimen[] = [];
  for (let i=0;i<count;i++) {
    const id = createUniqueSpecimenId(used); used.add(id);
    const genetics: SpecimenGenetics = parent.genetics ? { ...parent.genetics, genetics:{...parent.genetics.genetics,mutationIds:[...parent.genetics.genetics.mutationIds]}, observations:[], research:{points:0,observationCount:0,analysisLevel:0,discoveredTraits:[],mutations:parent.genetics.research.mutations.map(m=>({...m,detected:false}))} } : createSpecimenGenetics(parent.variegation, random);
    if (mutationOccurs("propagation", genetics.environment, state.researchUnlocks.includes("propagation-science") ? 1 : 0, state.researchUnlocks.includes("propagation-science") ? .005 : 0, random)) {
      const mutation = createMutation(random,{origin:"propagation",tissueDistribution:method==="tissue-culture"?"meristematic":method==="division"?"whole-plant":"sectoral",originDay:state.day});
      mutation.detected=false; genetics.genetics.mutationIds=[...new Set([...genetics.genetics.mutationIds,mutation.id])]; genetics.research.mutations.push(mutation);
    }
    const child: Specimen = { id, speciesId:parent.speciesId, nickname:plant.name+" "+details.label+(count>1?" "+(i+1):""), location:details.location, health:details.health, stage:"Juvenile", propagation:{method,phase:method==="corm"?"Corm":method==="cutting"?"Cutting":"Establishing",daysInPhase:0,daysToSprout:method==="corm"?2+Math.floor(random()*4):method==="cutting"?2+Math.floor(random()*3):0,daysToEstablish:3+Math.floor(random()*3),daysToJuvenile:method==="cutting"?4+Math.floor(random()*3):undefined}, value:0, protected:false, variegation:parent.variegation, discovered:false, genetics };
    child.value=valueOf(child); children.push(child);
  }
  let updatedParent = parent;
  if (method==="corm") { updatedParent={...parent,lastCormHarvestYear:Math.floor((state.day - 1) / 365)}; }
  if (method==="cutting") { updatedParent={...parent,stage:"Juvenile",stageDays:0,health:Math.max(35,parent.health-15*count),location:"Recovery · Greenhouse",value:0}; updatedParent.value=valueOf(updatedParent); }
  return result({...state,cash:state.cash-totalCost,specimens:[...state.specimens.filter(s=>s.id!==parentId),updatedParent,...children]},true,details.label+" propagation started.",{createdSpecimenIds:children.map(s=>s.id)});
}
export function startBreeding(state: GameState, parentAId: string, parentBId: string, targetTrait?: TargetableTrait): ActionResult {
  const a=state.specimens.find(s=>s.id===parentAId), b=state.specimens.find(s=>s.id===parentBId);
  if (!a || !b) return result(state,false,"Choose two available parent specimens.");
  const speciesA=findSpecies(a.speciesId), speciesB=findSpecies(b.speciesId);
  const eligibility=assessCrossEligibility({id:a.id,genus:speciesA.latin.split(" ")[0],stage:a.stage,health:a.health,dead:a.dead,reserved:Boolean(a.reservedByProjectId)},{id:b.id,genus:speciesB.latin.split(" ")[0],stage:b.stage,health:b.health,dead:b.dead,reserved:Boolean(b.reservedByProjectId)});
  if (!eligibility.eligible) return result(state,false,eligibility.reason ?? "These parents cannot be crossed.");
  const rarityA=(getSpeciesEconomy(speciesA.id)?.rarity??speciesA.rarity) as RarityTier, rarityB=(getSpeciesEconomy(speciesB.id)?.rarity??speciesB.rarity) as RarityTier;
  const targeted=Boolean(targetTrait&&state.researchUnlocks.includes("inheritance-mapping"));
  const cost=calculateTargetedBreedingCost(calculateBreedingCost(rarityA,rarityB,1,state.researchUnlocks.includes("selective-breeding")?10:0),targeted);
  if(state.cash<cost)return result(state,false,"Not enough funds for breeding.");
  const identity=createBreedingIdentity(state.day,state.breedingProjects.length+1,a.id,b.id),condition=(state.greenhouseEnvironment.light+state.greenhouseEnvironment.nutrition+state.greenhouseEnvironment.humidity+a.health+b.health)/5;
  const project:BreedingProject={id:identity.projectId,parentAId:a.id,parentBId:b.id,startedDay:state.day,completesOnDay:state.day+breedingDurationDays(5,state.researchUnlocks.includes("selective-breeding")?15:0),cost,status:"active",failureChance:calculateTargetedFailureChance(breedingFailureChance(state.researchUnlocks.includes("selective-breeding")?3:0,condition),targeted),lineId:identity.lineId,targetTrait:targeted?targetTrait:undefined};
  return result({...state,cash:state.cash-cost,breedingProjects:[...state.breedingProjects,project],specimens:state.specimens.map(s=>s.id===a.id||s.id===b.id?{...s,reservedByProjectId:project.id}:s)},true,"Breeding project started; both parents are reserved.");
}
export function startBatchBreeding(state: GameState, pairs: Array<[string, string]>): ActionResult {
  if (!state.researchUnlocks.includes("batch-breeding")) return result(state, false, "Unlock Batch Breeding research before starting a batch.");
  if (!Array.isArray(pairs) || pairs.length < 2 || pairs.length > 5) return result(state, false, "A batch must contain between two and five crosses.");
  const used = new Set<string>();
  let next = state;
  for (const pair of pairs) {
    if (!Array.isArray(pair) || pair.length !== 2 || pair[0] === pair[1] || used.has(pair[0]) || used.has(pair[1])) return result(state, false, "Each batch cross must use two distinct parents, and each parent can only be used once per batch.");
    used.add(pair[0]); used.add(pair[1]);
    const started = startBreeding(next, pair[0], pair[1]);
    if (!started.ok) return result(state, false, "Batch cancelled without changes: " + started.message);
    next = started.state;
  }
  return result(next, true, "Batch Breeding started " + pairs.length + " crosses.");
}
export function unlockResearchNode(state: GameState,id: string): ActionResult {
  const next=unlockResearch(id,{points:state.research,unlocked:state.researchUnlocks,completed:state.researchUnlocks});
  if(!next)return result(state,false,RESEARCH_TREE.some(n=>n.id===id)?"Research points or prerequisites are missing.":"Research node not found.");
  return result({...state,research:next.points,researchUnlocks:next.unlocked},true,"Research unlocked: "+id.replaceAll("-"," ")+".");
}
export function maintainFacilities(state: GameState): ActionResult {
  const installedLevels = state.facilityLevels.propagationBench + state.facilityLevels.environmentalController + state.analysisEquipmentLevel;
  if (installedLevels <= 0) return result(state, false, "Install equipment before scheduling facility maintenance.");
  if (state.facilityCondition >= 100) return result(state, false, "Facilities are already in full working condition.");
  const cost = 20 + installedLevels * 5;
  if (state.cash < cost) return result(state, false, "Not enough funds for facility maintenance.");
  return result({ ...state, cash: state.cash - cost, facilityCondition: Math.min(100, state.facilityCondition + 50) }, true, "Facility maintenance completed for £" + cost + ".");
}
export function upgradeFacility(state: GameState,name: FacilityName): ActionResult {
  const cost=nextFacilityUpgradeCost(name,state.facilityLevels,state.analysisEquipmentLevel);
  if(cost===null)return result(state,false,"Facility is max level or unavailable.");
  if(!canPurchaseFacilityUpgrade(name,state.facilityLevels,state.analysisEquipmentLevel,state.cash))return result(state,false,"Not enough funds for "+name+".");
  const levels={...state.facilityLevels};let analysis=state.analysisEquipmentLevel;
  if(name==="Propagation bench")levels.propagationBench++;else if(name==="Environmental controller")levels.environmentalController++;else analysis++;
  return result({...state,cash:state.cash-cost,facilityLevels:levels,analysisEquipmentLevel:analysis},true,name+" upgraded.");
}
export function hireEmployee(state: GameState, role: StaffRole): ActionResult {
  const details = STAFF_ROLE_DETAILS[role];
  if (!details) return result(state, false, "Choose a valid staff role.");
  const employees = state.staffState.employees ?? [];
  if (employees.length >= MAX_EMPLOYEES) return result(state, false, "The studio has reached its staff capacity.");
  if (state.cash < details.hireCost) return result(state, false, "Not enough funds to hire a " + details.label.toLowerCase() + ".");
  const employee = { id: state.simulationSeed + "-staff-" + state.day + "-" + (employees.length + 1) + "-" + state.specimens.length, role, name: details.label + " " + (employees.filter((item) => item.role === role).length + 1), weeklyWage: details.weeklyWage, morale: 70, experienceDays: 0 };
  return result({ ...state, cash: state.cash - details.hireCost, staffState: { ...state.staffState, employees: [...employees, employee] } }, true, employee.name + " hired for £" + details.hireCost + " with weekly wages of £" + details.weeklyWage + ".");
}
export function dismissEmployee(state: GameState, employeeId: string): ActionResult {
  const employees = state.staffState.employees ?? [];
  const employee = employees.find((item) => item.id === employeeId);
  if (!employee) return result(state, false, "Staff member not found.");
  return result({ ...state, staffState: { ...state.staffState, employees: employees.filter((item) => item.id !== employeeId) } }, true, employee.name + " dismissed; future wages have been removed.");
}
export function beginStaffTraining(state: GameState): ActionResult {
  if(!canStartStaffTraining(state.cash,state.staffState))return result(state,false,"Staff training is unavailable or unaffordable.");
  const staff=startStaffTraining(state.staffState);if(!staff)return result(state,false,"Staff training cannot be started.");
  return result({...state,cash:state.cash-STAFF_TRAINING_COST,staffState:staff},true,"Staff training started.");
}
export function setGreenhouseEnvironment(state: GameState, input: Partial<PlantEnvironment>): ActionResult {
  const clamp=(v:unknown,f:number)=>typeof v==="number"&&Number.isFinite(v)?Math.max(0,Math.min(100,v)):f;
  const environment={...state.greenhouseEnvironment,light:clamp(input.light,state.greenhouseEnvironment.light),nutrition:clamp(input.nutrition,state.greenhouseEnvironment.nutrition),humidity:clamp(input.humidity,state.greenhouseEnvironment.humidity),health:clamp(input.health,state.greenhouseEnvironment.health)};
  return result({...state,greenhouseEnvironment:environment},true,"Greenhouse environment updated.");
}
export function fulfillCustomerOrder(state: GameState, orderId: string): ActionResult {
  const order = state.customerOrders.find((item) => item.id === orderId);
  if (!order || order.status !== "open") return result(state, false, "Customer order is not open.");
  if (state.day > order.dueDay) return result(state, false, "This customer order has passed its deadline.");
  const stock = state.specimens.filter((item) => item.speciesId === order.speciesId && !item.dead && item.health > 0 && !item.protected && !item.reservedByProjectId && !(state.projectStarted && state.analysisTargetSpecimenId === item.id));
  if (stock.length < order.quantity) return result(state, false, "Not enough eligible stock to fulfil this order.");
  const soldIds = new Set(stock.slice(0, order.quantity).map((item) => item.id));
  const revenue = order.unitPrice * order.quantity;
  const orders = state.customerOrders.map((item) => item.id === orderId ? { ...item, status: "fulfilled" as const } : item);
  return result({ ...state, cash: state.cash + revenue, specimens: state.specimens.filter((item) => !soldIds.has(item.id)), customerOrders: orders, reputation: Math.min(100, state.reputation + 2 + (state.staffState.employees.some((employee) => employee.role === "nursery-manager" && employee.morale >= 20) ? 1 : 0)) }, true, "Customer order fulfilled: " + order.quantity + " × " + findSpecies(order.speciesId).name + " for £" + revenue + ".");
}
export const MAX_LOAN_BALANCE = 1000;
export const LOAN_INTEREST_RATE_PER_WEEK = 0.02;
export function borrowFunds(state: GameState, amount: number): ActionResult {
  if (![50, 100, 250, 500].includes(amount)) return result(state, false, "Choose a supported loan amount (£50, £100, £250, or £500).");
  if ((state.financeDebt ?? 0) + amount > MAX_LOAN_BALANCE) return result(state, false, "This loan would exceed the £1,000 credit limit.");
  return result({ ...state, cash: state.cash + amount, financeDebt: (state.financeDebt ?? 0) + amount }, true, "Loan drawdown received: £" + amount + ".");
}
export function repayLoan(state: GameState, amount: number): ActionResult {
  if (!Number.isFinite(amount) || amount <= 0) return result(state, false, "Enter a positive repayment amount.");
  if ((state.financeDebt ?? 0) <= 0) return result(state, false, "There is no outstanding loan balance.");
  const repayment = Math.min(Math.floor(amount), state.financeDebt);
  if (state.cash < repayment) return result(state, false, "Not enough available cash for this loan repayment.");
  return result({ ...state, cash: state.cash - repayment, financeDebt: state.financeDebt - repayment }, true, "Loan repayment: £" + repayment + ".");
}
export function liquidateAssets(state: GameState): ActionResult {
  if ((state.financeArrears ?? 0) <= 0 && (state.financeDebt ?? 0) <= 0) return result(state, false, "Voluntary liquidation is only available while financial obligations remain.");
  const eligible = state.specimens.filter((item) => !item.dead && item.health > 0 && !item.protected && !item.reservedByProjectId && !(state.projectStarted && state.analysisTargetSpecimenId === item.id));
  if (eligible.length === 0) return result(state, false, "No unprotected, unreserved living specimens are available to liquidate.");
  const proceeds = eligible.reduce((sum, item) => { const plant = findSpecies(item.speciesId); const economy = getSpeciesEconomy(plant.id) ?? getSpeciesEconomy(plant.name); return sum + getMarketOffer(item.value, plant.id, (economy?.rarity ?? plant.rarity) as RarityTier, state.day); }, 0);
  let cash = state.cash + proceeds;
  const arrearsPaid = Math.min(cash, state.financeArrears ?? 0);
  cash -= arrearsPaid;
  const debtPaid = Math.min(cash, state.financeDebt ?? 0);
  cash -= debtPaid;
  const ledger = [...(state.ledger ?? [])];
  const day = state.day;
  ledger.push({ id: state.simulationSeed + ":day:" + day + ":liquidation", day, category: "plant-sale", description: "Voluntary asset liquidation (" + eligible.length + " specimens)", amount: proceeds, balance: state.cash + proceeds });
  if (arrearsPaid > 0) ledger.push({ id: state.simulationSeed + ":day:" + day + ":arrears-settlement", day, category: "operating-cost", description: "Liquidation proceeds applied to operating arrears", amount: -arrearsPaid, balance: state.cash + proceeds - arrearsPaid });
  if (debtPaid > 0) ledger.push({ id: state.simulationSeed + ":day:" + day + ":debt-settlement", day, category: "debt", description: "Liquidation proceeds applied to loan balance", amount: -debtPaid, balance: cash });
  const financeArrears = Math.max(0, (state.financeArrears ?? 0) - arrearsPaid);
  const financeDebt = Math.max(0, (state.financeDebt ?? 0) - debtPaid);
  const financialStatus: FinancialStatus = financeArrears >= 100 && cash === 0 ? "insolvent" : financeArrears > 0 ? "arrears" : "solvent";
  const next: GameState = { ...state, cash, financeArrears, financeDebt, financialStatus, ledger: ledger.slice(-MAX_LEDGER_ENTRIES), specimens: state.specimens.filter((item) => !eligible.some((sold) => sold.id === item.id)) };
  return result(next, true, "Liquidation completed; £" + proceeds + " recovered, £" + arrearsPaid + " arrears and £" + debtPaid + " loan principal repaid.");
}
export type TreatmentTarget = "pests" | "disease" | "both";
export function treatSpecimen(state: GameState, id: string, target: TreatmentTarget): ActionResult {
  const specimen = state.specimens.find((item) => item.id === id);
  if (!specimen) return result(state, false, "Specimen not found.");
  if (specimen.dead || specimen.health <= 0) return result(state, false, "Dead specimens cannot be treated.");
  const pestLoad = specimen.pestLoad ?? 0, diseaseLoad = specimen.diseaseLoad ?? 0;
  if ((target === "pests" && pestLoad === 0) || (target === "disease" && diseaseLoad === 0) || (target === "both" && pestLoad === 0 && diseaseLoad === 0)) {
    return result(state, false, "No matching pest or disease pressure is recorded for this specimen.");
  }
  const cost = target === "both" ? 15 : 8;
  if (state.cash < cost) return result(state, false, "Not enough funds for plant treatment.");
  const specimens = state.specimens.map((item) => item.id !== id ? item : {
    ...item,
    pestLoad: target === "disease" ? pestLoad : Math.max(0, pestLoad - 60),
    diseaseLoad: target === "pests" ? diseaseLoad : Math.max(0, diseaseLoad - 60),
  });
  const label = target === "both" ? "Pest and disease treatment" : target === "pests" ? "Pest treatment" : "Disease treatment";
  return result({ ...state, cash: state.cash - cost, specimens }, true, label + " applied to " + specimen.nickname + " for £" + cost + ".");
}
export function startMutationAnalysis(state: GameState,id: string): ActionResult {
  if(state.projectStarted)return result(state,false,"Mutation Analysis is already in progress.");
  const specimen=state.specimens.find(s=>s.id===id);
  if(!specimen||specimen.dead||specimen.health<=0)return result(state,false,"Choose a living specimen for Mutation Analysis.");
  if(specimen.mutationAnalysisCompleted)return result(state,false,"Mutation Analysis can only be performed once per specimen.");
  if(state.cash<25)return result(state,false,"Not enough funds to start Mutation Analysis.");
  return result({...state,cash:state.cash-25,projectStarted:true,analysisTargetSpecimenId:id,analysisStartedDay:state.day},true,"Mutation Analysis started for "+specimen.nickname+".");
}
export function advanceGameDay(state: GameState): ActionResult {
  const day=state.day+1, staff=advanceStaffDay(state.staffState, day), environment=applyEnvironmentalController(state.greenhouseEnvironment,state.facilityLevels.environmentalController,Math.min(100,state.facilityCondition+(state.researchUnlocks.includes("controlled-environment")?15:0))), care=(effectiveStaffCareCondition(environment,staff)+environment.health)/2;
  const notices:string[]=[];
  const specimens=state.specimens.map(s=>{
    if(s.dead||s.health<=0)return {...s,health:0,dead:true,value:0};
    const random=createEventRandom(state.simulationSeed,"day:"+day+":specimen:"+s.id);
    const pestRandom=createEventRandom(state.simulationSeed,"day:"+day+":pests:"+s.id);
    const diseaseRandom=createEventRandom(state.simulationSeed,"day:"+day+":disease:"+s.id);
    const maintenanceStaff=staff.employees.filter((employee)=>employee.role==="maintenance-technician"&&employee.morale>=20).length;
    const maintenanceFactor=Math.max(0.4,1-maintenanceStaff*0.2);
    const pestRisk=(environment.humidity<35?0.012:0.001)*maintenanceFactor;
    const diseaseRisk=(environment.humidity>88&&environment.nutrition<50?0.015:environment.humidity>94?0.005:0.0005)*maintenanceFactor;
    const pestLoad=Math.min(100,(s.pestLoad??0)+(pestRandom()<pestRisk?10:0));
    const diseaseLoad=Math.min(100,(s.diseaseLoad??0)+(diseaseRandom()<diseaseRisk?10:0));
    const health=Math.max(0,calculateDailyHealth(s.health,environment.autoCare?Math.max(60,care):care)-Math.ceil(pestLoad/25)-Math.ceil(diseaseLoad/20));
    const record=s.genetics??createSpecimenGenetics(s.variegation,random), env={...environment,health};
    if(pestLoad>(s.pestLoad??0))notices.push("Possible pest activity detected on "+s.nickname+".");
    if(diseaseLoad>(s.diseaseLoad??0))notices.push("Possible disease activity detected on "+s.nickname+".");
    const growth=growVariegation(record.genetics,env,s.variegation,random);let genetics:SpecimenGenetics={...record,environment:env,expression:growth.expression};let variegation=growth.expression;
    if(mutationOccurs("growth",env,Math.floor(state.research/50),state.analysisEquipmentLevel*.001,random)){
      const mutation=createMutation(random,{origin:"growth",tissueDistribution:"sectoral",originDay:day});mutation.detected=false;
      genetics={...genetics,genetics:{...genetics.genetics,mutationIds:[...new Set([...genetics.genetics.mutationIds,mutation.id])]},research:{...genetics.research,mutations:[...genetics.research.mutations,mutation]}};
      if(mutation.category==="colour"){variegation=Math.min(100,Math.max(variegation,35+Math.round(random()*35)));genetics={...genetics,genetics:{...genetics.genetics,variegationPotential:Math.max(genetics.genetics.variegationPotential,variegation)}};}
      notices.push("Potential "+mutation.category+" mutation in "+s.nickname+".");
    }
    let propagation=s.propagation,stage=s.stage,stageDays=s.stageDays??0,location=s.location;
    const species=findSpecies(s.speciesId), suitability=calculateSpeciesSuitability(species.latin,species.difficulty,{...environment,health}),condition=suitability<45?1.5:suitability<65?1.2:suitability>=85?.85:1,speciesFactor=speciesGrowthDurationFactor(species.latin,species.difficulty);
    if(propagation){const progress=advancePropagationPhase(propagation,suitability<45?2:suitability<65?1:0,state.facilityLevels.propagationBench);propagation=progress.propagation;if(progress.transition==="cutting-rooting")location="Propagation Bench · Rooting";else if(progress.transition==="rooting-new-growth")location="Propagation Bench · New Growth";else if(progress.transition==="corm-sprouting")location="Corm Nursery · Sprouting";else if(progress.transition==="propagation-established"){stage="Juvenile";stageDays=0;location="Greenhouse · Establishing";}if(propagation?.phase==="Sprouting")stage="Juvenile";}
    else{const progress=advanceEstablishedGrowthStage(stage,stageDays,health,speciesFactor,condition);stage=progress.stage;stageDays=progress.stageDays;if(progress.transition)notices.push(s.nickname+" advanced to "+stage+".");}
    const updated:Specimen={...s,health,dead:health<=0,pestLoad,diseaseLoad,stage,stageDays,location,propagation,variegation,genetics:{...genetics,expression:variegation,environment:env}};updated.value=valueOf(updated);return updated;
  });
  let projects=state.breedingProjects.map(p=>({...p}));
  projects=projects.map(p=>{
    if(p.status!=="active"||p.completesOnDay>day)return p;
    const a=specimens.find(s=>s.id===p.parentAId),b=specimens.find(s=>s.id===p.parentBId),random=createEventRandom(state.simulationSeed,"day:"+day+":breeding:"+p.id);
    if(!a||!b||a.dead||b.dead||a.health<=0||b.health<=0||random()<p.failureChance){notices.push("Breeding project "+p.id+" failed or was cancelled.");return {...p,status:"cancelled" as const};}
    const recordA=a.genetics??createSpecimenGenetics(a.variegation,random),recordB=b.genetics??createSpecimenGenetics(b.variegation,random),inherited=applyTraitTargeting(inheritTraits(recordA.genetics,recordB.genetics,random),recordA.genetics,recordB.genetics,p.targetTrait,random),id=createUniqueSpecimenId(new Set(specimens.map(s=>s.id))),generation=Math.max(a.generation??0,b.generation??0)+1;
    const childRecord=createSpecimenGenetics((inherited.variegationPotential+inherited.stability)/2,random);childRecord.genetics=inherited;childRecord.genetics.mutationIds=[...inherited.mutationIds];
    childRecord.research.mutations=[...recordA.research.mutations,...recordB.research.mutations].filter((m,i,all)=>all.findIndex(x=>x.id===m.id)===i).map(m=>({...m,detected:false,origin:"breeding" as const,parentMutationIds:[m.id]}));
    const child:Specimen={id,speciesId:a.speciesId,nickname:"Hybrid "+generation+" · "+findSpecies(a.speciesId).name,location:"Breeding Nursery",health:85,stage:"Juvenile",value:0,protected:false,variegation:childRecord.genetics.variegationPotential,genetics:childRecord,generation,geneticLineId:p.lineId,lineParentIds:[a.id,b.id],stableMutationIds:[],stabilityGenerations:{}};
    child.value=valueOf(child);specimens.push(child);notices.push("Breeding completed: "+child.nickname+".");return {...p,status:"completed" as const};
  });
  const finished=new Set(projects.filter(p=>p.status!=="active").map(p=>p.id));
  const unreserved=specimens.map(s=>s.reservedByProjectId&&finished.has(s.reservedByProjectId)?({...s,reservedByProjectId:undefined}):s);
  let next:GameState={...state,day,cash:state.cash,specimens:unreserved,breedingProjects:projects,staffState:staff,customerOrders:[...(state.customerOrders??[])],reputation:state.reputation??50,facilityCondition:Math.max(0,Math.min(100,state.facilityCondition??100))};
  if(day % 7 === 0){
    const installedLevels = state.facilityLevels.propagationBench + state.facilityLevels.environmentalController + state.analysisEquipmentLevel;
    if(installedLevels > 0){
      const maintenanceStaff = staff.employees.filter((employee) => employee.role === "maintenance-technician" && employee.morale >= 20).length;
      const wear = Math.max(0, installedLevels * (maintenanceStaff > 0 ? 0.5 : 1));
      next = { ...next, facilityCondition: Math.max(0, (next.facilityCondition ?? 100) - wear) };
      if(next.facilityCondition < 40) notices.push("Facility condition is degraded; environmental controls are less effective. Schedule maintenance.");
    }
    const weeklyCost = weeklyStaffOperatingCost(staff) + weeklyFacilityOperatingCost(state.facilityLevels, state.analysisEquipmentLevel, state.researchUnlocks.includes("routine-automation"));
    if((next.financeDebt ?? 0) > 0){
      const interest = Math.max(1, Math.ceil(next.financeDebt * LOAN_INTEREST_RATE_PER_WEEK));
      const balance = next.financeDebt + interest;
      const entry: LedgerEntry = { id: state.simulationSeed + ":day:" + day + ":loan-interest", day, category: "debt", description: "Weekly loan interest accrued", amount: -interest, balance: next.cash };
      next = { ...next, financeDebt: balance, ledger: [...(next.ledger ?? []), entry].slice(-MAX_LEDGER_ENTRIES) };
      notices.push("Loan interest accrued: £" + interest + ".");
    }
    if(weeklyCost > 0){
      const paid = Math.min(next.cash, weeklyCost);
      const shortfall = weeklyCost - paid;
      const balance = Math.max(0, next.cash - paid);
      const entry: LedgerEntry = { id: state.simulationSeed + ":day:" + day + ":overheads", day, category: "operating-cost", description: "Weekly staff and facility operating costs", amount: -weeklyCost, balance };
      next = { ...next, cash: balance, financeArrears: (next.financeArrears ?? 0) + shortfall, financialStatus: (next.financeArrears ?? 0) >= 100 && balance === 0 ? "insolvent" : shortfall > 0 || (next.financeArrears ?? 0) > 0 ? "arrears" : "solvent", ledger: [...(next.ledger ?? []), entry].slice(-MAX_LEDGER_ENTRIES) };
      notices.push("Weekly operating costs: £" + weeklyCost + (shortfall > 0 ? "; £" + shortfall + " added to arrears." : "."));
    }
  }
  const overdue = next.customerOrders.filter((order) => order.status === "open" && day > order.dueDay);
  if (overdue.length > 0) {
    const overdueIds = new Set(overdue.map((order) => order.id));
    next = { ...next, customerOrders: next.customerOrders.map((order) => overdueIds.has(order.id) ? { ...order, status: "expired" as const } : order), reputation: Math.max(0, next.reputation - overdue.length * 3) };
    notices.push(overdue.length + " customer order(s) expired; reputation declined.");
  }
  if (day % 7 === 0) {
    const available = next.specimens.filter((item) => !item.dead && item.health > 0 && !item.protected && !item.reservedByProjectId && !item.propagation);
    const candidates = available.filter((item) => !next.customerOrders.some((order) => order.status === "open" && order.speciesId === item.speciesId));
    if (candidates.length > 0) {
      const random = createEventRandom(state.simulationSeed, "day:" + day + ":customer-order");
      const chosen = candidates[Math.floor(random() * candidates.length)];
      const stockCount = available.filter((item) => item.speciesId === chosen.speciesId).length;
      const quantity = 1 + Math.floor(random() * Math.min(3, stockCount));
      const channel = (["retail", "wholesale", "auction"] as const)[Math.floor(random() * 3)];
      const economy = getSpeciesEconomy(chosen.speciesId) ?? getSpeciesEconomy(findSpecies(chosen.speciesId).name);
      const rarity = (economy?.rarity ?? findSpecies(chosen.speciesId).rarity) as RarityTier;
      const baseOffer = getMarketOffer(chosen.value, chosen.speciesId, rarity, day);
      const channelMultiplier = channel === "retail" ? 1.2 : channel === "wholesale" ? 0.85 : 1.45;
      const order: CustomerOrder = { id: state.simulationSeed + "-order-" + day, speciesId: chosen.speciesId, quantity, unitPrice: Math.max(1, Math.round(baseOffer * channelMultiplier)), channel, createdDay: day, dueDay: day + 14, status: "open" };
      next = { ...next, customerOrders: [...next.customerOrders, order].slice(-100) };
      notices.push("New " + channel + " customer order for " + quantity + " × " + findSpecies(chosen.speciesId).name + ".");
    }
  }
  if(state.projectStarted&&state.analysisStartedDay!==undefined&&day-state.analysisStartedDay>=3&&state.analysisTargetSpecimenId){
    const target=next.specimens.find(s=>s.id===state.analysisTargetSpecimenId);
    if(target&&!target.dead&&target.health>0){const record=target.genetics??createSpecimenGenetics(target.variegation),mutations=record.research.mutations.map(m=>({...m,detected:true,evidenceCount:Math.max(3,m.evidenceCount??0)})),updated={...target,mutationAnalysisCompleted:true,discovered:mutations.length>0,genetics:{...record,research:{...record.research,mutations}}};updated.value=valueOf(updated);next={...next,specimens:next.specimens.map(s=>s.id===target.id?updated:s),research:next.research+10};notices.push("Mutation Analysis completed for "+target.nickname+".");}
    else notices.push("Mutation Analysis was cancelled because its target is no longer available; no research reward was granted.");
    next={...next,projectStarted:false,analysisTargetSpecimenId:undefined,analysisStartedDay:undefined};
  }
  return result(next,true,"Advanced to day "+day+"."+ (notices.length?" "+notices.join(" "):""));
}
