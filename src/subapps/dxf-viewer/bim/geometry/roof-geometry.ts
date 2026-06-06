/**
 * Roof geometry orchestrator + validation (ADR-417, Φ1 + Φ2a).
 *
 * `computeRoofGeometry(params)` = pure SSoT entry point: αναλύει τη συνταγή
 * (footprint + per-edge slopes) σε κεκλιμένα επίπεδα και αναθέτει την παραγωγή
 * των «νερών» (faces) + κορφιάδων (ridges) στον γενικό N-plane solver
 * (`roof-lower-envelope.ts`). Idempotent + side-effect free (FOOTPRINT ⊥ TYPE).
 * Όλοι οι downstream consumers (2Δ renderer, 3Δ converter, BOQ) διαβάζουν ΜΟΝΟ
 * αυτή τη derived γεωμετρία.
 *
 * ── Μορφές (Φ2a) ─────────────────────────────────────────────────────────────
 * 0 slope ακμές → flat· 1 → mono-pitch· 2 αντικριστές → gable· ≥3 (ή 2 πλάγιες)
 * → hip/complex, ΟΛΑ μέσω του ΙΔΙΟΥ `solveLowerEnvelope` (FULL SSOT). Το derived
 * `shape` είναι πλέον ΕΤΙΚΕΤΑ (BOQ/IFC PredefinedType)· η γεωμετρία δεν εξαρτάται
 * από αυτό.
 *
 * ── Μονάδες (mirror slab-geometry) ───────────────────────────────────────────
 * `outline` xy σε canvas units· slope/elevations σε mm. `s = mmToSceneUnits` =
 * canvas units ανά mm. Εμβαδά → m² μέσω `canvasToM`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md
 * @see bim/geometry/roof-lower-envelope.ts — ο γενικός N-plane solver
 * @see bim/geometry/slab-geometry.ts — μονάδες/εμβαδά convention
 */

import { nowTimestamp } from '@/lib/firestore-now';
import type { BimValidation, Polygon3D, Point3D } from '../types/bim-base';
import type {
  RoofEdgeSlope,
  RoofGeometry,
  RoofParams,
  RoofShape,
  RoofSlopeUnit,
} from '../types/roof-types';
import {
  DEFAULT_EAVE_OVERHANG_MM,
  DEFAULT_ROOF_SLOPE_DEG,
  MIN_ROOF_POLYGON_VERTICES,
} from '../types/roof-types';
import { polygonArea, polygonBbox, polygonPerimeter } from './shared/polygon-utils';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { roofSlopeToRatio, roofSlopeFromRatio } from './roof-slope-units';
import {
  inwardNormal,
  makeFace,
  resolveEavePlanes,
  solveLowerEnvelope,
  windingSign,
  type EavePlane,
  type LowerEnvelopeResult,
  type Vec2,
} from './roof-lower-envelope';

const MM_TO_M = 1 / 1000;
const DEG_TO_RAD = Math.PI / 180;
/** Two slope edges count as a gable pair when their inward normals are this anti-parallel. */
const GABLE_OPPOSITE_DOT = -0.7;

// Re-export slope-unit helpers (SSoT lives in `roof-slope-units.ts`) — consumers
// (ribbon bridge κ.ά.) εξακολουθούν να τα εισάγουν από εδώ.
export { roofSlopeToRatio, roofSlopeFromRatio };

// ─── Shape classification (ετικέτα — BOQ/IFC) ────────────────────────────────

/** Ταξινόμηση μορφής από τα κεκλιμένα επίπεδα. */
function classifyShape(planes: readonly EavePlane[]): RoofShape {
  if (planes.length === 0) return 'flat';
  if (planes.length === 1) return 'mono-pitch';
  if (planes.length === 2) {
    const dot = planes[0].n.x * planes[1].n.x + planes[0].n.y * planes[1].n.y;
    return dot <= GABLE_OPPOSITE_DOT ? 'gable' : 'complex';
  }
  return 'hip';
}

// ─── Engine ──────────────────────────────────────────────────────────────────

/**
 * Παράγει τα νερά + κορφιάδες. 0 planes → flat (1 face)· 1 → mono (1 face)·
 * ≥2 → γενικός lower-envelope solver (gable/hip/complex ενιαία). Graceful flat
 * fallback αν ο solver καταρρεύσει (degenerate footprint).
 */
function buildFacesAndRidges(
  footprint2D: readonly Vec2[],
  planes: readonly EavePlane[],
  basePivotZ: number,
  s: number,
  canvasToM: number,
): LowerEnvelopeResult {
  const flat = (ratio: number, pl: readonly EavePlane[]): LowerEnvelopeResult => ({
    faces: [makeFace(footprint2D, ratio, pl, basePivotZ, s, canvasToM)],
    ridges: [],
  });
  if (planes.length === 0) return flat(0, []);
  if (planes.length === 1) return flat(planes[0].ratio, planes);
  const solved = solveLowerEnvelope(footprint2D, planes, basePivotZ, s, canvasToM);
  return solved.faces.length > 0 ? solved : flat(0, []);
}

