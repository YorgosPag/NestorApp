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
 * §join-is-not-occupation (ADR-911 Φ3α-2): για ζεύγος ΤΟΙΧΩΝ το ratio μετριέται στα αποτυπώματα
 * ΜΕΤΑ την ένωση (`./wall-join-overlap`). Το κοινό κομμάτι μιας ένωσης δεν εξαρτάται από το
 * μήκος του τοίχου, άρα για κοντό τοίχο το ωμό ratio έβγαινε 33–55% = ψευδής κατάληψη.
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
import type { WallEntity } from '../types/wall-types';
import { joinedWallPairFootprints } from './wall-join-overlap';

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

/** Οι επιλογές του {@link findStructuralOverlap}. */
export interface StructuralOverlapOptions {
  readonly excludeIds?: ReadonlySet<string>;
  readonly ratioThreshold?: number;
  readonly candidateType?: Entity['type'];
  readonly candidate?: Entity;
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
 *
 * `candidate`: η ίδια η υποψήφια οντότητα. Όταν είναι τοίχος, κάθε ζεύγος τοίχος↔τοίχος κρίνεται
 * ΜΕΤΑ την ένωση (§join-is-not-occupation). Χωρίς αυτήν (π.χ. σκέτο πολύγωνο ζώνης) η κρίση
 * γίνεται στα πλήρη αποτυπώματα. Οι φρουροί τοποθέτησης καλούν το
 * {@link findStructuralOverlapForEntity}, που τη δίνει πάντα.
 */
export function findStructuralOverlap(
  candidateFootprint: readonly Point2D[],
  existing: readonly Entity[],
  opts?: StructuralOverlapOptions,
): StructuralOverlapHit | null {
  if (candidateFootprint.length < 3) return null;
  const threshold = opts?.ratioThreshold ?? DEFAULT_OVERLAP_RATIO_THRESHOLD;
  const candGroup = opts?.candidateType ? structuralCollisionGroupOf(opts.candidateType) : null;
  const cand = clipFootprintOf(candidateFootprint);
  if (cand.area <= 0) return null;
  const candBbox = bboxOf(candidateFootprint);
  const candWall = opts?.candidate && isWallEntity(opts.candidate) ? opts.candidate : null;

  for (const e of existing) {
    if (opts?.excludeIds?.has(e.id)) continue;
    if (!STRUCTURAL_OVERLAP_TYPES.has(e.type)) continue;
    // ADR-567 Φ1b — μόνο ίδια collision group συγκρούεται (οριζόντιο δοκάρι/πλάκα κάθεται πάνω
    // σε κατακόρυφο τοίχο/κολόνα σε διαφορετικό Z → δεν είναι επικάλυψη όγκου).
    if (candGroup && structuralCollisionGroupOf(e.type) !== candGroup) continue;
    const ef = structuralFootprintOf(e);
    if (!ef) continue;
    // Φτηνό AABB fast-reject ΠΡΙΝ το βαρύ polygon-clipping (per-frame hover, N.17 perf).
    // Τα αποτυπώματα μετά την ένωση είναι υποσύνολα των πλήρων ⇒ ο φρουρός ισχύει και γι' αυτά.
    if (bboxDisjoint(candBbox, bboxOf(ef))) continue;
    const ratio = occupationRatio(cand, candWall, e, ef);
    // ratio 0 = touch-only (κοινή παρειά/σημείο) ή καθαρή ένωση → allow
    if (ratio > 0 && ratio >= threshold) return { blockedById: e.id, ratio };
  }
  return null;
}

/**
 * Η είσοδος ΜΕ ΟΝΤΟΤΗΤΑ — αυτή που καλούν οι φρουροί τοποθέτησης. Βγάζει το αποτύπωμα, εξαιρεί
 * τον εαυτό της, περιορίζει τον έλεγχο στην ομάδα σύγκρουσης του τύπου της και δίνει στο SSoT
 * την ίδια την οντότητα, ώστε τοίχος↔τοίχος να κριθεί ΜΕΤΑ την ένωση
 * ({@link occupationRatio}). Μη δομικός τύπος ή οντότητα χωρίς έγκυρο αποτύπωμα → `null`.
 */
export function findStructuralOverlapForEntity(
  entity: Entity,
  existing: readonly Entity[],
  opts?: Pick<StructuralOverlapOptions, 'ratioThreshold'>,
): StructuralOverlapHit | null {
  if (!STRUCTURAL_OVERLAP_TYPES.has(entity.type)) return null;
  const footprint = structuralFootprintOf(entity);
  if (!footprint) return null;
  return findStructuralOverlap(footprint, existing, {
    ...opts,
    excludeIds: new Set([entity.id]),
    candidateType: entity.type,
    candidate: entity,
  });
}

/** Αποτύπωμα έτοιμο για boolean πράξεις, μαζί με το εμβαδό του. */
interface ClipFootprint {
  readonly clip: Polygon;
  readonly area: number;
}

function clipFootprintOf(footprint: readonly Point2D[]): ClipFootprint {
  const clip = toClipPolygon(footprint);
  return { clip, area: multiPolygonArea([clip]) };
}

/** Εμβαδό τομής / μικρότερο εμβαδό. `0` όταν δεν μοιράζονται εμβαδό ή κάποιο είναι εκφυλισμένο. */
function areaOverlapRatio(a: ClipFootprint, b: ClipFootprint): number {
  if (a.area <= 0 || b.area <= 0) return 0;
  const interArea = multiPolygonArea(safeIntersection(a.clip, b.clip));
  return interArea <= 0 ? 0 : interArea / Math.min(a.area, b.area);
}

/**
 * Ο λόγος κατάληψης του υποψηφίου έναντι ΜΙΑΣ υπάρχουσας οντότητας.
 *
 * §join-is-not-occupation (ADR-911 Φ3α-2): δύο τοίχοι που ενώνονται μοιράζονται εμβαδό εκ
 * κατασκευής, και αυτό το κομμάτι δεν εξαρτάται από το μήκος τους — για κοντό τοίχο έβγαινε
 * 33–55 % του «μικρότερου εμβαδού», δηλαδή ψευδής κατάληψη. Γι' αυτό ζεύγος τοίχων κρίνεται
 * στα αποτυπώματα ΜΕΤΑ την ένωση (`wall-join-overlap`)· κάθε άλλο ζεύγος, και οι παράλληλοι
 * τοίχοι, στα πλήρη αποτυπώματα όπως πάντα.
 */
function occupationRatio(
  cand: ClipFootprint,
  candWall: WallEntity | null,
  existing: Entity,
  existingFootprint: readonly Point2D[],
): number {
  if (candWall && isWallEntity(existing)) {
    const pair = joinedWallPairFootprints(candWall, existing);
    if (pair?.kind === 'swallowed') return 1;
    if (pair) return areaOverlapRatio(clipFootprintOf(pair.a), clipFootprintOf(pair.b));
  }
  return areaOverlapRatio(cand, clipFootprintOf(existingFootprint));
}

/** Διαμέριση μιας παρτίδας: όσες χωρούν, και πόσες (και από ποια) κόπηκαν. */
export interface StructuralOverlapPartition<E> {
  /** Οι οντότητες που χωρούν, στη σειρά εισόδου. */
  readonly accepted: E[];
  /** Πόσες κόπηκαν (N.7.2 — ποτέ σιωπηλό όριο). */
  readonly blocked: number;
  /** Η πρώτη υπάρχουσα οντότητα που έκοψε κάποια, και ο τύπος της κομμένης· `null` αν καμία. */
  readonly firstBlockedById: string | null;
  readonly firstBlockedType: Entity['type'] | null;
}

/**
 * ADR-567 — χωρίζει μια ΠΑΡΤΙΔΑ νέων οντοτήτων σε όσες χωρούν και όσες θα κάθονταν πάνω σε
 * υπάρχουσα δομική **ή σε ήδη-αποδεκτή της ίδιας παρτίδας** (το σύνολο ελέγχου μεγαλώνει με
 * κάθε αποδεκτή, ώστε τα μέλη να μην επικαλύπτονται ούτε μεταξύ τους). Μη δομικοί τύποι
 * περνούν πάντα. ΚΑΘΑΡΟ — ο καλών αποφασίζει τι κάνει με τις κομμένες (παράλειψη ή άρνηση).
 *
 * Το ΕΝΑ φίλτρο παρτίδας: το μοιράζονται το `appendEntitiesToScene` και το `addWallsToScene`.
 */
export function partitionByStructuralOverlap<E extends { readonly id: string }>(
  entities: readonly E[],
  sceneEntities: readonly Entity[],
): StructuralOverlapPartition<E> {
  const existing: Entity[] = [...sceneEntities];
  const accepted: E[] = [];
  let blocked = 0;
  let firstBlockedById: string | null = null;
  let firstBlockedType: Entity['type'] | null = null;
  for (const e of entities) {
    const ent = e as unknown as Entity;
    const hit = findStructuralOverlapForEntity(ent, existing);
    if (hit) {
      blocked++;
      firstBlockedById ??= hit.blockedById;
      firstBlockedType ??= ent.type;
      continue; // δεν μπαίνει ΚΑΙ δεν γίνεται baseline για τις επόμενες
    }
    accepted.push(e);
    existing.push(ent);
  }
  return { accepted, blocked, firstBlockedById, firstBlockedType };
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
