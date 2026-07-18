/**
 * structural-placement-overlap — SSoT «καμία δομική οντότητα πάνω σε υπάρχουσα» (ADR-567).
 *
 * Giorgio (2026-07-03): ΠΟΤΕ να μην τοποθετείται τοίχος — και κάθε δομική BIM οντότητα —
 * σε περιοχή που ήδη καταλαμβάνει άλλη δομική. **Κανόνας:**
 *   · BLOCK ουσιαστική επικάλυψη εμβαδού (πλήρης Α + μερική Β),
 *   · ALLOW γωνίες/ενώσεις/διασταυρώσεις που μοιράζονται μόνο παρειά/σημείο ή μικρό τετράγωνο (C).
 *
 * Ο διαχωρισμός «ένωση» (allow) ↔ «επικάλυψη» (block) γίνεται με **ratio** = εμβαδόν τομής /
 * μικρότερο footprint. Διασταύρωση τοίχων (+/T) → ratio ~πάχος/μήκος (μικρό) → allow· διπλότυπο
 * πάνω-πάνω → ~100% → block· μισός-πάνω-στον-άλλο → ~50% → block.
 *
 * ΚΑΘΑΡΟ (pure) — zero React/DOM/store. **Reuse μόνο υπάρχοντα primitives** (N.0.2):
 *   · `safeIntersection` + `multiPolygonArea` — bim/geometry/shared (boolean/area SSoT),
 *   · `wallFootprintPolygon` — bim/finishes (miter-aware union),
 *   · `resolveMemberFootprintVertices` — bim/structural (column/beam footprint).
 *
 * Host-child εξαιρέσεις είναι εγγενείς: `opening`/`slab-opening` ΔΕΝ ανήκουν στο
 * {@link STRUCTURAL_OVERLAP_TYPES} (ζουν μέσα σε τοίχο/πλάκα by design) → ποτέ δεν μπλοκάρουν.
 *
 * @see ../scene/append-entity-to-scene.ts — guard (column/beam/slab/foundation)
 * @see ../walls/add-wall-to-scene.ts — guard (τοίχος)
 * @see docs/centralized-systems/reference/adrs/ADR-567-structural-no-overlap-placement.md
 */

import type { Pair, Polygon } from 'polygon-clipping';
import type { Point2D } from '../../rendering/types/Types';
import {
  isWallEntity,
  isColumnEntity,
  isBeamEntity,
  isSlabEntity,
  isFoundationEntity,
  type Entity,
} from '../../types/entities';
import { safeIntersection } from '../geometry/shared/safe-polygon-boolean';
import { multiPolygonArea, projectVerticesTo2D } from '../geometry/shared/polygon-utils';
import { wallFootprintPolygon } from '../finishes/wall-footprint-union';
import { resolveMemberFootprintVertices } from '../structural/member-footprint-2d';

/**
 * Οι δομικές («Δομικά») οντότητες που ελέγχονται για επικάλυψη (Φ1). `opening`/`slab-opening`
 * εξαιρούνται εγγενώς (host-child)· stair/railing/roof = Φ2 (thin/σύνθετα footprints).
 */
export const STRUCTURAL_OVERLAP_TYPES: ReadonlySet<Entity['type']> = new Set<Entity['type']>([
  'wall',
  'column',
  'beam',
  'slab',
  'foundation',
]);

/**
 * Κατώφλι: επικάλυψη ≥ 25% του μικρότερου footprint → BLOCK. Διασταυρώσεις/ενώσεις (~7%) περνούν.
 * Giorgio-tunable (default· ο caller μπορεί να το παρακάμψει).
 */
export const DEFAULT_OVERLAP_RATIO_THRESHOLD = 0.25;

