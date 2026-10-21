import { findSpecies, type Species, type Specimen } from "../data.ts";
import { createUniqueSpecimenId } from "./specimen-id.ts";
import { createEventRandom } from "./random.ts";
import { assessCrossEligibility, createBreedingIdentity } from "./breeding.ts";
import { calculateSpeciesSuitability, speciesGrowthDurationFactor } from "./species-growth.ts";
import { advanceEstablishedGrowthStage, advancePropagationPhase, calculateDailyHealth } from "./simulation.ts";
import { applyEnvironmentalController, canPurchaseFacilityUpgrade, nextFacilityUpgradeCost, normalizeFacilityLevels, type FacilityLevels, type FacilityName } from "./facilities.ts";
import { advanceStaffDay, canStartStaffTraining, DEFAULT_STAFF_STATE, effectiveStaffCareCondition, startStaffTraining, STAFF_TRAINING_COST, type StaffState } from "./staff.ts";
import { canCreateOffset } from "./propagation-eligibility.ts";
import { getSpeciesEconomy, STARTING_CASH, type RarityTier } from "./catalog.ts";
import { analyseGenetics, createMutation, createSpecimenGenetics, growVariegation, observePlant, calculateSpecimenValue, DEFAULT_ENVIRONMENT, type PlantEnvironment, type SpecimenGenetics } from "./genetics.ts";
import { applyTraitTargeting, breedingDurationDays, breedingFailureChance, calculateBreedingCost, calculateTargetedBreedingCost, calculateTargetedFailureChance, inheritTraits, mutationOccurs, type BreedingProject, type TargetableTrait, RESEARCH_TREE, unlockResearch } from "./progression.ts";

export type PropagationMethod = "cutting" | "division" | "corm" | "tissue-culture";
export type LedgerCategory = "plant-purchase" | "plant-sale" | "propagation" | "breeding" | "research" | "facility" | "staff" | "operating-cost" | "other";
export type LedgerEntry = { id: string; day: number; category: LedgerCategory; description: string; amount: number; balance: number };
export type FinancialStatus = "solvent" | "arrears";
export type GameState = {
  version: 1; simulationSeed: string; specimens: Specimen[]; breedingProjects: BreedingProject[];
  cash: number; research: number; day: number; projectStarted: boolean;
  analysisTargetSpecimenId?: string; analysisStartedDay?: number; analysisEquipmentLevel: number;
  greenhouseEnvironment: PlantEnvironment; researchUnlocks: string[];
  facilityLevels: FacilityLevels; staffState: StaffState;
  ledger: LedgerEntry[]; financeArrears: number; financialStatus: FinancialStatus;
};
export type ActionResult = { state: GameState; ok: boolean; message: string; createdSpecimenIds?: string[] };
function ledgerCategory(message: string, amount: number): LedgerCategory {
  const text = message.toLowerCase();
  if (text.includes("propagation") || text.includes("corm") || text.includes("cutting") || text.includes("division") || text.includes("tissue culture")) return "propagation";
  if (text.includes("breeding")) return "breeding";
  if (text.includes("research") || text.includes("analysis") || text.includes("observation") || text.includes("mutation")) return "research";
  if (text.includes("facility") || text.includes("upgrade") || text.includes("controller") || text.includes("workstation") || text.includes("bench")) return "facility";
  if (text.includes("training") || text.includes("staff")) return "staff";
  if (text.includes("sold")) return "plant-sale";
  if (text.includes("acquired")) return "plant-purchase";
  if (text.includes("operating cost") || text.includes("wage") || text.includes("overhead")) return "operating-cost";
  return amount === 0 ? "other" : "other";
}
const MAX_LEDGER_ENTRIES = 500;
const result = (previous: GameState, ok: boolean, message: string, extra: Partial<ActionResult> = {}): ActionResult => {
  const next = extra.state ?? previous;
  const delta = Math.round((next.cash - previous.cash) * 100) / 100;
  let state = next;
  if (ok && delta !== 0) {
    const entry: LedgerEntry = { id: previous.simulationSeed + ":" + next.day + ":" + (previous.ledger?.length ?? 0), day: next.day, category: ledgerCategory(message, delta), description: message, amount: delta, balance: next.cash };
    state = { ...next, ledger: [...(next.ledger ?? []), entry].slice(-MAX_LEDGER_ENTRIES) };
  }
  return { state, ok, message, ...extra };
};