/**
 * Compute `RoofGeometry` από `RoofParams`. Pure SSoT. Επιστρέφει graceful flat
 * geometry για υπο-3-κορυφο footprint. Throws nothing — validation στο
 * `validateRoofParams()`.
 */
export function computeRoofGeometry(params: RoofParams): RoofGeometry {
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const canvasToM = (1 / s) * MM_TO_M;
  const verts = params.outline.vertices;
  const footprint2D: Vec2[] = verts.map((v) => ({ x: v.x, y: v.y }));

  const projectedAreaM2 = polygonArea(verts) * canvasToM * canvasToM;
  const perimeterM = polygonPerimeter(verts) * canvasToM;
  const xyBbox = polygonBbox(verts);

  const resolved = resolveEavePlanes(verts, params.edges, params.slopeUnit);
  const planes = verts.length >= MIN_ROOF_POLYGON_VERTICES ? resolved.planes : [];
  const shape = verts.length >= MIN_ROOF_POLYGON_VERTICES ? classifyShape(planes) : 'flat';

  const { faces, ridges } = buildFacesAndRidges(footprint2D, planes, params.basePivotZ, s, canvasToM);

  const grossAreaM2 = faces.reduce((sum, f) => sum + f.grossAreaM2, 0);
  const thicknessMm = Math.max(0, params.thickness);
  const volumeM3 = grossAreaM2 * thicknessMm * MM_TO_M;

  // Ύψος κορφιά = μέγιστο z όλων των face κορυφών πάνω από το basePivot.
  let maxZmm = params.basePivotZ;
  for (const f of faces) {
    for (const v of f.outline) {
      if ((v.z ?? params.basePivotZ) > maxZmm) maxZmm = v.z ?? params.basePivotZ;
    }
  }
  const ridgeHeightMm = Math.max(0, maxZmm - params.basePivotZ);

  const bbox = {
    min: { x: xyBbox.min.x, y: xyBbox.min.y, z: (params.basePivotZ - thicknessMm) * MM_TO_M },
    max: { x: xyBbox.max.x, y: xyBbox.max.y, z: maxZmm * MM_TO_M },
  };

  return {
    footprint: params.outline,
    faces,
    ridges,
    bbox,
    projectedAreaM2,
    grossAreaM2,
    perimeterM,
    volumeM3,
    // BOQ aliases (SSoT path): covering area = κεκλιμένο GrossArea (ADR-417 Q7).
    area: grossAreaM2,
    volume: volumeM3,
    shape,
    ridgeHeightMm,
  };
}

// ─── Edge presets (UI / completion helper) ───────────────────────────────────

/** Μήκος ακμής i (canvas) σε CCW footprint. */
function edgeLength(verts: readonly Point3D[], i: number): number {
  const v0 = verts[i];
  const v1 = verts[(i + 1) % verts.length];
  return Math.hypot(v1.x - v0.x, v1.y - v0.y);
}

/** Όλες οι ακμές flat (αρχικό default — επίπεδο δώμα). */
export function buildDefaultRoofEdges(outline: Polygon3D): RoofEdgeSlope[] {
  return outline.vertices.map(() => ({ definesSlope: false, slope: 0, overhangMm: 0 }));
}

/**
 * Παράγει τον πίνακα `edges` για μια μορφή-preset (ADR-417 Q3): flat / mono /
 * gable / hip. Επιλέγει τις slope-defining ακμές από τη γεωμετρία του footprint,
 * ώστε το contextual tab + το completion να μοιράζονται ΜΙΑ SSoT.
 *
 *   - flat → καμία slope-defining ακμή.
 *   - mono-pitch → η μακρύτερη ακμή.
 *   - gable → μακρύτερη + η πιο αντικριστή της.
 *   - hip → ΟΛΕΣ οι ακμές κλίνουν (τετράρριχτη — όλα τα γείσα ανηφορίζουν).
 */
