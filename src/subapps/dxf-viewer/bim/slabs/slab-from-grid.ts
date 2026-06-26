/**
 * ADR-441 Slice GEN-SLAB — «Πλάκες από κάναβο» (slabs from construction grid).
 *
 * Pure builders, mirror του `beam-from-grid.ts`. Δύο εντελώς διαφορετικές
 * γεωμετρικές συμπεριφορές (αποφάσεις Revit-grade, ADR-441 §GEN-SLAB):
 *
 *  - **MAT (εδαφόπλακα / δάπεδο επί εδάφους)** → `buildGroundBearingSlabs`: ΕΝΑ ενιαίο
 *    **ground-bearing** `SlabEntity kind='ground'` ανά building component, outline = το
 *    merged περίγραμμα κτιρίου (`computeBuildingFootprint().outerRings`). Revit
 *    slab-on-grade: άνω παρειά στο **FFL (0)**, layered build-up (`createDefaultGroundBuildup`
 *    SSoT — επίστρωση πάνω → φέρον σκυρόδεμα → στεγάνωση+κοιτόστρωση που πατά στο μπάζωμα),
 *    ώστε το φέρον να είναι κάτω από το FFL χωρίς magic offset. Μία κλειστή περίμετρος που
 *    καλύπτει όλο το αποτύπωμα — **ΔΕΝ** υποδιαιρείται από τον κάναβο, **δεν** φέρει grid
 *    bindings (ακολουθεί τα δομικά στοιχεία, όχι έναν άξονα). (`kind='foundation'` = ξεχωριστή
 *    θεμελιόπλακα/radier — ΔΕΝ είναι αυτό το εργαλείο.)
 *
 *  - **FLOOR / ROOF (δάπεδο / οροφή)** → Slice FLOOR (ξεχωριστή συνάρτηση εδώ, επόμενο
 *    slice): ΠΟΛΛΕΣ πλάκες, μία ανά φάτνωμα, born-bound στους 4 άξονες.
 *
 * ΜΗΔΕΝ duplication geometry/builder math — κάθε πλάκα περνά από το ΥΠΑΡΧΟΝ SSoT
 * `completeSlabFromPolygonClicks` (slab-completion.ts). Το footprint βγαίνει από το
 * ΥΠΑΡΧΟΝ `computeBuildingFootprint` (boolean union τοίχων+κολωνών+δοκαριών).
 *
 * v1 περιορισμός (DEFER): το `SlabParams.outline` είναι απλό πολύγωνο (χωρίς holes),
 * άρα εσωτερικά κενά (αίθρια) αγνοούνται στην εδαφόπλακα — θα καλυφθούν ως ξεχωριστά
 * `slab-opening` entities (ADR-363 Phase 3.5). Slab-on-grade σπανίως έχει αίθριο.
 *
 * @see bim/beams/beam-from-grid.ts — γραμμικό πρότυπο
 * @see bim/geometry/building-footprint.ts — computeBuildingFootprint (footprint SSoT)
 * @see hooks/drawing/slab-completion.ts — buildSlabEntity SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §GEN-SLAB
 */

import type { Pair, Polygon, Ring } from 'polygon-clipping';
import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../types/bim-base';
import type { SlabEntity } from '../types/slab-types';
import type { GuideBinding } from '../hosting/guide-binding-types';
import {
  completeSlabFromPolygonClicks,
  type SlabParamOverrides,
  type SceneUnits,
} from '../../hooks/drawing/slab-completion';
import { getDefaultSlabBuildupForKind } from '../types/slab-dna-types';
import {
  computeBuildingFootprint,
  type BeamForFootprint,
} from '../geometry/building-footprint';
import {
  enumerateGridBays,
  gridAxesFromReader,
  type AxisGuideReader,
  type GridBaySpec,
} from '../foundations/foundation-from-grid';
import { computeBeamGeometry } from '../geometry/beam-geometry';
import { computeColumnGeometry } from '../geometry/column-geometry';
import { safeDifference } from '../geometry/shared/safe-polygon-boolean';
import type { WallForEnvelope } from '../geometry/envelope-perimeter';
import type { ColumnForEnvelope } from '../geometry/envelope-column-bridge';

export interface BuildSlabMatResult {
  readonly ok: boolean;
  /** Όταν `ok=false`: δεν υπάρχει αποτύπωμα (μηδέν δομικά στοιχεία στον όροφο). */
  readonly reason?: 'no-footprint';
  /** Οι ενιαίες εδαφόπλακες (μία ανά building component). */
  readonly slabs: readonly SlabEntity[];
  /** Πλήθος components που απορρίφθηκαν από τον slab validator (degenerate). */
  readonly ignoredCount: number;
}

