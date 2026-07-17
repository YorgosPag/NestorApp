/**
 * Parametric 3D opening leaf/panel builders (ADR-421 §A6, SLICE B).
 *
 * Per-family panel specs (κάσα-relative box specs) για κάθε `OpeningKind` family,
 * δίνοντας στο `opening-mesh.ts` distinct 3D σώμα: ανοιγόμενα φύλλα, συρόμενα
 * panels, πτυσσόμενα, sectional λωρίδες, περιστρεφόμενα blades, υαλοστάσια (single
 * / 2-sash) και προεξέχον bay. Pure / side-effect free — επιστρέφουν `BoxSpec[]`
 * σε κάσα-local coords· ο caller (`opening-mesh.ts`) εφαρμόζει basis + placement.
 *
 * Local coords (όπως `opening-mesh.ts`): +X = host axis, +Y = up, +Z = perp/depth.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-421-bim-opening-types-revit-grade.md §A6
 */

import * as THREE from 'three';
import type { OpeningEntity } from '../../bim/types/opening-types';
import { isDoubleLeafKind, isGlazedKind, OPENING_PLAN_SYMBOL } from '../../bim/types/opening-types';

/** Box spec in frame-local coords (shared with `opening-mesh.ts` consumer). */
export interface BoxSpec {
  readonly cx: number; readonly cy: number; readonly cz: number;
  readonly sx: number; readonly sy: number; readonly sz: number;
  readonly mat: THREE.Material;
}

/** Materials resolved by the caller (κάσα/φύλλο = ξύλο, υαλοστάσιο = γυαλί, χειρολαβή = μέταλλο). */
export interface OpeningMeshMaterials {
  readonly frame: THREE.Material;
  readonly leaf: THREE.Material;
  readonly glass: THREE.Material;
  /** ADR-672 §8 Α — hardware surface (χειρολαβή/μηχανισμός), resolved per opening. */
  readonly hardware: THREE.Material;
}

/**
 * Φύλλο/υαλοστάσιο πάχος ως κλάσμα του πάχους τοίχου (κεντραρισμένο). Exported so
 * the hardware builder (`opening-hardware-builders.ts`) places handles on the
 * SAME leaf face plane — one ratio, no duplicated magic number (N.18).
 */
export const LEAF_DEPTH_RATIO = 0.35;
/** Κενό ανάμεσα στα φύλλα (double-leaf) ως κλάσμα του ελεύθερου πλάτους. */
const LEAF_GAP_RATIO = 0.02;
/** Επικάλυψη/μετατόπιση συρόμενου panel ως κλάσμα του πάχους. */
const SLIDE_DEPTH_OFFSET = 0.22;
const FOLD_PANELS = 3;
const OVERHEAD_SLATS = 5;
const OVERHEAD_GAP_RATIO = 0.12;
/** Bay 3D projection depth ως κλάσμα του πλάτους. */
const BAY_DEPTH_RATIO = 0.3;

interface LeafCtx {
  readonly innerW: number;
  readonly innerH: number;
  readonly depth: number;
  readonly thicknessW: number;
  readonly cyMid: number;
  readonly panelMat: THREE.Material;
}

export interface LeafDims {
  readonly widthW: number;
  readonly heightM: number;
  readonly sillM: number;
  readonly thicknessW: number;
  readonly frameW: number;
}

/**
 * Ελεύθερο εσωτερικό άνοιγμα (κάσα-relative), δηλ. πλάτος/ύψος μείον την κάσα και
 * στις δύο πλευρές. `null` όταν degenerate (μηδενικό/αρνητικό). SSoT (N.18):
 * καταναλώνεται ΚΑΙ από τον leaf/panel builder ΚΑΙ από τον hardware sibling
 * (`opening-hardware-builders.ts`) — μία φορά ο υπολογισμός, ένας ο degenerate guard.
 */
