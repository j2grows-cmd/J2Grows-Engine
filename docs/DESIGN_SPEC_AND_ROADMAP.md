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
- [ ] Verify CI results for the new tests.

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

## Current audit notes
- The active UI reads and writes a localStorage payload with `version: 1`, while `src/game/save-validation.ts` contains a separate migration/normalization path for versions through 9; these need a single integrated contract.
- Staff and facility modules expose weekly cost calculators, but the inspected daily engine path does not charge those costs.
- The Ledger contains summary metrics and placeholder transaction copy rather than a transaction history.
- Offline-progress currently exposes a bounded day calculation; end-to-end application of offline days still requires verification.
- Repository source was inspected through GitHub. Do not claim local tests/builds or browser verification unless those checks are actually observed.