/**
 * Παράγει την/τις **ενιαία/ες** εδαφόπλακα/ες (ground-bearing slab, δάπεδο επί εδάφους)
 * από το αποτύπωμα του κτιρίου.
 *
 * Ένα `SlabEntity kind='ground'` ανά συνεκτικό component του περιγράμματος (ένα για
 * συνεχόμενο κτίριο, περισσότερα για αποσπασμένα). Outline = το εξώτατο όριο του
 * component (holes → DEFER, βλ. module doc). **Άνω παρειά στο FFL (0)** (Revit floor
 * convention: το `levelElevation` default του `ground` = 0) + **SSoT layered build-up**
 * (`getDefaultSlabBuildupForKind('ground')`: επίστρωση → φέρον → στεγάνωση+κοιτόστρωση)
 * ώστε το φέρον σκυρόδεμα να κάθεται κάτω από το FFL χωρίς magic offset. Δεν φέρει
 * `guideBindings` — η εδαφόπλακα ΔΕΝ κρέμεται σε άξονα (ακολουθεί τα δομικά στοιχεία μέσω
 * επανα-δημιουργίας, όχι follow-move). Ο caller μπορεί να υπερισχύσει DNA/πάχος/στάθμη.
 */
export function buildGroundBearingSlabs(
  walls: readonly WallForEnvelope[],
  columns: readonly ColumnForEnvelope[],
  beams: readonly BeamForFootprint[],
  overrides: SlabParamOverrides,
  layerId: string,
  sceneUnits: SceneUnits,
): BuildSlabMatResult {
  const footprint = computeBuildingFootprint(walls, columns, beams, sceneUnits);
  if (footprint.outerRings.length === 0) {
    return { ok: false, reason: 'no-footprint', slabs: [], ignoredCount: 0 };
  }

  const slabs: SlabEntity[] = [];
  let ignoredCount = 0;
  for (const ring of footprint.outerRings) {
    const vertices: Point2D[] = ring.points.points.map((p) => ({ x: p.x, y: p.y }));
    const result = completeSlabFromPolygonClicks(
      vertices,
      layerId,
      // SSoT build-up + kind forced (caller μπορεί να αλλάξει DNA/πάχος/στάθμη πρώτα).
      { dna: getDefaultSlabBuildupForKind('ground'), ...overrides, kind: 'ground' },
      sceneUnits,
    );
    if (result.ok) slabs.push(result.entity);
    else ignoredCount++;
  }

  return { ok: slabs.length > 0, slabs, ignoredCount };
}

// ─── FLOOR / ROOF — per-φάτνωμα πλάκες (clip στα δοκάρια + notch κολώνων) ───────

export interface BuildSlabBaysResult {
  readonly ok: boolean;
  /** Όταν `ok=false`: λιγότεροι από 2 ορατοί άξονες ανά διεύθυνση. */
  readonly reason?: 'insufficient-guides';
  /** Οι πλάκες ανά φάτνωμα (born-bound στους 4 άξονες). */
  readonly slabs: readonly SlabEntity[];
  /** Πλήθος φατνωμάτων που απορρίφθηκαν (κενά μετά το clip ή degenerate). */
  readonly ignoredCount: number;
}

/** Αξονικά-ευθυγραμμισμένο bbox ενός πολυγώνου (scene units). */
interface Bbox {
  readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number;
}

/** Footprint ενός subtrahend (δοκάρι/κολώνα) + bbox για γρήγορο overlap φίλτρο. */
interface Subtrahend {
  readonly poly: Polygon;
  readonly bbox: Bbox;
}

function bboxOf(pts: readonly Pair[]): Bbox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

function bboxOverlap(a: Bbox, b: Bbox): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

/** Point3D vertices → closed polygon-clipping Polygon (ένα ring), ή `null` αν degenerate. */
function vertsToSubtrahend(verts: readonly Point3D[]): Subtrahend | null {
  if (verts.length < 3) return null;
  const ring: Ring = verts.map((v): Pair => [v.x, v.y]);
  return { poly: [ring], bbox: bboxOf(ring) };
}

/** Shoelace area (unsigned) ενός ring από Pairs. */
function ringArea(ring: Ring): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

/**
 * Μάζεψε τα footprints δοκαριών + κολωνών (= τα στοιχεία που κόβουν/notch-άρουν την
 * πλάκα φατνώματος). Τα δοκάρια straddle τον άξονα → η αφαίρεση τα κόβει στην εσωτερική
 * παρειά· οι κολώνες/τοιχία (shear-wall = ColumnEntity) notch-άρουν τις γωνίες/προεξοχές.
 * Οι κανονικοί τοίχοι ΔΕΝ μπαίνουν εδώ (κάθονται ΠΑΝΩ στην πλάκα, Revit-grade).
 */
function collectSubtrahends(
  beams: readonly BeamForFootprint[],
  columns: readonly ColumnForEnvelope[],
): Subtrahend[] {
  const out: Subtrahend[] = [];
  for (const b of beams) {
    try {
      const s = vertsToSubtrahend(computeBeamGeometry(b.params).outline.vertices);
      if (s) out.push(s);
    } catch { /* skip degenerate beam */ }
  }
  for (const c of columns) {
    try {
      const s = vertsToSubtrahend(computeColumnGeometry(c.params).footprint.vertices);
      if (s) out.push(s);
    } catch { /* skip degenerate column */ }
  }
  return out;
}