export function openingInnerDims(dims: LeafDims): { readonly innerW: number; readonly innerH: number } | null {
  const innerW = Math.max(dims.widthW - 2 * dims.frameW, 0);
  const innerH = Math.max(dims.heightM - 2 * dims.frameW, 0);
  return innerW <= 0 || innerH <= 0 ? null : { innerW, innerH };
}

/**
 * Build the leaf/panel box specs for an opening (dispatch by plan-symbol SSoT).
 * Returns [] όταν το ελεύθερο άνοιγμα είναι degenerate.
 */
export function buildLeafSpecs(
  opening: OpeningEntity,
  dims: LeafDims,
  materials: OpeningMeshMaterials,
): BoxSpec[] {
  const inner = openingInnerDims(dims);
  if (!inner) return [];
  const { innerW, innerH } = inner;
  const ctx: LeafCtx = {
    innerW,
    innerH,
    depth: Math.max(dims.thicknessW * LEAF_DEPTH_RATIO, 1e-4),
    thicknessW: dims.thicknessW,
    cyMid: dims.sillM + dims.heightM / 2,
    panelMat: isGlazedKind(opening.kind) ? materials.glass : materials.leaf,
  };

  switch (OPENING_PLAN_SYMBOL[opening.kind]) {
    case 'swing':             return swingLeaves(opening, ctx);
    case 'sliding':           return slidingLeaves(opening, ctx);
    case 'folding':           return foldingLeaves(ctx);
    case 'overhead':          return overheadSlats(ctx);
    case 'revolving':         return revolvingBlades(ctx, materials);
    case 'glazing-slide-h':   return twoSashes(ctx, 'horizontal');
    case 'glazing-slide-v':   return twoSashes(ctx, 'vertical');
    case 'bay':               return bayBody(ctx);
    case 'glazing':
    case 'glazing-awning':
    case 'glazing-hopper':
    case 'glazing-tilt-turn': return [singlePanel(ctx)];
  }
}

function singlePanel(c: LeafCtx): BoxSpec {
  return { cx: 0, cy: c.cyMid, cz: 0, sx: c.innerW, sy: c.innerH, sz: c.depth, mat: c.panelMat };
}

/** Hinged: 1 leaf (door) ή 2 mirrored leaves (double-door / french-door). */
function swingLeaves(opening: OpeningEntity, c: LeafCtx): BoxSpec[] {
  if (!isDoubleLeafKind(opening.kind)) return [singlePanel(c)];
  const gap = c.innerW * LEAF_GAP_RATIO;
  const leafW = Math.max((c.innerW - gap) / 2, 1e-4);
  const offset = leafW / 2 + gap / 2;
  return [
    { cx: -offset, cy: c.cyMid, cz: 0, sx: leafW, sy: c.innerH, sz: c.depth, mat: c.panelMat },
    { cx: offset, cy: c.cyMid, cz: 0, sx: leafW, sy: c.innerH, sz: c.depth, mat: c.panelMat },
  ];
}

/** Sliding door family: single offset / double overlapping / pocket (slid in). */
function slidingLeaves(opening: OpeningEntity, c: LeafCtx): BoxSpec[] {
  const dz = c.thicknessW * SLIDE_DEPTH_OFFSET;
  if (opening.kind === 'double-sliding-door') {
    const leafW = c.innerW * 0.55;
    return [
      { cx: -c.innerW * 0.225, cy: c.cyMid, cz: dz, sx: leafW, sy: c.innerH, sz: c.depth, mat: c.panelMat },
      { cx: c.innerW * 0.225, cy: c.cyMid, cz: -dz, sx: leafW, sy: c.innerH, sz: c.depth, mat: c.panelMat },
    ];
  }
  if (opening.kind === 'pocket-door') {
    // Panel slid ~halfway into the wall pocket → narrower visible leaf, offset.
    return [{ cx: c.innerW * 0.25, cy: c.cyMid, cz: dz, sx: c.innerW * 0.5, sy: c.innerH, sz: c.depth, mat: c.panelMat }];
  }
  return [{ cx: 0, cy: c.cyMid, cz: dz, sx: c.innerW, sy: c.innerH, sz: c.depth, mat: c.panelMat }];
}