/**
 * Ομάδα σύγκρουσης κατοχής χώρου (ADR-567 Φ1b· Giorgio 2026-07-18 §wall-column). Δύο δομικές
 * μπλοκάρουν επικάλυψη **μόνο** αν ανήκουν στην ΙΔΙΑ ομάδα. Κάθε συμπαγής δομικός τύπος είναι
 * **δική του** ομάδα → μπλοκάρεται ΜΟΝΟ από ομοειδή (διπλότυπο):
 *   · `wall` — τοίχος-σε-τοίχο μπλοκάρει (διπλότυπο). ⚠️ ΔΕΝ μπλοκάρεται από κολόνα.
 *   · `column` — κολόνα-σε-κολόνα μπλοκάρει. ⚠️ ΔΕΝ μπλοκάρεται από τοίχο.
 *   · `beam` / `slab` — οριζόντια μέλη που κάθονται ΠΑΝΩ (διαφορετικό Z: ring/tie beam στην κορυφή
 *     τοίχου, πλάκα πάνω σε δοκάρια/τοίχους). Δεν συγκρούονται με τα κατακόρυφα → γι' αυτό «Δοκάρι
 *     από τοίχο» / «πλάκα πάνω σε τοίχους» είναι ΝΟΜΙΜΑ· διπλότυπο δοκάρι-σε-δοκάρι / πλάκα-σε-πλάκα
 *     εξακολουθεί να μπλοκάρεται.
 *   · `foundation` — υπόβαση, κάτω από όλα· μόνο πέδιλο-σε-πέδιλο μπλοκάρει.
 *
 * §wall-column (Giorgio 2026-07-18) — τοίχος & κολόνα ήταν κοινή ομάδα `vertical` → ο τοίχος που
 * πλαισίωνε/ένωνε 2 κολόνες μπλοκαριζόταν ως «διπλότυπο» (το άκρο του κάλυπτε >25% του μικρού
 * footprint της κολόνας). Λάθος: τοίχος που ενώνεται σε κολόνα είναι θεμελιώδης πράξη (Revit — η
 * κολόνα ενσωματώνεται στον τοίχο· το άκρο κόβεται flush μέσω ADR-363 §wall-column-end-miter).
 * Χωρίστηκαν σε ξεχωριστές ομάδες → wall↔column ΠΟΤΕ δεν μπλοκάρουν μεταξύ τους (συμμετρικά).
 */
export type StructuralCollisionGroup = 'wall' | 'column' | 'beam' | 'slab' | 'foundation';

const COLLISION_GROUP_BY_TYPE: Partial<Record<Entity['type'], StructuralCollisionGroup>> = {
  wall: 'wall',
  column: 'column',
  beam: 'beam',
  slab: 'slab',
  foundation: 'foundation',
};

/** Η collision group ενός τύπου, ή `null` αν δεν είναι δομικός (host-child/thin/μη-δομικός). */
export function structuralCollisionGroupOf(type: Entity['type']): StructuralCollisionGroup | null {
  return COLLISION_GROUP_BY_TYPE[type] ?? null;
}

/** Αποτέλεσμα: η πρώτη υπάρχουσα οντότητα που μπλοκάρει την τοποθέτηση, + το ποσοστό επικάλυψης. */
export interface StructuralOverlapHit {
  readonly blockedById: string;
  readonly ratio: number;
}

/**
 * 2D plan footprint (world/scene units) μιας δομικής οντότητας, ή `null` αν δεν υπάρχει έγκυρο
 * πολύγωνο (≥3 κορυφές) ή ο τύπος δεν είναι δομικός. Reuse των υπαρχουσών geometry πηγών —
 * ΜΗΔΕΝ νέο math:
 *   wall → `wallFootprintPolygon` (raw ∪ mitered)· column/beam → `resolveMemberFootprintVertices`·
 *   foundation → `geometry.footprint.vertices`· slab → `geometry.polygon.vertices`.
 */
export function structuralFootprintOf(entity: Entity): Point2D[] | null {
  if (isWallEntity(entity)) {
    return toPoint2DArray(wallFootprintPolygon(entity));
  }
  if (isColumnEntity(entity) || isBeamEntity(entity)) {
    return toPoint2DArray(resolveMemberFootprintVertices(entity));
  }
  if (isFoundationEntity(entity)) {
    return toPoint2DArray(entity.geometry?.footprint?.vertices);
  }
  if (isSlabEntity(entity)) {
    return toPoint2DArray(entity.geometry?.polygon?.vertices);
  }
  return null;
}

