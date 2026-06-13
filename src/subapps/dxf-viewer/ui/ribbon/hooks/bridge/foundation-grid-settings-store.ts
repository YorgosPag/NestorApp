/**
 * ADR-441 — Foundation grid generation settings (SSoT του «Έδραση εσχάρας»).
 *
 * Module-level mutable cell για τον τρόπο έδρασης των ΠΕΡΙΜΕΤΡΙΚΩΝ λωρίδων στη
 * γένεση «Εσχάρα από κάναβο» (center/inner/outer). Είναι ΕΝΑ SSoT ώστε να το διαβάζουν
 * ΚΑΙ το ρητό κουμπί (split-button variants) ΚΑΙ το auto-reconcile στο follow-move
 * (`bim:grid-guides-settled`, Slice 7) — αλλιώς η μετακίνηση άξονα θα επανέφερε σιωπηλά
 * την εσχάρα στο default mode.
 *
 * **Generalized (ADR-441 3-mode, Slice 5):** το boilerplate μεταφέρθηκε στη factory
 * `createGridPerimeterModeStore` (`bim/grid/`)· αυτό = ΕΝΑ foundation instance. Τα beam/wall/
 * column instances ζουν στο `grid-perimeter-mode-stores.ts`.
 *
 * @see ../../../../bim/grid/grid-perimeter-mode-store.ts — factory
 * @see ./grid-perimeter-mode-stores.ts — beam/wall/column instances
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md
 */

import { createGridPerimeterModeStore } from '../../../../bim/grid/grid-perimeter-mode-store';

export const foundationGridSettingsStore = createGridPerimeterModeStore();
