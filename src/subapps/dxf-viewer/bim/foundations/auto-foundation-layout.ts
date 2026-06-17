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
import type { CoveragePoint } from './footing-column-coverage';

/** Κατασκευαστική απόσταση (mm) κάτω από την οποία δύο μεμονωμένα πέδιλα ενώνονται. */
export const MIN_PAD_CLEARANCE_MM = 100;
/** mm² ανά m² (kN/kPa = m² → mm²). */
const M2_TO_MM2 = 1_000_000;

/** Κολώνα ως είσοδος του layout engine (γεωμετρία normalized από τον caller). */
export interface LayoutColumnInput {
  readonly id: string;
  /** Plan-centroid βάσης (canvas units). */
  readonly centroid: CoveragePoint;
  /** Όψη κολώνας X (mm). */
  readonly widthMm: number;
  /** Όψη κολώνας Y (mm). */
  readonly depthMm: number;
  /** Χαρακτηριστικό service αξονικό N = G + Q (kN), αν γνωστό. */
  readonly axialServiceKn?: number;
  /** Absolute mm — βάση κολώνας (= άνω παρειά πεδίλου). */
  readonly baseZmm: number;
}

/** Ένα σχεδιασμένο πέδιλο (μεμονωμένο ή combined) — DERIVED. */
export interface PlannedFooting {
  /** Κολώνες που στηρίζει (≥1)· ταξινομημένες για σταθερό key στον reconciler. */
  readonly columnIds: readonly string[];
  /** Κέντρο πεδίλου (canvas units) — κέντρο βάρους φορτίων για combined. */
  readonly position: CoveragePoint;
  readonly widthMm: number;
  readonly lengthMm: number;
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

/** Axis-aligned ορθογώνιο pad (canvas units) γύρω από κολώνα. */
interface PadRect {
  readonly cx: number;
  readonly cy: number;
  readonly halfW: number;
  readonly halfL: number;
}

/** Απαιτούμενο μεμονωμένο pad μιας κολώνας (canvas units). */
function requiredPad(col: LayoutColumnInput, sigmaKpa: number | undefined, s: number): PadRect {
  const dims = suggestPadDimensions({
    columnWidthMm: col.widthMm,
    columnDepthMm: col.depthMm,
    axialServiceKn: col.axialServiceKn,
    soilBearingCapacityKpa: sigmaKpa,
  });
  return {
    cx: col.centroid.x,
    cy: col.centroid.y,
    halfW: (dims.widthMm / 2) * s,
    halfL: (dims.lengthMm / 2) * s,
  };
}

/** True αν δύο pads επικαλύπτονται ή το κενό τους είναι < clearance (canvas). */
function padsShareFooting(a: PadRect, b: PadRect, clearanceCanvas: number): boolean {
  const gapX = Math.abs(a.cx - b.cx) - (a.halfW + b.halfW);
  const gapY = Math.abs(a.cy - b.cy) - (a.halfL + b.halfL);
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
  // Μισές πλευρές που περικλείουν κάθε member-pad γύρω από το κέντρο.
  let halfW = 0;
  let halfL = 0;
  for (const p of pads) {
    halfW = Math.max(halfW, Math.abs(p.cx - cx) + p.halfW);
    halfL = Math.max(halfL, Math.abs(p.cy - cy) + p.halfL);
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
