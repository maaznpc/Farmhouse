# Fieldwork · Farmhouse Planner

An interactive farmhouse zoning planner for a 50 × 90 ft plot (4,500 sq ft), with roads on two configurable sides.

## Features

- Drag, resize, rotate, add, rename, and remove spaces on a scaled plot.
- Edit dimensions and positions in whole feet, with plot boundary limits.
- Compare Garden first, Pool courtyard, and Family retreat layouts; each retains its own edits.
- View covered footprint, open-to-sky area, unallocated area, and overlap alerts.
- Undo/redo, keyboard movement, a 5 ft grid, and browser-local saved layouts.

## Run locally

No build step or application dependencies are required. Serve the `dist` folder with any static HTTP server, for example:

```sh
python -m http.server 8000 --directory dist
```

Open http://localhost:8000.

## Tests

With Node.js 20 or later:

```sh
npm test
```

Tests cover area unions against an independent square-foot occupancy calculation, geometry limits, saved-state validation, and production editing event handlers through a DOM harness. The harness does not replace visual testing in a browser.

## Area definitions

- **Covered footprint:** the union of zones classified as covered structures.
- **Open to sky:** 4,500 sq ft minus covered footprint; includes landscape, water, and paving.
- **Unallocated:** plot area outside the union of all placed zones.

Overlapping footprints count only once. Calculations use the 50 × 90 ft dimensions; the 16-marla label uses 281.25 sq ft per marla.

Layouts save in localStorage on the current browser and do not sync between devices. Hosting-specific Site identity is excluded from this repository. This is a concept zoning tool; setbacks, access, and structural design require separate review.
