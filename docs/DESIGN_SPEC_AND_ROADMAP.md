# J2Grows: Design Specification and Implementation Roadmap

Status: approved design baseline from the seven-round workshop (2026-10-21).

## Product vision
J2Grows is a premium, desktop-first botanical empire simulator combining species-specific horticulture, advanced genetics, scientific research, tissue-culture production, and a financially consequential international nursery business. Complexity should create strategic decisions, not unnecessary clicking.

## Design commitments

### Botanical simulation
- Species-specific growth rates, stages, environmental suitability, and propagation readiness.
- Interacting light, humidity, nutrition, temperature/airflow/substrate as the simulation expands.
- Meaningful care actions, pests, diseases, diagnosis, treatment, and lasting stress consequences.
- Partial recovery after death where biologically plausible propagation material survives.
- Expertise and research reveal more detail; warnings should explain causes and likely consequences.

### Genetics and research
- Advanced inheritance including genotype/phenotype, linked and recessive traits, and polygenic traits where supported by the model.
- Variegation can strengthen, weaken, revert, and vary between offspring.
- Rare but achievable mutations, biology-led compatibility, high-stakes breeding experiments.
- Research tree plus experiments, lab upgrades, evidence, and discoveries.
- Tissue culture is a commercial propagation pipeline with contamination, multiplication, and acclimation risks.
- Every important discovery can be preserved, scientifically validated, and commercialised.

### Business simulation
- Scrappy starting capital, flexible reinvestment, meaningful/punishing operating costs.
- Simulated market with supply, demand, trends, competitors, and market cycles.
- Advanced finance, borrowing, interest, repayment obligations, and liquidation as a possible bankruptcy outcome.
- Staff management: recruitment, wages, shifts, training, morale, performance, and specialisms.
- Modular facilities, maintenance, sensor drift, equipment failure, and backup systems.
- Global suppliers, shipping delays, import costs, and biosecurity.
- Retail, wholesale, auctions, tissue-culture production, contracts, research commissions, and cultivar licensing.
- Dynamic reputation across reliability, authenticity, service, and scientific credibility.
- Crises can cascade between plants, infrastructure, orders, reputation, and finances.

### Progression and UX
- Milestone-driven progression, permanent scientific records, campaign challenges, contracts, and optional prestige.
- Premium dark botanical visual direction with realistic scientific detail.
- Dashboard-first UI with contextual warnings and deeper specialist screens.
- Desktop-first; responsive usability remains desirable.
- Pause and deliberate day/week advancement; offline simulation is selective and capped at 14 days.

### Technical and quality requirements
- Versioned saves, validation, migration, rotating backups, and both automatic and manual recovery.
- Target tens of thousands of specimens through profiling, aggregation, and optimisation rather than assuming per-specimen work will scale indefinitely.
- Comprehensive unit/regression tests, migration tests, economy invariants, typecheck, production build, and browser playthroughs where available.
- Deliver in staged, coherent batches directly on `main`; report exactly what is implemented and what was verified.

## Prioritised implementation roadmap

### Batch 1 — Integrity exploits and regression protection
- [x] Record successful annual Alocasia corm harvests.
- [x] Reject propagation from dead/zero-health specimens.
- [x] Reject selling dead/zero-health specimens.
- [x] Add regression tests for the above.
- [x] Verify CI results for the new tests.

### Batch 2 — Save reliability
- Integrate validation with the active app save format instead of maintaining unrelated validation logic.
- Version saves and migrate older saves without silently discarding valid progress.
- Rotate backups, preserve damaged payloads, and provide automatic plus manual recovery.
- Handle storage write failures without falsely reporting autosave success.

### Batch 3 — Economy and ledger integrity
- Establish one authoritative transaction path for purchases, sales, research, breeding, propagation, upgrades, wages, and operating costs.
- Charge recurring costs at explicit intervals; define arrears, debt, interest, and liquidation coherently.
- Replace placeholder ledger with real transaction records and accurate cash-flow metrics.
- Add invariants and tests for cash movement, duplicate charges, and insolvency.

### Batch 4 — Simulation truthfulness
- Make plant-care controls correspond to actual modeled factors.
- Ensure staff, research, facilities, and automation unlocks have real, testable effects.
- Implement explicit maintenance, failure, and warning semantics.
- Connect offline progress to the same deterministic daily simulation, with bounded and transparent outcomes.

### Batch 5 — Genetics and propagation depth
- Audit inheritance, biological cross compatibility, mutation rarity, lineage, and unstable variegation.
- Build tissue culture into a staged commercial workflow.
- Prevent duplicate/invalid projects and preserve genetic records through propagation and migration.

