/**
 * Beam max-width store — transient DERIVED transport (ADR-506, mirror ADR-486/499/504 stores).
 *
 * Κρατά το τελευταίο DERIVED **άνω όριο πλάτους** ανά δοκό (`beamId → maxWidthMm`): την κάθετη
 * στον άξονα του δοκαριού προβολή της **στηρίζουσας κολώνας** (min επί όλων των στηρίξεων).
 * Είναι το cap που χρησιμοποιεί ο width-aware auto-sizer (`suggestBeamSection`) ώστε το δοκάρι
 * να φαρδαίνει το πολύ όσο η κολώνα που το κρατάει — **μονόδρομο** (η κολώνα ΔΕΝ μεγαλώνει).
 *
 * Το **sizing path** (`active-reinforcement.ts → resolveActiveBeamMaxWidthMm`,
 * `AutoSizeMembersCommand`, lock callers) — per-entity & pure — παίρνει το cap με ΕΝΑ synchronous
 * read, χωρίς να ξαναϋπολογίζει την προβολή των στηρίξεων στον άξονα σε κάθε γύρο.
 *
 * `undefined` ⇒ καμία γνωστή στηρίζουσα κολώνα (ή πριν το πρώτο pass) → ο consumer μένει
 * **depth-only** (το πλάτος δεν αλλάζει· μηδέν regression). Low-frequency: γράφεται ΜΟΝΟ στο
 * organism recompute pass → ADR-040 safe. DERIVED, ΠΟΤΕ persisted — η αλήθεια ζει στην τοπολογία.
 *
 * @see ./derive-beam-max-width.ts — buildBeamMaxWidthMap (ο builder)
 * @see ../../../hooks/structural-organism-core.ts — ο writer
 * @see ../active-reinforcement.ts — resolveActiveBeamMaxWidthMm (ο reader)
 * @see docs/centralized-systems/reference/adrs/ADR-506-beam-width-auto-sizing.md
 */

import { createDerivedMapStore } from './derived-map-store';

/**
 * `beamId → DERIVED maxWidthMm` (cap πλάτους από τη στηρίζουσα κολώνα), ή `undefined` αν δεν
 * εντοπίστηκε στήριξη / πριν το πρώτο pass → ο caller μένει depth-only. ΕΝΑ SSoT
 * `createDerivedMapStore` (N.0.2 — κοινό boilerplate με Support/Span/Torsion stores).
 */
export const BeamMaxWidthStore = createDerivedMapStore<number>();
