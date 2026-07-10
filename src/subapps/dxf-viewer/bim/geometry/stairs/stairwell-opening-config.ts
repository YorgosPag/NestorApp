/**
 * ADR-632 — Stairwell auto-opening feature config (SSoT).
 *
 * Παράμετροι για τον `StairwellOpeningEngine`: περιθώριο σκαλοπατιών κάτω από
 * την παραβατική ζώνη (IBC one-tread-depth beyond), και το slab-opening kind
 * που παράγεται αυτόματα. Τα headroom thresholds ζουν στο SSoT
 * `bim/stairs/stair-headroom-constants.ts` (κοινό με τον validator).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-632-stairwell-auto-opening-ssot.md
 */

import type { SlabOpeningKind } from '../../types/slab-opening-types';

/**
 * Πόσα επιπλέον σκαλοπάτια (προς τα κάτω, πέρα από το χαμηλότερο παραβατικό)
 * μπαίνουν στην τρύπα ως περιθώριο ασφαλείας. IBC §1011.3: το headroom
 * εξασφαλίζεται «one tread depth beyond» → 1 σκαλοπάτι.
 */
export const STAIRWELL_OPENING_MARGIN_TREADS = 1;

/** Το auto-παραγόμενο slab-opening είναι πάντα «well» (κλιμακοστάσιο). */
export const STAIRWELL_AUTO_OPENING_KIND: SlabOpeningKind = 'well';
