/**
 * auto-foundation-layout — pure engine Αυτόματου Σχεδιασμού Θεμελίωσης (ADR-459
 * Phase 7). Δοθέντων ΟΛΩΝ των κολωνών ενός επιπέδου (+ φορτία) + σ_allow, αποφασίζει
 * **αυτόματα** (διεθνής πρακτική στατικών, ΟΧΙ σταθερό όριο απόστασης) αν τα πέδιλα
 * μένουν **μεμονωμένα** ή ενώνονται σε **combined** και τα διαστασιολογεί.
 *
 * Αλγόριθμος (engineering reconciler):
 *   1. Διαστασιολόγησε το απαιτούμενο **μεμονωμένο** πέδιλο κάθε κολώνας — SSoT
 *      `suggestPadDimensions` (A_req = N_service/σ_allow + γεωμετρικό min detailing).
 *   2. **Κανόνας ένωσης:** δύο κολώνες ενώνονται όταν τα απαιτούμενα μεμονωμένα
 *      πέδιλά τους επικαλύπτονται ή το καθαρό κενό < `MIN_PAD_CLEARANCE_MM`
 *      (κατασκευαστική απόσταση). Grouping **transitive** μέσω union-find.
 *   3. Ομάδα ≥2 → **combined** ορθογώνιο πέδιλο: κεντραρισμένο στο **κέντρο βάρους
 *      των φορτίων** (ομοιόμορφη πίεση → μηδέν καθαρή ροπή), περικλείει όλα τα
 *      member-pads, εμβαδόν ≥ ΣN/σ_allow.
 *   4. Μονή κολώνα → **μεμονωμένο** pad.
 *
 * Όλη η γεωμετρία σε **canvas units** (ίδιο space με τα footprints)· οι διαστάσεις
 * εκτίθενται και σε **mm** (το `FoundationParams` αποθηκεύει width/length σε mm,
 * position σε canvas — βλ. `pad-extend.ts`). DERIVED, pure, ΠΟΤΕ persisted.
 *
 * @see ../structural/footing-design/suggest-pad-dimensions.ts — sizing SSoT
 * @see ./auto-foundation-reconcile.ts — diff του plan έναντι των υπαρχόντων auto πεδίλων
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 7
 */

import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { suggestPadDimensions } from '../structural/footing-design/suggest-pad-dimensions';
import { rotatePoint } from '../../utils/rotation-math';
import type { Point2D } from '../../rendering/types/Types';
import type { CoveragePoint } from './footing-column-coverage';

/** Κατασκευαστική απόσταση (mm) κάτω από την οποία δύο μεμονωμένα πέδιλα ενώνονται. */
export const MIN_PAD_CLEARANCE_MM = 100;
/** mm² ανά m² (kN/kPa = m² → mm²). */
const M2_TO_MM2 = 1_000_000;

/** Κολώνα ως είσοδος του layout engine (γεωμετρία normalized από τον caller). */
export interface LayoutColumnInput {
  readonly id: string;
  /** Plan **area**-centroid βάσης (canvas units) — load resultant για ομοιόμορφη πίεση. */
  readonly centroid: CoveragePoint;
  /**
   * Πραγματικό αποτύπωμα βάσης (canvas units, world). Διαστασιολογεί το πέδιλο ώστε
   * να καλύπτει το ΑΛΗΘΙΝΟ ίχνος (κρίσιμο για composite L/T/U όπου centroid ≠ bbox-center)·
   * για ορθογώνια ταυτίζεται με το width×depth (μηδέν regression).
   */
  readonly footprint: readonly CoveragePoint[];
  /** Όψη κολώνας X (mm) — bbox για composite. */
  readonly widthMm: number;
  /** Όψη κολώνας Y (mm) — bbox για composite. */
  readonly depthMm: number;
  /** Χαρακτηριστικό service αξονικό N = G + Q (kN), αν γνωστό. */
  readonly axialServiceKn?: number;
  /** Absolute mm — βάση κολώνας (= άνω παρειά πεδίλου). */
  readonly baseZmm: number;
  /** Μοίρες CCW περιστροφής κολώνας — το μεμονωμένο πέδιλο την κληρονομεί (Revit hosted). */
  readonly rotationDeg: number;
}

