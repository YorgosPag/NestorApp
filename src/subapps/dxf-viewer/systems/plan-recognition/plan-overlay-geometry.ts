/**
 * ADR-929 Φ5 — η γεωμετρία της επικάλυψης αναγνώρισης σε **συντεταγμένες σκηνής**, ομαδοποιημένη ανά επίπεδο
 * βεβαιότητας ή, για τα τμήματα εκτός τοίχων, ανά σημάδι ρόλου (Φ5.4β). Υπολογίζεται μία φορά ανά (αποτέλεσμα σύντηξης, τοποθέτηση)· η προβολή στην οθόνη γίνεται στο φύλλο
 * του καμβά ανά transform (ADR-040). Η μόνη αντιστοίχιση px → σκηνή είναι το `rasterPixelToScene` (Δ3).
 *
 * ADR-929 §6.21.9 (Ε2) — η επικάλυψη ζωγραφίζει τα **συνορθωμένα** τμήματα (ό,τι θα γραφτεί, όπως η προεπισκόπηση του
 * βοηθού) και ενώνει κάθε **γωνία** της σύντηξης (`segmentCorners`) σε πολυγραμμή, ώστε η ένωση να είναι γωνία πινελιάς
 * (`stroke-linejoin`) και όχι δύο απολήξεις που προεξέχουν. Γωνία ανάμεσα σε δύο **διαφορετικά** σημάδια μένει δύο
 * πινελιές: ένα path έχει ένα στυλ.
 *
 * ΚΑΘΑΡΟ — zero React/DOM/store.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { PlanConfidence, PlanSegmentRole, RasterSegment } from '../../bim/plan-recognition/plan-recognition-types';
import { rasterPixelToScene, type RasterPlacement } from '../../floorplan-background/geometry/raster-scene-mapping';
import { chainLinkedSegments, type SegmentEndLink } from '@/lib/geometry/linked-segment-chains';
import type { SegmentCorner } from '../../bim/plan-recognition/fusion/segment-junctions';
import { planConfidenceTier, type PlanConfidenceTier } from './plan-confidence';
import { planRoleMarkKind, type PlanRoleMarkKind } from './plan-role-marks';
import type { PlanScaleReferenceSet } from '../../bim/plan-recognition/fusion/scale-references';
import type { RasterRectPx } from '../../types/coordinate-space';

export type SceneSegment = readonly [Point2D, Point2D];

/** Μια πολυγραμμή της επικάλυψης στη σκηνή: ένα ή περισσότερα τμήματα του ίδιου σημαδιού, ενωμένα στις γωνίες τους. */
export interface ScenePolyline {
  readonly points: readonly Point2D[];
  /** Κλειστός βρόχος (π.χ. ορθογώνιο) ⇒ `Z`: ενώνεται και η τελευταία γωνία. */
  readonly closed: boolean;
  /** Πόσα τμήματα της αναγνώρισης ζωγραφίζει (για το `data-count`: κάθε τμήμα μετριέται μία φορά). */
  readonly segmentCount: number;
}

export type PolylinesByTier = Readonly<Record<PlanConfidenceTier, readonly ScenePolyline[]>>;

/** ADR-929 Φ5.4β — ανά σημάδι ρόλου (μόνο όσα η πολιτική βγάζει εκτός τοίχων). */
export type PolylinesByRoleMark = Readonly<Record<PlanRoleMarkKind, readonly ScenePolyline[]>>;

/** Η επικάλυψη: κάθε τμήμα σε **ακριβώς ένα** από τα δύο — σημάδι ρόλου αν είναι εκτός τοίχων, αλλιώς επίπεδο. */
export interface PlanOverlayPolylines {
  readonly byTier: PolylinesByTier;
  readonly byRole: PolylinesByRoleMark;
}

/** ADR-929 Φ5.3γ — μια διάσταση της κάρτας κλίμακας στη σκηνή: γραμμή μέτρησης (χρησιμοποιημένη) ή το κείμενό της (απορριφθείσα). */
export interface SceneScaleReference {
  readonly textId: string;
  readonly segment: SceneSegment;
}

interface SceneRejectedDimension {
  readonly textId: string;
  /** Το πλαίσιο του κειμένου της διάστασης, κλειστό τετράπλευρο στη σκηνή. */
  readonly ring: readonly Point2D[];
}

