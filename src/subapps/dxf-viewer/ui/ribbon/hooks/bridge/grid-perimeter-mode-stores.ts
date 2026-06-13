/**
 * ADR-441 3-mode (Slice 5) — Per-entity περιμετρικά-mode stores για «Εσχάρα από κάναβο».
 *
 * Beam/wall/column instances της factory `createGridPerimeterModeStore` (mirror του
 * `foundationGridSettingsStore`). Κάθε ένα = ανεξάρτητο SSoT cell του center/inner/outer
 * της αντίστοιχης οντότητας — το split-button variant γράφει, ο handle*FromGrid διαβάζει.
 *
 * @see ../../../../bim/grid/grid-perimeter-mode-store.ts — factory
 * @see ./foundation-grid-settings-store.ts — foundation instance (ίδιο pattern)
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md
 */

import { createGridPerimeterModeStore } from '../../../../bim/grid/grid-perimeter-mode-store';

export const beamGridSettingsStore = createGridPerimeterModeStore();
export const wallGridSettingsStore = createGridPerimeterModeStore();
export const columnGridSettingsStore = createGridPerimeterModeStore();