/** Bi-fold: N narrow folded panels alternating slightly in depth (accordion). */
function foldingLeaves(c: LeafCtx): BoxSpec[] {
  const panelW = c.innerW / FOLD_PANELS;
  const specs: BoxSpec[] = [];
  for (let i = 0; i < FOLD_PANELS; i++) {
    const cx = -c.innerW / 2 + panelW * (i + 0.5);
    const cz = (i % 2 === 0 ? 1 : -1) * c.thicknessW * 0.12;
    specs.push({ cx, cy: c.cyMid, cz, sx: panelW * 0.92, sy: c.innerH, sz: c.depth, mat: c.panelMat });
  }
  return specs;
}

/** Overhead sectional garage: horizontal slats stacked in Y. */
function overheadSlats(c: LeafCtx): BoxSpec[] {
  const slatH = (c.innerH / OVERHEAD_SLATS) * (1 - OVERHEAD_GAP_RATIO);
  const step = c.innerH / OVERHEAD_SLATS;
  const specs: BoxSpec[] = [];
  for (let i = 0; i < OVERHEAD_SLATS; i++) {
    const cy = c.cyMid - c.innerH / 2 + step * (i + 0.5);
    specs.push({ cx: 0, cy, cz: 0, sx: c.innerW, sy: slatH, sz: c.depth, mat: c.panelMat });
  }
  return specs;
}

/** Revolving: 2 crossing blades (4-arm) + center post. */
function revolvingBlades(c: LeafCtx, materials: OpeningMeshMaterials): BoxSpec[] {
  const blade = Math.max(c.depth, c.thicknessW * 0.06);
  const post = c.thicknessW * 0.12;
  return [
    { cx: 0, cy: c.cyMid, cz: 0, sx: c.innerW, sy: c.innerH, sz: blade, mat: c.panelMat },
    { cx: 0, cy: c.cyMid, cz: 0, sx: blade, sy: c.innerH, sz: c.innerW, mat: c.panelMat },
    { cx: 0, cy: c.cyMid, cz: 0, sx: post, sy: c.innerH, sz: post, mat: materials.frame },
  ];
}

/** Glazed 2-sash: side-by-side (horizontal slide) ή stacked (vertical / double-hung). */
function twoSashes(c: LeafCtx, axis: 'horizontal' | 'vertical'): BoxSpec[] {
  const dz = c.thicknessW * 0.12;
  if (axis === 'horizontal') {
    const w = c.innerW * 0.52;
    return [
      { cx: -c.innerW * 0.24, cy: c.cyMid, cz: dz, sx: w, sy: c.innerH, sz: c.depth, mat: c.panelMat },
      { cx: c.innerW * 0.24, cy: c.cyMid, cz: -dz, sx: w, sy: c.innerH, sz: c.depth, mat: c.panelMat },
    ];
  }
  const h = c.innerH * 0.52;
  return [
    { cx: 0, cy: c.cyMid - c.innerH * 0.24, cz: dz, sx: c.innerW, sy: h, sz: c.depth, mat: c.panelMat },
    { cx: 0, cy: c.cyMid + c.innerH * 0.24, cz: -dz, sx: c.innerW, sy: h, sz: c.depth, mat: c.panelMat },
  ];
}

/** Bay: projecting glazed body sticking out past the +Z (exterior) face. */
function bayBody(c: LeafCtx): BoxSpec[] {
  const proj = Math.max(c.innerW * BAY_DEPTH_RATIO, c.depth);
  const cz = c.thicknessW / 2 + proj / 2;
  return [
    { cx: 0, cy: c.cyMid, cz, sx: c.innerW * 0.85, sy: c.innerH, sz: proj, mat: c.panelMat },
  ];
}