/** Ένα σχεδιασμένο πέδιλο (μεμονωμένο ή combined) — DERIVED. */
export interface PlannedFooting {
  /** Κολώνες που στηρίζει (≥1)· ταξινομημένες για σταθερό key στον reconciler. */
  readonly columnIds: readonly string[];
  /** Κέντρο πεδίλου (canvas units) — κέντρο βάρους φορτίων για combined. */
  readonly position: CoveragePoint;
  readonly widthMm: number;
  readonly lengthMm: number;
  /** Μοίρες CCW — μεμονωμένο: rotation κολώνας· combined: 0 (axis-aligned, v1). */
  readonly rotationDeg: number;
  /** Absolute mm — άνω παρειά (= βάση κολώνας/-ων). */
  readonly topElevationMm: number;
  /** Άθροισμα χαρακτηριστικού service φορτίου των μελών (kN). */
  readonly axialServiceKn: number;
  /** True όταν στηρίζει ≥2 κολώνες (combined footing). */
  readonly combined: boolean;
}

export interface FoundationLayoutPlan {
  readonly footings: readonly PlannedFooting[];
}

/**
 * Απαιτούμενο μεμονωμένο pad μιας κολώνας (canvas units).
 * - `halfW`/`halfL`: μισές πλευρές στο **LOCAL frame** της κολώνας (column-aligned)
 *   — τα κληρονομεί το μεμονωμένο πέδιλο μαζί με το `rotationDeg`.
 * - `aabbHalfW`/`aabbHalfL`: μισές πλευρές του **WORLD AABB** του rotated pad — τα
 *   χρησιμοποιεί το axis-aligned grouping/combined ώστε να περικλείει σωστά και
 *   στραμμένες κολώνες (π.χ. 90° swap width↔depth).
 */
interface PadRect {
  readonly cx: number;
  readonly cy: number;
  readonly halfW: number;
  readonly halfL: number;
  readonly rotationDeg: number;
  readonly aabbHalfW: number;
  readonly aabbHalfL: number;
}

const ORIGIN: Point2D = { x: 0, y: 0 };

/**
 * Μισές πλευρές του world-axis AABB ενός local pad ορθογωνίου (κεντραρισμένο)
 * μετά από rotation. Reuse του ADR-188 `rotatePoint` SSoT — μηδέν νέα rotation math.
 * Για κεντραρισμένο ορθογώνιο το AABB είναι συμμετρικό → halfExtent = max|coord|.
 */
function rotatedHalfExtents(halfW: number, halfL: number, rotationDeg: number): { hx: number; hy: number } {
  if (rotationDeg === 0) return { hx: halfW, hy: halfL };
  const corners: readonly Point2D[] = [
    { x: -halfW, y: -halfL },
    { x: halfW, y: -halfL },
    { x: halfW, y: halfL },
    { x: -halfW, y: halfL },
  ];
  let hx = 0;
  let hy = 0;
  for (const c of corners) {
    const r = rotatePoint(c, ORIGIN, rotationDeg);
    hx = Math.max(hx, Math.abs(r.x));
    hy = Math.max(hy, Math.abs(r.y));
  }
  return { hx, hy };
}

/**
 * **Effective** όψεις κολόνας (mm) στο LOCAL frame, **συμμετρικά γύρω από το
 * area-centroid** (load resultant) → ομοιόμορφη πίεση. Το πέδιλο, κεντραρισμένο
 * στο centroid + αυτές τις όψεις + overhang (μέσω `suggestPadDimensions`), εγγυάται
 * ≥overhang σε ΟΛΕΣ τις παρειές του πραγματικού ίχνους. Reuse του ADR-188 `rotatePoint`
 * για un-rotate στο local frame.
 *
 * Ορθογώνια κεντραρισμένη κολόνα → επιστρέφει ακριβώς width×depth (μηδέν regression).
 * Degenerate footprint → fallback στο bbox width×depth.
 */