/**
 * polygon-clipping επαναλαμβάνει την πρώτη κορυφή στο τέλος (closing) → αφαίρεσέ την,
 * αλλιώς ο slab validator απορρίπτει το zero-length edge. Ring (Pair[]) → Point2D[].
 */
function cleanRingToPts(ring: Ring): Point2D[] {
  const pts: Point2D[] = ring.map(([x, y]) => ({ x, y }));
  if (pts.length >= 2) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (first.x === last.x && first.y === last.y) pts.pop();
  }
  return pts;
}

/**
 * **Generic clip SSoT** (ADR-441 / ADR-534): μια κλειστή περιοχή (ring) ΜΕΙΟΝ τα overlapping
 * footprints (δοκάρια clip + κολώνες notch) → **ΟΛΑ** τα outer rings που απομένουν (κάθε ένα ≥3
 * κορυφές, θετικό εμβαδόν, καθαρισμένο closing-vertex). Holes ανά ring → DEFER (slab-openings).
 * Χρησιμοποιείται ΚΑΙ από τα grid bays (`bayOutline`, ένα φάτνωμα ανά rect) ΚΑΙ από το auto-ceiling
 * (footprint κτιρίου ΜΕΙΟΝ εσωτερικά δοκάρια → N φατνώματα, ADR-534).
 */
function regionMinusSubtrahends(regionRing: Ring, subs: readonly Subtrahend[]): Point2D[][] {
  const regionBbox = bboxOf(regionRing);
  const overlapping = subs.filter((s) => bboxOverlap(s.bbox, regionBbox)).map((s) => s.poly);
  if (overlapping.length === 0) {
    const pts = cleanRingToPts(regionRing);
    return pts.length >= 3 ? [pts] : [];
  }
  const result = safeDifference([regionRing], ...overlapping);
  const out: Point2D[][] = [];
  for (const poly of result) {
    if (poly.length === 0) continue;
    if (ringArea(poly[0]) <= 0) continue;
    const pts = cleanRingToPts(poly[0]);
    if (pts.length >= 3) out.push(pts);
  }
  return out;
}

/** Unsigned shoelace area ενός Point2D[] ring. */
function ptsArea(pts: readonly Point2D[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

/**
 * Outline ΕΝΟΣ φατνώματος = bay rect ΜΕΙΟΝ τα overlapping footprints (δοκάρια clip +
 * κολώνες notch). Επιστρέφει το **μεγαλύτερο** outer ring (ένα φάτνωμα = μία πλάκα·
 * τυχόν διάσπαση/τρύπες → DEFER slab-openings). `null` αν τίποτα δεν απομένει.
 */
function bayOutline(bay: GridBaySpec, subs: readonly Subtrahend[]): Point2D[] | null {
  const rectRing: Ring = bay.corners.map((c): Pair => [c.x, c.y]);
  const rings = regionMinusSubtrahends(rectRing, subs);
  let best: Point2D[] | null = null;
  let bestArea = 0;
  for (const r of rings) {
    const area = ptsArea(r);
    if (area > bestArea) { bestArea = area; best = r; }
  }
  return best;
}

/**
 * Παράγει μία born-bound πλάκα ανά φάτνωμα (Slice FLOOR/ROOF). `kind` από τα overrides
 * (default 'floor'). Κάθε πλάκα clip-άρεται στις εσωτερικές παρειές των δοκαριών &
 * notch-άρεται γύρω από κολώνες, και φέρει τα 4-axis `guideBindings` → ακολουθεί τον
 * κάναβο ως επιφάνεια (`slabHostingStrategy`). Σύνολο = (nX-1)·(nY-1) φατνώματα.
 */
export function buildSlabBaysFromGuides(
  reader: AxisGuideReader,
  beams: readonly BeamForFootprint[],
  columns: readonly ColumnForEnvelope[],
  overrides: SlabParamOverrides,
  layerId: string,
  sceneUnits: SceneUnits,
): BuildSlabBaysResult {
  const axes = gridAxesFromReader(reader);
  if (!axes) {
    return { ok: false, reason: 'insufficient-guides', slabs: [], ignoredCount: 0 };
  }
  const kind = overrides.kind ?? 'floor';
  const subs = collectSubtrahends(beams, columns);

  const slabs: SlabEntity[] = [];
  let ignoredCount = 0;
  enumerateGridBays(axes, (bay) => {
    const outline = bayOutline(bay, subs);
    if (!outline) { ignoredCount++; return; }
    const result = completeSlabFromPolygonClicks(outline, layerId, { ...overrides, kind }, sceneUnits);
    if (!result.ok) { ignoredCount++; return; }
    slabs.push({ ...result.entity, guideBindings: bay.bindings as readonly GuideBinding[] });
  });

  return { ok: slabs.length > 0, slabs, ignoredCount };
}
