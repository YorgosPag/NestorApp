/**
 * ADR-449 PART B Slice C — per-face override operations (pure SSoT).
 *
 * Γέφυρα ανάμεσα στο face-picking (ADR-539 polygon mode: `{bimId, faceKey}`) και στο
 * per-element finish override (`spec.faceOverrides[ref]`, Slice A/B). Το picking χτυπά
 * τον δομικό **πυρήνα** (το merged σοβά-blanket είναι μη-pickable) → επιστρέφει `side:i`
 * (ακμή i του footprint, `buildFacedPrism` SSoT). Το ίδιο `i` δίνει το `finishFaceRef`
 * της ακμής → το κλειδί του override στο element spec (element-owned Revit «Paint»).
 *
 * Pure: μηδέν globals/React/THREE/scene — 100% testable, reused ΚΑΙ από το 3D command
 * ΚΑΙ (μελλοντικά) από το 2D hit-test.
 *
 * @see ../../bim-3d/converters/bim-three-faced-prism.ts — materialIndex↔FaceKey (`side:i`)
 * @see ./structural-finish-face-ref.ts — finishFaceRef (midpoint-key)
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md §PART B
 */

import { finishFaceRef, type FinishFaceRef } from './structural-finish-face-ref';
import type { FinishFaceOverride, StructuralFinishSpec } from './structural-finish-types';
import type { Pt2 } from '../geometry/shared/segment-polygon-coverage';

/**
 * Ελάχιστο σχήμα ενός finish-paintable δομικού στοιχείου: stored footprint (κολόνα) /
 * outline (δοκάρι geometry· πλάκα params) + `params.finish`. Κοινό SSoT για τον writer
 * (`SetFinishFaceOverrideCommand`) ΚΑΙ το entity-level «όλος ο σοβάς» (drag-drop, ADR-539).
 */
export interface FinishPaintableEntity {
  readonly params?: {
    readonly finish?: StructuralFinishSpec;
    /** ADR-534 Φ6b — outline πλάκας (SlabParams.outline): το stored footprint για finishFaceRef. */
    readonly outline?: { readonly vertices?: readonly { x: number; y: number }[] };
  };
  readonly geometry?: {
    readonly footprint?: { readonly vertices?: readonly { x: number; y: number }[] };
    readonly outline?: { readonly vertices?: readonly { x: number; y: number }[] };
  };
}

/** Το stored footprint για finishFaceRef: κολόνα → footprint, δοκάρι → geometry.outline, πλάκα → params.outline. */
export function finishFootprintVertices(entity: FinishPaintableEntity): readonly Pt2[] | undefined {
  return entity.geometry?.footprint?.vertices ?? entity.geometry?.outline?.vertices ?? entity.params?.outline?.vertices;
}

/**
 * ADR-539 (Giorgio 2026-07-22) — τα `side:i` faceKeys ΟΛΩΝ των κάθετων όψεων του footprint,
 * ώστε το entity-level «ΣΟΒΑΣ» drag-drop να βάφει ολόκληρο το κέλυφος με ΕΝΑ undo (mirror του
 * `entireElementFaceMap` του σώματος). Επιστρέφει κενό όταν το footprint είναι εκφυλισμένο (<3).
 */
export function wholeElementFinishFaceKeys(entity: FinishPaintableEntity): readonly string[] {
  const verts = finishFootprintVertices(entity);
  if (!verts || verts.length < 3) return [];
  return verts.map((_, i) => `side:${i}`);
}

/** `side:i` → δείκτης ακμής i· κάθε άλλο faceKey (`top`/`bottom`/`hole:*`/base) → `null`. */
export function edgeIndexFromFaceKey(faceKey: string): number | null {
  const m = /^side:(\d+)$/.exec(faceKey);
  return m ? Number(m[1]) : null;
}

/**
 * `side:i` faceKey + footprint → `finishFaceRef` της ακμής i (a→b), ή `null` όταν το
 * faceKey δεν είναι πλευρά (οριζόντια cap/hole) ή το footprint εκφυλισμένο/εκτός ορίων.
 * ΙΔΙΟ footprint με αυτό που ταΐζει το `pushFinishOverrideEdges` (stored geometry) →
 * το key ταιριάζει με το override που διαβάζει η σιλουέτα.
 */
export function finishFaceRefForFaceKey(
  footprint: readonly Pt2[],
  faceKey: string,
): FinishFaceRef | null {
  const i = edgeIndexFromFaceKey(faceKey);
  if (i === null || footprint.length < 3 || i >= footprint.length) return null;
  return finishFaceRef(footprint[i], footprint[(i + 1) % footprint.length]);
}

/** True όταν το override είναι ουσιαστικά κενό (τίποτα να εφαρμοστεί → clear). */
function isEmptyOverride(o: FinishFaceOverride): boolean {
  return !o.materialId && !o.colorOverride && o.thickness === undefined;
}

/**
 * Καθαρή συγχώνευση/καθαρισμός ΕΝΟΣ override στο `spec.faceOverrides[ref]`, επιστρέφοντας
 * ΝΕΟ spec (immutable). `null` ή κενό override → **διαγραφή** του ref (επιστροφή σε
 * ομοιόμορφο κέλυφος). Firestore-safe: κανένα explicit `undefined` στο map.
 */
export function withFinishFaceOverride(
  spec: StructuralFinishSpec,
  ref: FinishFaceRef,
  override: FinishFaceOverride | null,
): StructuralFinishSpec {
  const next: Record<string, FinishFaceOverride> = { ...(spec.faceOverrides ?? {}) };
  if (override === null || isEmptyOverride(override)) delete next[ref];
  else next[ref] = override;
  return { ...spec, faceOverrides: next };
}
