/**
 * @fileoverview **ΤΙ ΔΕΙΧΝΕΙ Η ΚΑΤΟΨΗ ΓΙΑ ΤΟΥΣ ΧΩΡΟΥΣ** — ποιος χώρος περιέχει ποιο σημείο, ποιοι χώροι είναι ενιαίοι γείτονες,
 * τι εμβαδόν λέγεται και πού γράφεται η ετικέτα (ADR-884 Φ2στ-γ Γ3γ-1 · §4.14 · §12 Δ8.2–Δ8.5). Καθαρό.
 * @related `tour-viewer-shapes.ts` (τι ταξιδεύει) · `lib/geometry/planar-polygon.ts` · `lib/geometry/polygon-label-point.ts` ·
 *   `components/spatial-tour/viewer/TourPlanSpaces.tsx` (ο καταναλωτής)
 * @module lib/spatial-tour/viewer/tour-space-view
 *
 * 🔑 **Τίποτα δεν αποθηκεύεται, όλα παράγονται** (Revit Rooms): η συμμετοχή σημείου = σημείο-μέσα-σε-πολύγωνο της θέσης του· η
 *   γειτονία = δύο χώροι που ακουμπούν την **ίδια** νοητή γραμμή. Μετακινείς σημείο ή σβήνεις γραμμή ⇒ η κάτοψη αλλάζει μόνη της.
 * 🔑 **Σημείο εκτός κάθε χώρου ⇒ κανένας χώρος** (Δ8.3) — ποτέ «ο πλησιέστερος»: ένα επινοημένο κίτρινο πάνω σε ακίνητο προς
 *   πώληση είναι ψέμα.
 * 🔑 **Κοινός αληθινός τοίχος ≠ γειτονία**: μόνο η νοητή γραμμή ενώνει (Δ8.2). Κουζίνα και μπάνιο με κοινό τοίχο δεν «ανάβουν» μαζί.
 */

import {
  TOUR_DECLARED_AREA_WARN_RATIO,
  TOUR_SPACE_ADJACENCY_TOLERANCE_M,
  type TourDeclaredAreaSource,
} from '@/constants/spatial-tour-vocabulary';
import { distanceToRing, pointInPolygon, polygonArea, type PlanarPoint } from '@/lib/geometry/planar-polygon';
import { polygonLabelPoint, type PolygonLabelPoint } from '@/lib/geometry/polygon-label-point';

import type { TourViewerSeparation, TourViewerSpace } from './tour-viewer-shapes';

/** Δείγματα κατά μήκος μιας νοητής γραμμής — τα άκρα της μπαίνουν μέσα στους τοίχους, άρα κρίνει η **πλειοψηφία**. */
const LINE_SAMPLES = 9;
/** Ακρίβεια του σημείου ετικέτας (μέτρα) — ένα εκατοστό είναι αόρατο σε κάθε ζουμ της κάρτας. */
const LABEL_PRECISION_M = 0.01;

export type TourSpaceArea =
  | { readonly kind: 'declared'; readonly areaM2: number; readonly source: TourDeclaredAreaSource }
  | { readonly kind: 'measured'; readonly areaM2: number };

/** Ο χώρος που περιέχει το σημείο — `null` όταν κανένας (Δ8.3). Οι χώροι δεν επικαλύπτονται (ο γραφέας το αρνείται). */
export function spaceAt(spaces: readonly TourViewerSpace[], point: PlanarPoint): TourViewerSpace | null {
  return spaces.find((space) => pointInPolygon(point, space.points)) ?? null;
}

/** Ακουμπά ο χώρος τη γραμμή; — η πλειοψηφία των δειγμάτων της κοντά στο σύνορό του. */
export function spaceTouchesLine(space: TourViewerSpace, line: TourViewerSeparation): boolean {
  let near = 0;
  for (let i = 0; i < LINE_SAMPLES; i++) {
    const f = (i + 0.5) / LINE_SAMPLES;
    const sample = { x: line.a.x + (line.b.x - line.a.x) * f, y: line.a.y + (line.b.y - line.a.y) * f };
    if (distanceToRing(sample, space.points) <= TOUR_SPACE_ADJACENCY_TOLERANCE_M) near += 1;
  }
  return near * 2 > LINE_SAMPLES;
}

/**
 * **Οι ενιαίοι γείτονες** ενός χώρου (Δ8.2) — όσοι ακουμπούν μια νοητή γραμμή που ακουμπά κι αυτός. Ο ίδιος ο χώρος **δεν**
 * περιέχεται.
 */
export function joinedSpaceIds(
  spaces: readonly TourViewerSpace[],
  separations: readonly TourViewerSeparation[],
  spaceId: string,
): ReadonlySet<string> {
  const own = spaces.find((space) => space.id === spaceId);
  const joined = new Set<string>();
  if (own === undefined) return joined;
  for (const line of separations) {
    if (!spaceTouchesLine(own, line)) continue;
    for (const other of spaces) if (other.id !== spaceId && spaceTouchesLine(other, line)) joined.add(other.id);
  }
  return joined;
}

/** **Το εμβαδόν που λέγεται** (Δ8.4): το δηλωμένο υπερισχύει (με την πηγή του), αλλιώς το μετρημένο από τις κορυφές. */
export function spaceArea(space: TourViewerSpace): TourSpaceArea {
  const declared = space.declaredArea ?? null;
  return declared === null
    ? { kind: 'measured', areaM2: polygonArea(space.points) }
    : { kind: 'declared', areaM2: declared.areaM2, source: declared.source };
}