export function createGameState(seed = "j2grows-new-game"): GameState {
  return { version: 1, simulationSeed: seed, specimens: [], breedingProjects: [], cash: STARTING_CASH, research: 0, day: 1, projectStarted: false, analysisEquipmentLevel: 0, greenhouseEnvironment: { ...DEFAULT_ENVIRONMENT }, researchUnlocks: [], facilityLevels: normalizeFacilityLevels(), staffState: { ...DEFAULT_STAFF_STATE }, ledger: [], financeArrears: 0, financialStatus: "solvent" };
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
  const cost = getSpeciesEconomy(plant.id)?.basePrice ?? getSpeciesEconomy(plant.name)?.basePrice ?? plant.basePrice ?? 15;
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
  return result({ ...state, cash: state.cash + specimen.value, specimens: state.specimens.filter(s => s.id !== id) }, true, specimen.nickname + " sold for £" + specimen.value + ".");
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
  return result({ ...state, research: state.research + 2, specimens: state.specimens.map(s => s.id === id ? updated : s) }, true, "Observation recorded for " + specimen.nickname + ".");
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
export function unlockResearchNode(state: GameState,id: string): ActionResult {
  const next=unlockResearch(id,{points:state.research,unlocked:state.researchUnlocks,completed:state.researchUnlocks});
  if(!next)return result(state,false,RESEARCH_TREE.some(n=>n.id===id)?"Research points or prerequisites are missing.":"Research node not found.");
  return result({...state,research:next.points,researchUnlocks:next.unlocked},true,"Research unlocked: "+id.replaceAll("-"," ")+".");
}
export function upgradeFacility(state: GameState,name: FacilityName): ActionResult {
  const cost=nextFacilityUpgradeCost(name,state.facilityLevels,state.analysisEquipmentLevel);
  if(cost===null)return result(state,false,"Facility is max level or unavailable.");
  if(!canPurchaseFacilityUpgrade(name,state.facilityLevels,state.analysisEquipmentLevel,state.cash))return result(state,false,"Not enough funds for "+name+".");
  const levels={...state.facilityLevels};let analysis=state.analysisEquipmentLevel;
  if(name==="Propagation bench")levels.propagationBench++;else if(name==="Environmental controller")levels.environmentalController++;else analysis++;
  return result({...state,cash:state.cash-cost,facilityLevels:levels,analysisEquipmentLevel:analysis},true,name+" upgraded.");
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
export function startMutationAnalysis(state: GameState,id: string): ActionResult {
  if(state.projectStarted)return result(state,false,"Mutation Analysis is already in progress.");
  const specimen=state.specimens.find(s=>s.id===id);
  if(!specimen||specimen.dead||specimen.health<=0)return result(state,false,"Choose a living specimen for Mutation Analysis.");
  if(specimen.mutationAnalysisCompleted)return result(state,false,"Mutation Analysis can only be performed once per specimen.");
  if(state.cash<25)return result(state,false,"Not enough funds to start Mutation Analysis.");
  return result({...state,cash:state.cash-25,projectStarted:true,analysisTargetSpecimenId:id,analysisStartedDay:state.day},true,"Mutation Analysis started for "+specimen.nickname+".");
}
export function advanceGameDay(state: GameState): ActionResult {
  const day=state.day+1, staff=advanceStaffDay(state.staffState), environment=applyEnvironmentalController(state.greenhouseEnvironment,state.facilityLevels.environmentalController), care=effectiveStaffCareCondition(environment,staff);
  const notices:string[]=[];
  const specimens=state.specimens.map(s=>{
    if(s.dead||s.health<=0)return {...s,health:0,dead:true,value:0};
    const random=createEventRandom(state.simulationSeed,"day:"+day+":specimen:"+s.id), health=calculateDailyHealth(s.health,environment.autoCare?Math.max(60,care):care), record=s.genetics??createSpecimenGenetics(s.variegation,random), env={...environment,health};
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
    const updated:Specimen={...s,health,dead:health<=0,stage,stageDays,location,propagation,variegation,genetics:{...genetics,expression:variegation,environment:env}};updated.value=valueOf(updated);return updated;
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
  let next:GameState={...state,day,cash:state.cash,specimens:unreserved,breedingProjects:projects,staffState:staff};
  if(state.projectStarted&&state.analysisStartedDay!==undefined&&day-state.analysisStartedDay>=3&&state.analysisTargetSpecimenId){
    const target=next.specimens.find(s=>s.id===state.analysisTargetSpecimenId);
    if(target&&!target.dead&&target.health>0){const record=target.genetics??createSpecimenGenetics(target.variegation),mutations=record.research.mutations.map(m=>({...m,detected:true,evidenceCount:Math.max(3,m.evidenceCount??0)})),updated={...target,mutationAnalysisCompleted:true,discovered:mutations.length>0,genetics:{...record,research:{...record.research,mutations}}};updated.value=valueOf(updated);next={...next,specimens:next.specimens.map(s=>s.id===target.id?updated:s),research:next.research+10};notices.push("Mutation Analysis completed for "+target.nickname+".");}
    else notices.push("Mutation Analysis was cancelled because its target is no longer available; no research reward was granted.");
    next={...next,projectStarted:false,analysisTargetSpecimenId:undefined,analysisStartedDay:undefined};
  }
  return result(next,true,"Advanced to day "+day+"."+ (notices.length?" "+notices.join(" "):""));
}