function effectiveFaces(col: LayoutColumnInput, s: number): { widthMm: number; depthMm: number } {
  if (col.footprint.length < 3 || s <= 0) {
    return { widthMm: col.widthMm, depthMm: col.depthMm };
  }
  const c: Point2D = { x: col.centroid.x, y: col.centroid.y };
  let halfX = 0;
  let halfY = 0;
  for (const v of col.footprint) {
    const local = col.rotationDeg === 0 ? v : rotatePoint({ x: v.x, y: v.y }, c, -col.rotationDeg);
    halfX = Math.max(halfX, Math.abs(local.x - c.x));
    halfY = Math.max(halfY, Math.abs(local.y - c.y));
  }
  // 2·half (full effective face) σε mm· συμμετρία γύρω από το centroid → κάλυψη
  // του πιο απομακρυσμένου vertex κάθε πλευράς + ίσο overhang.
  return { widthMm: (2 * halfX) / s, depthMm: (2 * halfY) / s };
}

/** Απαιτούμενο μεμονωμένο pad μιας κολώνας (canvas units). */
function requiredPad(col: LayoutColumnInput, sigmaKpa: number | undefined, s: number): PadRect {
  const faces = effectiveFaces(col, s);
  const dims = suggestPadDimensions({
    columnWidthMm: faces.widthMm,
    columnDepthMm: faces.depthMm,
    axialServiceKn: col.axialServiceKn,
    soilBearingCapacityKpa: sigmaKpa,
  });
  const halfW = (dims.widthMm / 2) * s;
  const halfL = (dims.lengthMm / 2) * s;
  const { hx, hy } = rotatedHalfExtents(halfW, halfL, col.rotationDeg);
  return {
    cx: col.centroid.x,
    cy: col.centroid.y,
    halfW,
    halfL,
    rotationDeg: col.rotationDeg,
    aabbHalfW: hx,
    aabbHalfL: hy,
  };
}

/**
 * True αν δύο pads επικαλύπτονται ή το κενό τους είναι < clearance (canvas).
 * Χρησιμοποιεί τα **world-AABB** half-extents ώστε το overlap test να ισχύει και
 * για στραμμένες κολώνες (axis-aligned conservative).
 */
function padsShareFooting(a: PadRect, b: PadRect, clearanceCanvas: number): boolean {
  const gapX = Math.abs(a.cx - b.cx) - (a.aabbHalfW + b.aabbHalfW);
  const gapY = Math.abs(a.cy - b.cy) - (a.aabbHalfL + b.aabbHalfL);
  return gapX < clearanceCanvas && gapY < clearanceCanvas;
}

// ─── Union-find (transitive grouping) ────────────────────────────────────────

function find(parent: number[], i: number): number {
  let root = i;
  while (parent[root] !== root) root = parent[root];
  while (parent[i] !== root) {
    const next = parent[i];
    parent[i] = root;
    i = next;
  }
  return root;
}

function union(parent: number[], a: number, b: number): void {
  const ra = find(parent, a);
  const rb = find(parent, b);
  if (ra !== rb) parent[rb] = ra;
}

/** Ομαδοποίηση κολωνών (indices) με union-find βάσει pad overlap/clearance. */
function groupColumns(pads: readonly PadRect[], clearanceCanvas: number): number[][] {
  const parent = pads.map((_, i) => i);
  for (let i = 0; i < pads.length; i++) {
    for (let j = i + 1; j < pads.length; j++) {
      if (padsShareFooting(pads[i], pads[j], clearanceCanvas)) union(parent, i, j);
    }
  }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < pads.length; i++) {
    const root = find(parent, i);
    const g = groups.get(root);
    if (g) g.push(i);
    else groups.set(root, [i]);
  }
  return [...groups.values()];
}

// ─── Planned-footing builders ────────────────────────────────────────────────

/** Μεμονωμένο πέδιλο από μία κολώνα + το απαιτούμενο pad της. */
function isolatedFooting(col: LayoutColumnInput, pad: PadRect, s: number): PlannedFooting {
  return {
    columnIds: [col.id],
    position: { x: pad.cx, y: pad.cy },
    widthMm: (pad.halfW * 2) / s,
    lengthMm: (pad.halfL * 2) / s,
    rotationDeg: col.rotationDeg, // μεμονωμένο πέδιλο ευθυγραμμίζεται με την κολώνα
    topElevationMm: col.baseZmm,
    axialServiceKn: col.axialServiceKn ?? 0,
    combined: false,
  };
}

