# J2Grows Engine

A headless TypeScript gameplay layer extracted from [J2Grows](https://github.com/j2grows-cmd/J2Grows). It contains no React components, CSS, decorative dashboard graphics, or plant-artwork resolver.

## Gameplay systems

- Game state creation and actions for purchasing, selling, specimen protection, observation, genetic analysis and propagation
- Genetics, alleles, trait inheritance, mutation mechanics and breeding eligibility
- Breeding project scheduling and completion with inherited traits and lineage metadata
- Plant growth stages, health simulation, environmental suitability and propagation phases
- Economy, facility upgrades, staff training, research unlocks and Mutation Analysis
- Save validation, deterministic event randomness, specimen IDs and species catalogue/economy data

## Use the engine

Node.js 22 or later is recommended.

```ts
import { createGameState, purchasePlant, advanceGameDay } from "@j2grows/engine";
import { species } from "@j2grows/engine/data";

let state = createGameState("my-save-seed");
const purchase = purchasePlant(state, species[0]);
if (purchase.ok) state = purchase.state;
state = advanceGameDay(state).state;
```

Every action returns an `ActionResult` containing the next immutable state, success status, and a message. A UI can render that state however it likes; persistence and presentation remain the responsibility of the host application.

## Development

```bash
npm install
npm run typecheck
npm test
```

The CI workflow runs TypeScript checks and the headless mechanics tests. The API is an ongoing extraction: some original tutorial orchestration, save-slot browser storage and other presentation-coupled workflows remain in the original app and are intentionally not part of this engine module yet.

## Provenance

Mechanics were ported from the J2Grows source repository. The original application remains unchanged.
