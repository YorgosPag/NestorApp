/**
 * ADR-581 — «Αντιγραφή Ιδιοτήτων» dialog visibility (zero-React toggle singleton).
 *
 * Ανοίγει από το ribbon κουμπί (contextual multi-selection tab, action
 * `match-properties.open`). Το dialog διαβάζει source/targets από την τρέχουσα
 * επιλογή τη στιγμή που φιλοξενείται (mount-on-open), οπότε κρατάει μόνο boolean.
 *
 * @see stores/createToggleStore — SSoT factory
 */

import { createToggleStore } from './createToggleStore';

export const MatchPropertiesDialogStore = createToggleStore();

/** Σταθερό action key για το ribbon dispatch (routeRibbonAction early-intercept). */
export const MATCH_PROPERTIES_OPEN_ACTION = 'match-properties.open';