interface SceneScaleReferences {
  readonly used: readonly SceneScaleReference[];
  readonly rejected: readonly SceneRejectedDimension[];
}

/** Το πλαίσιο ενός κειμένου (αρχικά px) ως κλειστό τετράπλευρο στη σκηνή — κάρτα κλίμακας και «Τι διάβασα» (Δ21 (δ)). */
export function sceneTextRing(rect: RasterRectPx, placement: RasterPlacement): readonly Point2D[] {
  return [
    { x: rect.minX, y: rect.minY }, { x: rect.maxX, y: rect.minY },
    { x: rect.maxX, y: rect.maxY }, { x: rect.minX, y: rect.maxY },
  ].map((p) => rasterPixelToScene(p, placement));
}

/** ADR-929 Φ5.3γ — οι διαστάσεις της κάρτας κλίμακας στη σκηνή (η ίδια αντιστοίχιση px → σκηνή, Δ3). */
export function sceneScaleReferences(set: PlanScaleReferenceSet, placement: RasterPlacement): SceneScaleReferences {
  const toScene = (p: Point2D): Point2D => rasterPixelToScene(p, placement);
  return {
    used: set.used.map((r) => ({ textId: r.textId, segment: [toScene(r.a), toScene(r.b)] as const })),
    rejected: set.rejected.map((r) => ({ textId: r.textId, ring: sceneTextRing(r.rect, placement) })),
  };
}

/** Οι γωνίες της σύντηξης που πέφτουν **μέσα** στην ομάδα, ως ενώσεις άκρων στις θέσεις της ομάδας. */
function groupLinks(group: readonly RasterSegment[], corners: readonly SegmentCorner[]): SegmentEndLink[] {
  const indexOf = new Map(group.map((s, i) => [s.id, i]));
  const links: SegmentEndLink[] = [];
  for (const c of corners) {
    const a = indexOf.get(c.a.segmentId);
    const b = indexOf.get(c.b.segmentId);
    if (a !== undefined && b !== undefined) links.push({ a: { index: a, end: c.a.end }, b: { index: b, end: c.b.end } });
  }
  return links;
}

/** Τα τμήματα ενός σημαδιού ως πολυγραμμές σκηνής (η αλυσίδα κρίνεται στα px, η προβολή γίνεται στο τέλος). */
function groupPolylines(group: readonly RasterSegment[], corners: readonly SegmentCorner[], placement: RasterPlacement): ScenePolyline[] {
  return chainLinkedSegments(group, groupLinks(group, corners)).map((chain) => ({
    points: chain.points.map((p) => rasterPixelToScene(p, placement)),
    closed: chain.closed,
    segmentCount: chain.segmentIndices.length,
  }));
}

/**
 * Τα τμήματα της εικόνας στη σκηνή: όσα η πολιτική ρόλων βγάζει εκτός τοίχων ⇒ στο σημάδι του ρόλου τους· τα υπόλοιπα
 * ⇒ στο επίπεδο βεβαιότητας της σύντηξης. Ένα τμήμα δεν ζωγραφίζεται ποτέ δύο φορές. Μέσα σε κάθε σημάδι οι γωνίες
 * (`corners`, από τη σύντηξη — καμία δεύτερη κρίση εδώ) ενώνουν τα τμήματα σε πολυγραμμές.
 */
export function scenePlanSegments(
  segments: readonly RasterSegment[],
  confidence: ReadonlyMap<string, PlanConfidence>,
  roles: ReadonlyMap<string, PlanSegmentRole>,
  corners: readonly SegmentCorner[],
  placement: RasterPlacement,
): PlanOverlayPolylines {
  const tiers: Record<PlanConfidenceTier, RasterSegment[]> = { high: [], medium: [], low: [] };
  const marks: Record<PlanRoleMarkKind, RasterSegment[]> = { dimension: [], annotation: [] };
  for (const segment of segments) {
    const roleMark = planRoleMarkKind(roles.get(segment.id));
    if (roleMark) marks[roleMark].push(segment);
    else tiers[planConfidenceTier(confidence.get(segment.id)?.score)].push(segment);
  }
  const chain = (group: readonly RasterSegment[]): ScenePolyline[] => groupPolylines(group, corners, placement);
  return {
    byTier: { high: chain(tiers.high), medium: chain(tiers.medium), low: chain(tiers.low) },
    byRole: { dimension: chain(marks.dimension), annotation: chain(marks.annotation) },
  };
}