/**
 * Combined πέδιλο μιας ομάδας (≥2): κέντρο = κέντρο βάρους φορτίων (ή γεωμετρικός
 * μέσος αν λείπουν φορτία)· μισές πλευρές = όσο χρειάζεται για να περικλειστεί κάθε
 * member-pad ως προς το κέντρο· τελική μεγέθυνση ώστε εμβαδόν ≥ ΣN/σ_allow.
 */
function combinedFooting(
  members: readonly LayoutColumnInput[],
  pads: readonly PadRect[],
  sigmaKpa: number | undefined,
  s: number,
): PlannedFooting {
  const sumN = members.reduce((acc, m) => acc + (m.axialServiceKn ?? 0), 0);
  // Κέντρο βάρους φορτίων (canvas)· fallback = γεωμετρικός μέσος των κέντρων.
  let cx = 0;
  let cy = 0;
  if (sumN > 0) {
    for (let i = 0; i < members.length; i++) {
      const w = members[i].axialServiceKn ?? 0;
      cx += pads[i].cx * w;
      cy += pads[i].cy * w;
    }
    cx /= sumN;
    cy /= sumN;
  } else {
    for (const p of pads) {
      cx += p.cx;
      cy += p.cy;
    }
    cx /= pads.length;
    cy /= pads.length;
  }
  // Μισές πλευρές που περικλείουν κάθε member-pad γύρω από το κέντρο. Χρήση των
  // **world-AABB** half-extents: το combined είναι axis-aligned (rotation 0), άρα
  // πρέπει να περικλείσει το world-aligned ίχνος κάθε (πιθανώς στραμμένου) pad —
  // αλλιώς κολώνα στραμμένη 90° (width↔depth swap) μένει ακάλυπτη.
  let halfW = 0;
  let halfL = 0;
  for (const p of pads) {
    halfW = Math.max(halfW, Math.abs(p.cx - cx) + p.aabbHalfW);
    halfL = Math.max(halfL, Math.abs(p.cy - cy) + p.aabbHalfL);
  }
  // Έλεγχος εμβαδού έδρασης: μεγέθυνε ομοιόμορφα ώστε A ≥ ΣN/σ_allow.
  if (sumN > 0 && sigmaKpa && sigmaKpa > 0) {
    const areaCanvas = 4 * halfW * halfL;
    const reqAreaCanvas = (sumN / sigmaKpa) * M2_TO_MM2 * s * s;
    if (areaCanvas > 0 && areaCanvas < reqAreaCanvas) {
      const scale = Math.sqrt(reqAreaCanvas / areaCanvas);
      halfW *= scale;
      halfL *= scale;
    }
  }
  return {
    columnIds: members.map((m) => m.id).sort(),
    position: { x: cx, y: cy },
    widthMm: (halfW * 2) / s,
    lengthMm: (halfL * 2) / s,
    rotationDeg: 0, // combined: axis-aligned v1 (rotation κατά τη γραμμή κολωνών = DEFER)
    topElevationMm: Math.min(...members.map((m) => m.baseZmm)),
    axialServiceKn: sumN,
    combined: true,
  };
}

/**
 * Σχεδιάζει το πλήρες foundation layout ενός επιπέδου από τις κολώνες του +
 * σ_allow. Pure — μηδέν side-effects, μηδέν mutation. Κενή είσοδος → κενό plan.
 */
export function planFoundationLayout(
  columns: readonly LayoutColumnInput[],
  soilBearingCapacityKpa: number | undefined,
  sceneUnits: SceneUnits,
): FoundationLayoutPlan {
  if (columns.length === 0) return { footings: [] };
  const s = mmToSceneUnits(sceneUnits);
  const clearanceCanvas = MIN_PAD_CLEARANCE_MM * s;
  const pads = columns.map((c) => requiredPad(c, soilBearingCapacityKpa, s));
  const groups = groupColumns(pads, clearanceCanvas);

  const footings: PlannedFooting[] = [];
  for (const group of groups) {
    if (group.length === 1) {
      const i = group[0];
      footings.push(isolatedFooting(columns[i], pads[i], s));
    } else {
      footings.push(
        combinedFooting(
          group.map((i) => columns[i]),
          group.map((i) => pads[i]),
          soilBearingCapacityKpa,
          s,
        ),
      );
    }
  }
  return { footings };
}
