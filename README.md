# J2Grows Engine

Headless gameplay logic extracted from the J2Grows game. This repository is intended to be independent of React, CSS, visual assets, and the dashboard.

## Systems included

- Genetics, alleles, trait inheritance, breeding eligibility and genetic progression
- Plant catalogue rules and species economy
- Growth simulation, health, propagation and species suitability
- Facility upgrades, environmental controls and operating costs
- Staff training, care effects and staffing costs
- Research/progression, offline progress and deterministic random helpers
- Save validation and specimen identity
- Species and specimen domain data, with visual artwork mappings removed

## Development

Requires Node.js 22+ for the built-in TypeScript test runner used by the source project's tests, and Node.js/npm for TypeScript checks.

```bash
npm install
npm run typecheck
npm test
```

## Architecture

The engine is UI-agnostic: consumers should call domain functions and render their own interface. Browser-specific persistence and UI state belong in an adapter layer, not in this package.

## Provenance

Extracted from [j2grows-cmd/J2Grows](https://github.com/j2grows-cmd/J2Grows). This is an initial mechanics separation; remaining game rules embedded in the former React application should be migrated into domain modules before this package is considered feature-complete.
