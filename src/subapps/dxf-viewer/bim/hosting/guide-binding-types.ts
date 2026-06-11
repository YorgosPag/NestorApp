/**
 * Associative Grid Hosting — Binding Types (ADR-441, Slice 0).
 *
 * SSoT μοντέλο για το «κρέμασμα» BIM entities σε άξονες κανάβου (guides, ADR-189).
 * Slot-based: κάθε binding δηλώνει ΠΟΙΟ guide ελέγχει ΠΟΙΑ διάσταση της entity, ώστε
 * όταν ο άξονας μετακινηθεί, η entity να μπορεί να re-derive τη γεωμετρία της
 * (= το «move χωρίς να σπάει» — follow-on-move, ADR-441 Slice 3).
 *
 * Generic ανά BIM kind: ένα κατακόρυφο X-strip από yOff[i]→yOff[i+1] δηλώνει
 *   [{X,'start-x'},{X,'end-x'},{Yi,'start-y'},{Yj,'end-y'}].
 * Σημειακά (pad/column) χρησιμοποιούν 'center-x'/'center-y'.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md
 * @see docs/centralized-systems/reference/adrs/ADR-189-construction-grid-guide-system.md
 */

/**
 * Ρόλος ενός guide ως προς μία διάσταση της hosted entity.
 * - 'start-x' / 'start-y' → ελέγχει το start point (γραμμικά: strip/tie-beam/beam/wall)
 * - 'end-x'   / 'end-y'   → ελέγχει το end point   (γραμμικά)
 * - 'center-x'/ 'center-y'→ ελέγχει το position/center (σημειακά: pad/column)
 */
export type GuideBindingSlot =
  | 'start-x'
  | 'start-y'
  | 'end-x'
  | 'end-y'
  | 'center-x'
  | 'center-y';

/** Σύνδεση μίας διάστασης της entity με έναν άξονα κανάβου. */
export interface GuideBinding {
  /** ID του guide (άξονα) που ελέγχει αυτό το slot. */
  readonly guideId: string;
  /** Ποια διάσταση της entity ελέγχει ο άξονας. */
  readonly slot: GuideBindingSlot;
}

/**
 * Mixin για entities που μπορούν να κρεμαστούν σε άξονες κανάβου.
 * Optional → backward-compatible (entities χωρίς bindings = ανεξάρτητες, ως σήμερα).
 */
export interface HostedEntityMixin {
  readonly guideBindings?: readonly GuideBinding[];
}

/** Μοναδικά guide ids ενός συνόλου bindings (για inverted-index lookup, Slice 3). */
export function extractBoundGuideIds(
  bindings: readonly GuideBinding[],
): readonly string[] {
  return Array.from(new Set(bindings.map((b) => b.guideId)));
}

/** Type-guard: η entity φέρει τουλάχιστον ένα guide binding. */
export function hasGuideBindings(
  entity: HostedEntityMixin,
): entity is HostedEntityMixin & { readonly guideBindings: readonly GuideBinding[] } {
  return Array.isArray(entity.guideBindings) && entity.guideBindings.length > 0;
}