/**
 * Η πρώτη υπάρχουσα δομική οντότητα της οποίας το footprint επικαλύπτεται με το `candidateFootprint`
 * πάνω από το κατώφλι· `null` αν καμία (καθαρή τοποθέτηση). Άγγιγμα-μόνο (εμβαδόν τομής ≈ 0) → allow.
 * Pure — ο caller δίνει τα `existing` (scene entities) + optional `excludeIds` (π.χ. self).
 *
 * `candidateType` (ADR-567 Φ1b): όταν δοθεί, ελέγχονται ΜΟΝΟ οι υπάρχουσες οντότητες της ΙΔΙΑΣ
 * {@link StructuralCollisionGroup} με το candidate (π.χ. δοκάρι κρίνεται μόνο εναντίον δοκαριών,
 * ΟΧΙ τοίχων — γι' αυτό «Δοκάρι από τοίχο» δεν μπλοκάρεται). Αν παραλειφθεί → ελέγχονται όλες οι
 * δομικές (legacy behaviour).
 */
export function findStructuralOverlap(
  candidateFootprint: readonly Point2D[],
  existing: readonly Entity[],
  opts?: { excludeIds?: ReadonlySet<string>; ratioThreshold?: number; candidateType?: Entity['type'] },
): StructuralOverlapHit | null {
  if (candidateFootprint.length < 3) return null;
  const threshold = opts?.ratioThreshold ?? DEFAULT_OVERLAP_RATIO_THRESHOLD;
  const candGroup = opts?.candidateType ? structuralCollisionGroupOf(opts.candidateType) : null;
  const candClip = toClipPolygon(candidateFootprint);
  const candArea = multiPolygonArea([candClip]);
  if (candArea <= 0) return null;
  const candBbox = bboxOf(candidateFootprint);

  for (const e of existing) {
    if (opts?.excludeIds?.has(e.id)) continue;
    if (!STRUCTURAL_OVERLAP_TYPES.has(e.type)) continue;
    // ADR-567 Φ1b — μόνο ίδια collision group συγκρούεται (οριζόντιο δοκάρι/πλάκα κάθεται πάνω
    // σε κατακόρυφο τοίχο/κολόνα σε διαφορετικό Z → δεν είναι επικάλυψη όγκου).
    if (candGroup && structuralCollisionGroupOf(e.type) !== candGroup) continue;
    const ef = structuralFootprintOf(e);
    if (!ef) continue;
    // Φτηνό AABB fast-reject ΠΡΙΝ το βαρύ polygon-clipping (per-frame hover, N.17 perf).
    if (bboxDisjoint(candBbox, bboxOf(ef))) continue;
    const efClip = toClipPolygon(ef);
    const efArea = multiPolygonArea([efClip]);
    if (efArea <= 0) continue;
    const interArea = multiPolygonArea(safeIntersection(candClip, efClip));
    if (interArea <= 0) continue; // touch-only (κοινή παρειά/σημείο) → allow
    const ratio = interArea / Math.min(candArea, efArea);
    if (ratio >= threshold) return { blockedById: e.id, ratio };
  }
  return null;
}

/** Axis-aligned bbox ενός footprint. */
function bboxOf(footprint: readonly Point2D[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of footprint) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/** `true` αν δύο bboxes ΔΕΝ τέμνονται (καμία επικάλυψη δυνατή → skip intersection). */
function bboxDisjoint(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
  return a.maxX < b.minX || b.maxX < a.minX || a.maxY < b.minY || b.maxY < a.minY;
}

/** `Point3D`/`Pt2` array → `Point2D[]` (projection SSoT `projectVerticesTo2D`)· `null` αν <3 κορυφές. */
function toPoint2DArray(verts: ReadonlyArray<{ x: number; y: number }> | undefined | null): Point2D[] | null {
  if (!verts || verts.length < 3) return null;
  return projectVerticesTo2D(verts);
}

/** `Point2D[]` → κλειστό CCW-agnostic polygon-clipping `Polygon` (ένα ring). */
function toClipPolygon(footprint: readonly Point2D[]): Polygon {
  const ring: Pair[] = footprint.map((p) => [p.x, p.y]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);
  return [ring];
}
