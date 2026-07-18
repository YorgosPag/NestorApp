/**
 * material-depth-priority — coplanar-face depth-bias SSoT for BIM 3D solids.
 *
 * Extracted from `MaterialCatalog3D.ts` (N.7.1 size split). Owns the face
 * polygon-offset constants (ADR-375 «Shaded with Edges») and the per-category
 * depth-priority bias (ADR-366 §B.5 coplanar z-fighting). Shared by every
 * material path in the catalog so all solids inherit the same bias contract.
 */

import * as THREE from 'three';

/**
 * ADR-375 Phase C.7 — "Shaded with Edges" depth bias (Revit-grade visual style).
 *
 * The BIM 3D edge overlays (`bim-3d-edge-overlay-builder.ts`) are `LineSegments2`
 * geometrically COPLANAR with the solid faces at every hard corner, rendered with
 * `depthTest:true`. Without a face-side depth bias the coplanar faces win the depth
 * test and the dark "pencil" edges disappear (z-fighting) → flat-shaded look.
 *
 * Revit / ArchiCAD "Shaded with Edges" pushes the SHADED FACES slightly back in the
 * depth buffer so the depth-tested edges always win. A tiny positive offset is
 * uniform across all faces → the face-to-face relationship is untouched; only the
 * face-vs-edge contest changes. SSoT: applied in the SOLE face-material factory
 * (`buildMat`) — every material path (flat, textured, system-tinted, user, relief)
 * routes through it, so all solids inherit it.
 */
export const FACE_POLYGON_OFFSET_FACTOR = 1;
export const FACE_POLYGON_OFFSET_UNITS = 1;

/**
 * Per-category DEPTH PRIORITY (polygonOffsetUnits) — coplanar-face z-fighting SSoT.
 *
 * Structural elements are modelled FLUSH: a beam embedded in a slab, a column
 * stopping at the floor level — their top faces are geometrically COPLANAR at the
 * storey elevation. With a single uniform `polygonOffsetUnits` (1) on every solid,
 * those coplanar faces share the exact same depth → the depth test has no
 * tie-breaker → they flicker between materials as the camera orbits (Giorgio:
 * «μίξη χρωμάτων στις πάνω παρειές που κινείται με το orbit», 2026-06-19).
 *
 * Fix: a deterministic per-category bias. LOWER units = nearer the camera = WINS.
 * The visually-dominant surface gets the smallest bias:
 *   - finish/plaster skin (0.5) → wins over EVERY structural core,
 *   - slab (floor/roof surface, 2) → wins over the beams/columns embedded in it,
 *   - beam (3), column (4), foundations (5-7, each distinct so coplanar footing
 *     tops don't fight each other either).
 * Everything not listed (incl. the WALL core, resolved by its DNA material key
 * `mat-brick`/`mat-concrete`/… — NOT an `elem-*` key) falls to the default tier (1).
 * Edge overlays (`LineSegments2`, polygonOffset 0) stay nearest of all → still win
 * against every face, so the ADR-375 "Shaded with Edges" contract is preserved
 * (all biases are > 0, i.e. still pushed back relative to the edges).
 *
 * §wall-plaster (Giorgio 2026-07-18) — ο σοβάς σε ΤΟΙΧΟ έκανε z-fight (κόκκινο μπρίκι
 * `0xb05030` ↔ γκρι σοβάς `0xe8e0d0` που «ανακατεύονταν» στο orbit). Root: το finish skin
 * (`mat-plaster`) ΚΑΙ ο τοίχος-πυρήνας (`mat-brick`/`mat-concrete`) έπεφταν ΚΑΙ ΤΑ ΔΥΟ στο
 * default tier (1) → ισοπαλία βάθους. Οι κολόνες/δοκάρια/πλάκες δεν είχαν το bug γιατί ο
 * πυρήνας τους χρησιμοποιεί `elem-*` key (tier 2/3/4) > finish(1). Ο τοίχος όμως δεν έχει
 * `elem-wall` key — παίρνει το DNA υλικό του → default 1 = finish. Fix: ο σοβάς παίρνει
 * ΔΙΚΟ του finish tier (0.5) < default → νικά ΚΑΘΕ πυρήνα (και τον material-keyed τοίχο),
 * μένοντας πίσω από τις ακμές (> 0). Zero blast radius (αλλάζει μόνο ο σοβάς).
 */
/** Finish/plaster skin — nearest FACE tier: below every structural core, above the edge overlays (0). */
export const FINISH_SKIN_DEPTH_OFFSET_UNITS = 0.5;

const STRUCTURAL_DEPTH_OFFSET_UNITS: Readonly<Record<string, number>> = {
  'mat-plaster': FINISH_SKIN_DEPTH_OFFSET_UNITS,
  'elem-slab': 2,
  'elem-beam': 3,
  'elem-column': 4,
  'elem-foundation': 5,
  'elem-foundation-pad': 5,
  'elem-foundation-strip': 6,
  'elem-foundation-tie-beam': 7,
};

/** Depth-priority bias for a resolved material key (default = finish/skin tier). */
function depthOffsetUnitsForKey(key: string): number {
  return STRUCTURAL_DEPTH_OFFSET_UNITS[key] ?? FACE_POLYGON_OFFSET_UNITS;
}

/** Apply the per-category depth bias to a resolved (cached) material. Idempotent. */
export function withDepthPriority(mat: THREE.MeshStandardMaterial, key: string): THREE.MeshStandardMaterial {
  mat.polygonOffsetUnits = depthOffsetUnitsForKey(key);
  return mat;
}