### Batch 6 — Business operations and progression
- Expand workforce, facilities, global suppliers, contracts, reputation, and market simulation in vertical slices.
- Add milestone progression, campaign objectives, permanent discovery records, and optional prestige.
- Keep UI feedback actionable and aligned with actual engine state.

### Batch 7 — Scale and release verification
- Profile simulation at 1k, 10k, and 25k+ specimens.
- Aggregate low-frequency/irrelevant background systems where appropriate while preserving important outcomes.
- Run comprehensive tests, typecheck, production build, browser playthroughs, save migrations, and offline-return scenarios.

## Initial audit findings and current status

- The live app save path now uses `src/game/save-store.ts` for validation, normalization, versioned save metadata, backup rotation, and recovery. The older independent schema normalizer in `src/game/save-validation.ts` still needs a unified migration contract across all historic formats.
- Staff and facility weekly costs are now charged on in-game day boundaries; unpaid operating costs accumulate as arrears, incoming cash prioritises arrears, loans accrue interest, and liquidation can repay liabilities.
- The Ledger now records cash-changing actions, recurring costs, liability movements, and cash impact separately.
- Offline progress now replays the normal deterministic daily simulation, with opt-in behaviour and a 14-day cap.
- CI runs typecheck, production build, and the Node test suite. A 10,000-specimen daily simulation regression test is included. Browser-based manual verification remains outstanding.
- Some long-horizon systems are intentionally not represented as complete: multi-location empire management, full supplier contracts/customs, auction clearing, richer substrate/temperature/watering biology, and broader competitor simulation remain planned work.

## Implementation status — 2026-10-21

The following staged foundations have now been committed directly to `main`:

- **Integrity:** annual corm harvest tracking; dead/zero-health propagation and sale guards.
- **Save safety:** live-format validation and normalization; versioned save metadata; rotating backups; corrupt-save preservation; restore-last-valid-backup UI; finance, staff, shipment, and progression defaults during recovery.
- **Finance:** transaction ledger, weekly staff/facility charges, arrears, automatic arrears repayment from incoming cash, capped loans, weekly loan interest, repayment controls, and voluntary liquidation of unprotected/unreserved living specimens.
- **Market:** deterministic time-varying quotes by species and rarity, local stock-saturation discounts, and market-adjusted buyback offers.
- **Plant health:** species-level light/humidity/temperature/substrate-moisture/photoperiod/airflow/pH suitability, pest/disease pressure and same-location transmission, expertise-gated diagnosis and treatment, quarantine release rules, and care-consistency affecting daily health. Mature Alocasia and selected aroids may leave viable propagation material after death, but salvage is not guaranteed.
- **Facilities:** condition wear, degraded environmental-control effectiveness, maintenance actions, and maintenance-technician mitigation.
- **Workforce:** role-based hiring and dismissal, weekly wages, experience, morale, care/research/reputation effects, and preventive-maintenance effects.
- **Commercial operations:** global supplier regions, freight and transit times, shipment collection/quarantine loads, weekly customer orders, fulfilment, deadlines, and reputation consequences.
- **Progression:** research-gated facility upgrades and genetic analysis, batch breeding, research-node bonuses, persistent achievements, and a prestige reset with permanent observation-research bonuses.
- **Offline and scale:** opt-in offline replay through the normal daily engine, capped at 14 days; regression coverage for a 10,000-specimen daily simulation.
- **Verification:** GitHub Actions runs typecheck, production build, and the full Node test suite on every push to `main`.

### Still outstanding before calling the full design complete

- True long-form species-specific biology with watering schedules, substrate recipes, individual plant care plans, and richer airflow/temperature dynamics.
- More granular spatial pest/disease transmission beyond shared-location pressure, plus expertise-gated diagnosis.
- Supplier reputation, customs/import compliance, supplier payment terms, and larger-scale supplier contracts.
- A deeper multi-product nursery inventory, competitor supply/demand, auction clearing, wholesale contracts, and licensing.
- More complete staffing schedules, specialisms, workload, recruitment history, and automation maintenance failures.
- A unified, fully versioned migration path for every historic save schema; current live-save normalization is integrated, while the older separate schema normalizer still needs reconciliation.
- Milestone-driven unlock gating and broader permanent collection achievements.
- Profiling beyond the 10,000-specimen regression fixture, particularly with many active breeding projects and shipments.
- Browser-based manual playthroughs, save corruption/recovery walkthroughs, and mobile/desktop visual QA.

These are explicit remaining work items, not features claimed to be finished.
