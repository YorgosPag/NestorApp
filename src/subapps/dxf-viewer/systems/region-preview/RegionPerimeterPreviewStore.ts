/**
 * ADR-419 Layer 3 — module-level pub/sub store για το hover preview του
 * ανιχνευμένου περιγράμματος στα εργαλεία «σε περιοχή / από περίγραμμα» (κολώνες +
 * τοίχοι). Ίδιο pattern με `AutoAreaPreviewStore` / `HoverStore` (ADR-040).
 *
 * Revit «Finish Sketch» feedback: πριν το κλικ, ο χρήστης βλέπει το boundary που θα
 * δημιουργηθεί + τις διαστάσεις του· κόκκινο αν είναι πολύ μεγάλο (εξωτερικό
 * περίγραμμα του σχεδίου → δεν θα δημιουργηθεί).
 *
 * @see ../../components/dxf-layout/RegionPerimeterPreviewOverlay.tsx (renderer)
 * @see ../../hooks/canvas/useRegionPerimeterMouseMove.ts (producer)
 */

import type { Point2D } from '../../rendering/types/Types';
import { createExternalStore } from '../../stores/createExternalStore';

/**
 * ADR-419 §thickness-zones — μία ΖΩΝΗ σταθερού πάχους του ανιχνευμένου περιγράμματος.
 * Ένα ενιαίο ορθογώνιο = 1 ζώνη· ένα σύνθετο (rectilinear) περίγραμμα σπάει σε N ζώνες
 * (ένας τοίχος ανά ζώνη) → η preview δείχνει το ΙΔΙΟ split με το commit (preview ≡ commit).
 */
export interface RegionPerimeterZone {
  /** Κλειστό πολύγωνο (world units) της ζώνης. */
  polygon: Point2D[];
  /** Ετικέτα διαστάσεων της ζώνης, π.χ. «2.40 × 0.30 m». Κενή για rejected ζώνες (δείχνεται ο λόγος). */
  label: string;
  /** ADR-567 — `true` αν η ζώνη πέφτει πάνω σε υπάρχουσα δομική οντότητα → κόκκινο, δεν θα χτιστεί. */
  occupied?: boolean;
  /**
   * ADR-419 v2.4 «μία διαδρομή δημιουργίας» — i18n key του ΛΟΓΟΥ απόρριψης (π.χ.
   * `regionPerimeter.rejected.lengthTooShort`) όταν το rect ΔΕΝ γίνεται τοίχος. Παρών → κόκκινο
   * + tooltip με τον λόγο (Giorgio: επιλογή Α «κόκκινο + tooltip με ΛΟΓΟ»).
   */
  reason?: string;
}

/**
 * SSoT brand (Figma/enterprise «make illegal states unrepresentable»). Ο τύπος
 * `RegionPerimeterPreview` μπορεί να κατασκευαστεί ΜΟΝΟ από τους smart constructors
 * αυτού του module (`regionPerimeterPreview` / `singleZoneRegionPreview`) — το phantom
 * brand key δεν είναι exported, οπότε ένα raw literal σε producer (π.χ. το legacy
 * `{ polygon, label }` που προϋπήρχε των §thickness-zones και έσκαγε τον overlay στο
 * `zones.length`) γίνεται **compile error**. Έτσι όλοι οι producers συγκλίνουν στο ΕΝΑ
 * κανονικό σχήμα και ο overlay εμπιστεύεται τον τύπο (μηδέν defensive null-guards).
 */
declare const REGION_PERIMETER_PREVIEW_BRAND: unique symbol;

export interface RegionPerimeterPreview {
  /** Μία ή περισσότερες ζώνες σταθερού πάχους (ένας τοίχος ανά ζώνη). */
  readonly zones: readonly RegionPerimeterZone[];
  /** `true` αν ξεπερνά το λογικό δομικό μέλος (Layer 4) → κόκκινο, δεν χτίζεται. */
  readonly oversized: boolean;
  /** @internal SSoT brand — ΜΗΝ το ορίζεις· κατασκεύασε μέσω των builders παρακάτω. */
  readonly [REGION_PERIMETER_PREVIEW_BRAND]: true;
}

// ─── SSoT smart constructors (η ΜΟΝΑΔΙΚΗ πηγή σχήματος για ΟΛΟΥΣ τους producers) ──

/**
 * Multi-zone preview (thickness-zones split: ένας τοίχος/μέλος ανά ζώνη). Ο producer
 * hover (`useRegionPerimeterMouseMove`) περνά τις ήδη-υπολογισμένες ζώνες εδώ.
 */
export function regionPerimeterPreview(
  zones: readonly RegionPerimeterZone[],
  oversized: boolean,
): RegionPerimeterPreview {
  return { zones, oversized } as RegionPerimeterPreview;
}

/**
 * Single-zone preview — ΕΝΑ ανιχνευμένο περίγραμμα (χωρίς split), για τα adopt/measure
 * εργαλεία (π.χ. `use-column-rect-adopt`). Τυλίγει το polygon+label στην κανονική
 * `zones[]` δομή, ώστε κανένα εργαλείο να μη χτίζει ξανά legacy σχήμα με το χέρι.
 */
export function singleZoneRegionPreview(
  polygon: Point2D[],
  label: string,
  oversized: boolean,
  extra?: Pick<RegionPerimeterZone, 'occupied' | 'reason'>,
): RegionPerimeterPreview {
  return regionPerimeterPreview([{ polygon, label, ...extra }], oversized);
}

// SSoT pub/sub machinery via `createExternalStore` (always-notify). Public API identical;
// state is minted ONLY through the branded smart constructors above.
const store = createExternalStore<RegionPerimeterPreview | null>(null);

export function setRegionPerimeterPreview(next: RegionPerimeterPreview | null): void {
  store.set(next);
}

export function getRegionPerimeterPreview(): RegionPerimeterPreview | null {
  return store.get();
}

export function subscribeRegionPerimeterPreview(fn: () => void): () => void {
  return store.subscribe(fn);
}

export function clearRegionPerimeterPreview(): void {
  store.set(null);
}