/** Πού γράφεται η ετικέτα — ο πόλος απροσπέλαστου, με το πόσο χώρο έχει γύρω του. */
export function spaceLabelPoint(space: TourViewerSpace): PolygonLabelPoint {
  return polygonLabelPoint(space.points, LABEL_PRECISION_M);
}

/**
 * Ο ρόλος ενός χώρου πάνω στην κάτοψη (Δ8.2 · Δ8.3 · Δ8.5): `here` = εκεί είναι ο επισκέπτης · `joined` = ενιαίος γείτονας του
 * `here` · `uncaptured` = κανένα σημείο λήψης μέσα (η αποθήκη) · `idle` = άλλος χώρος με σημείο.
 */
export type TourSpaceTone = 'here' | 'joined' | 'uncaptured' | 'idle';

export interface PlanSpace {
  readonly space: TourViewerSpace;
  readonly tone: TourSpaceTone;
  /** Τα σημεία λήψης μέσα στον χώρο, με τη σειρά τους — το πρώτο δίνει το όνομα (Δ8.5: το όνομα σημείου υπερισχύει). */
  readonly nodeIds: readonly string[];
}

export interface PlacedPoint {
  readonly nodeId: string;
  readonly point: PlanarPoint;
}

/** **Οι χώροι του ορόφου με ρόλο** — ένα πέρασμα· ο τρέχων κόμβος εκτός ορόφου ή εκτός χώρου ⇒ κανένα κίτρινο (Δ8.3). */
export function planSpaces(
  spaces: readonly TourViewerSpace[],
  separations: readonly TourViewerSeparation[],
  placed: readonly PlacedPoint[],
  currentNodeId: string | null,
): readonly PlanSpace[] {
  const inside = new Map<string, string[]>(spaces.map((space) => [space.id, []]));
  for (const { nodeId, point } of placed) {
    const space = spaceAt(spaces, point);
    if (space !== null) inside.get(space.id)?.push(nodeId);
  }
  const current = placed.find((p) => p.nodeId === currentNodeId);
  const here = current === undefined ? null : spaceAt(spaces, current.point);
  const joined = here === null ? new Set<string>() : joinedSpaceIds(spaces, separations, here.id);
  return spaces.map((space) => {
    const nodeIds = inside.get(space.id) ?? [];
    const tone: TourSpaceTone = space.id === here?.id ? 'here'
      : joined.has(space.id) ? 'joined'
      : nodeIds.length === 0 ? 'uncaptured' : 'idle';
    return { space, tone, nodeIds };
  });
}

/** Η πληρότητα ενός ορόφου (Δ8.3): πόσα τοποθετημένα σημεία έχουν χώρο — και **ποια** λείπουν, με τη σειρά τους. */
export interface SpaceCoverage {
  readonly covered: number;
  readonly total: number;
  readonly missing: readonly string[];
}

/** «Χώροι: 3 από 4 σημεία» — προειδοποίηση του επεξεργαστή, **όχι** φραγή δημοσίευσης (Δ8.3). */
export function spaceCoverage(spaces: readonly TourViewerSpace[], placed: readonly PlacedPoint[]): SpaceCoverage {
  const missing = placed.filter(({ point }) => spaceAt(spaces, point) === null).map(({ nodeId }) => nodeId);
  return { covered: placed.length - missing.length, total: placed.length, missing };
}

/**
 * **Φύλακας 15%** (Δ8.4 · Δ9.4): απέχει το δηλωμένο από το μετρημένο περισσότερο από {@link TOUR_DECLARED_AREA_WARN_RATIO}; —
 * σχετικά με το **μετρημένο** («δηλώσατε 20, η κάτοψη δείχνει ≈ 12»). Μετρημένο ≤ 0 ⇒ ποτέ (δεν υπάρχει μέτρο σύγκρισης).
 */
export function declaredAreaDeviates(declaredM2: number, measuredM2: number): boolean {
  if (!(measuredM2 > 0)) return false;
  return Math.abs(declaredM2 - measuredM2) / measuredM2 > TOUR_DECLARED_AREA_WARN_RATIO;
}

/** Μέσο πλάτος χαρακτήρα ως κλάσμα του μεγέθους γραμματοσειράς — συντηρητικό για ελληνικά/λατινικά κεφαλαία-πεζά. */
const CHAR_WIDTH_EM = 0.6;
/** Ύψος γραμμής ως κλάσμα του μεγέθους γραμματοσειράς. */
export const LABEL_LINE_EM = 1.2;

/**
 * **Χωράει η ετικέτα;** — κανένα κείμενο πάνω σε τοίχο ή στο διπλανό δωμάτιο. Ο εγγεγραμμένος κύκλος (`clearance`) είναι
 * συντηρητικός για τα ορθογώνια δωμάτια: το μισό **ύψος** των γραμμών πρέπει να χωρά μέσα του, το μισό **πλάτος** μέσα σε
 * √2 φορές την ακτίνα (η διαγώνιος του εγγεγραμμένου τετραγώνου). Μονάδες: του πολυγώνου (μέτρα).
 */
export function labelFits(clearance: number, lines: readonly string[], fontSize: number): boolean {
  const width = Math.max(0, ...lines.map((line) => line.length)) * CHAR_WIDTH_EM * fontSize;
  const height = lines.length * LABEL_LINE_EM * fontSize;
  return height / 2 <= clearance && width / 2 <= clearance * Math.SQRT2;
}