export function applyRoofShapePreset(
  outline: Polygon3D,
  shape: 'flat' | 'mono-pitch' | 'gable' | 'hip',
  slope: number,
  unit: RoofSlopeUnit,
): RoofEdgeSlope[] {
  const verts = outline.vertices;
  const n = verts.length;
  const edges = buildDefaultRoofEdges(outline);
  if (shape === 'flat' || n < MIN_ROOF_POLYGON_VERTICES) return edges;

  // Πάσα κεκλιμένη μορφή παίρνει εξ ορισμού προεξοχή γείσου σε ΟΛΕΣ τις περιμετρικές
  // ακμές (eaves + αετώματα) — έτσι το γείσο φαίνεται αμέσως (ADR-417 Φ2b). Η flat
  // (δώμα) μένει 0 (παραπέτο). Per-edge editable αργότερα από το contextual tab.
  const o = DEFAULT_EAVE_OVERHANG_MM;
  if (shape === 'hip') {
    return verts.map(() => ({ definesSlope: true, slope, overhangMm: o }));
  }

  // Μακρύτερη ακμή = κύριο γείσο.
  let mainIdx = 0;
  let maxLen = -1;
  for (let i = 0; i < n; i++) {
    const len = edgeLength(verts, i);
    if (len > maxLen) { maxLen = len; mainIdx = i; }
  }
  edges[mainIdx] = { definesSlope: true, slope, overhangMm: o };
  if (shape === 'mono-pitch') return edges.map((e) => ({ ...e, overhangMm: o }));

  // gable → η πιο αντικριστή ακμή (inward normals anti-parallel). Το dot είναι
  // winding-invariant (sign² = 1) — περνάμε το sign για συνέπεια με τη μηχανή.
  const sign = windingSign(verts);
  const mainN = inwardNormal(verts[mainIdx], verts[(mainIdx + 1) % n], sign);
  let oppIdx = -1;
  let minDot = Infinity;
  for (let i = 0; i < n; i++) {
    if (i === mainIdx) continue;
    const ni = inwardNormal(verts[i], verts[(i + 1) % n], sign);
    const dot = mainN.x * ni.x + mainN.y * ni.y;
    if (dot < minDot) { minDot = dot; oppIdx = i; }
  }
  if (oppIdx >= 0 && minDot <= GABLE_OPPOSITE_DOT) {
    edges[oppIdx] = { definesSlope: true, slope, overhangMm: o };
  }
  return edges.map((e) => ({ ...e, overhangMm: o }));
}

// ─── Validation ──────────────────────────────────────────────────────────────

/** Result of a roof validation pass — hard errors non-empty when invalid. */
export interface RoofValidationResult {
  /** Όταν non-empty → caller MUST refuse entity creation. i18n keys. */
  readonly hardErrors: readonly string[];
  /** Non-blocking code violations (Revit pattern: warn, don't block). i18n keys. */
  readonly codeViolations: readonly string[];
  /** `BimValidation` payload για άμεση ανάθεση στο `RoofEntity.validation`. */
  readonly bimValidation: BimValidation;
}

/**
 * Validate `RoofParams`. Pure (geometry re-derivable). Hard errors: degenerate
 * footprint / edges-length mismatch / μη-θετικό πάχος / άκυρη κλίση σε
 * slope-defining ακμή. Code violations (warnings): πολύ απότομη κλίση (>60°).
 */
export function validateRoofParams(params: RoofParams): RoofValidationResult {
  const hardErrors: string[] = [];
  const codeViolations: string[] = [];
  const verts = params.outline.vertices;

  if (verts.length < MIN_ROOF_POLYGON_VERTICES) {
    hardErrors.push('roof.validation.hardErrors.footprintTooSmall');
  }
  if (params.edges.length !== verts.length) {
    hardErrors.push('roof.validation.hardErrors.edgesMismatch');
  }
  if (params.thickness <= 0) {
    hardErrors.push('roof.validation.hardErrors.nonPositiveThickness');
  }
  for (const e of params.edges) {
    if (!e.definesSlope) continue;
    const bad = params.slopeUnit === 'deg'
      ? !(e.slope > 0 && e.slope < 90)
      : !(e.slope > 0);
    if (bad) { hardErrors.push('roof.validation.hardErrors.invalidSlope'); break; }
  }

  for (const e of params.edges) {
    if (!e.definesSlope) continue;
    const ratio = roofSlopeToRatio(e.slope, params.slopeUnit);
    if (ratio > Math.tan(60 * DEG_TO_RAD)) {
      codeViolations.push('roof.validation.codeViolations.steepSlope');
      break;
    }
  }

  const bimValidation: BimValidation = {
    hasCodeViolations: codeViolations.length > 0,
    violationKeys: [...codeViolations],
    lastValidatedAt: nowTimestamp(),
  };

  return { hardErrors, codeViolations, bimValidation };
}

/** Convenience default slope (μοίρες) για νέα κεκλιμένη στέγη. */
export const ROOF_PRESET_DEFAULT_SLOPE_DEG = DEFAULT_ROOF_SLOPE_DEG;

/** Convenience: ratio από μια κλίση/μονάδα — re-export για downstream tooling. */
export function roofSceneCanvasToM(sceneUnits: SceneUnits): number {
  return (1 / mmToSceneUnits(sceneUnits)) * MM_TO_M;
}
