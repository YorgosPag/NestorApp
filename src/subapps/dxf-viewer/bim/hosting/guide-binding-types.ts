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
  /**
   * Σταθερή μετατόπιση (mm, signed) του coordinate ΠΕΡΑ από το offset του άξονα,
   * κατά μήκος της διεύθυνσης του slot. Επιβιώνει του follow-on-move γιατί είναι
   * σταθερή απόσταση *σχετικά* με τον (μετακινούμενο) άξονα.
   *
   * Χρήση (ADR-441 Slice JOIN): corner-fill της εσχάρας — τα 4 γωνιακά endpoints
   * προεκτείνονται κατά ±width/2 προς τα έξω ώστε να κλείσουν τα κενά τεταρτημόρια
   * στις εξωτερικές γωνίες. `undefined` → καμία μετατόπιση (coordinate = offset).
   */
  readonly extend?: number;
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

/**
 * Type-guard: η entity φέρει τουλάχιστον ένα guide binding. Generic ώστε (α) να
 * διατηρεί το input type μετά το narrow (`T & {guideBindings}`, π.χ. `FoundationEntity`)
 * και (β) να δέχεται ευρείες union scene entities χωρίς weak-type error — το κοινό
 * `type` property εξασφαλίζει overlap (το `HostedEntityMixin` μόνο του είναι weak type:
 * όλα optional → ένα DXF `LineEntity` δεν θα είχε «κανένα κοινό property»).
 */
export function hasGuideBindings<T extends HostedEntityMixin & { readonly type?: unknown }>(
  entity: T,
): entity is T & { readonly guideBindings: readonly GuideBinding[] } {
  return Array.isArray(entity.guideBindings) && entity.guideBindings.length > 0;
}
