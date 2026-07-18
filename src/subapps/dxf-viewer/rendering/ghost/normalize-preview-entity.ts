/**
 * SSOT — normalize-preview-entity
 *
 * Χαρτογράφηση του RAW discriminator μιας οντότητας σκηνής στον τύπο που περιμένει το
 * drag-preview pipeline. Το ΕΝΑ σημείο όπου ζει αυτή η preview-side αντιστοίχιση — κοινό για
 * κάθε καταναλωτή preview (grip drag / body-drag / εργαλείο Μετακίνησης), ώστε να μην μπορούν
 * ποτέ να αποκλίνουν.
 *
 * Γιατί χωριστό module (2026-07-18): εξήχθη από το `apply-entity-preview.ts` όταν εκείνο πέρασε
 * το όριο των 500 γραμμών (N.7.1). Το όριο είναι σημασιολογικό, όχι αυθαίρετο — η κανονικοποίηση
 * απαντά «ΤΙ είναι αυτή η οντότητα;» ενώ το `applyEntityPreview` απαντά «ΠΩΣ μετασχηματίζεται;».
 * Δύο ερωτήματα, δύο αρχεία.
 *
 * @see ./apply-entity-preview — ο καταναλωτής του `rawTypeOf` + ο μετασχηματισμός geometry
 * @see ADR-040 — Preview Canvas Performance (unified ghost preview)
 * @see ADR-186 / ADR-561 — lwpolyline → polyline
 * @see ADR-620 — rectangle → polyline (SSoT προβολή κορυφών)
 */

import type { Point2D } from '../types/Types';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
// ADR-620/513 — SSoT rectangle→4-vertex projection (corner1/corner2 OR x/y/w/h + rotation), the
// SAME source the main-canvas projection + grips + the stretch commit use → preview ≡ commit order.
import { rectangleEntityVertices } from '../entities/shared/geometry-utils';

/**
 * Ο RAW `type` της οντότητας σκηνής — πριν από οποιαδήποτε κανονικοποίηση. Χρειάζεται επειδή το
 * `DxfEntityUnion` δεν περιλαμβάνει κάθε discriminator σκηνής (`'lwpolyline'`, `'rectangle'`,
 * `'mtext'`, `'group'`, `'block'`), οπότε ο έλεγχος γίνεται σε επίπεδο string.
 */
export function rawTypeOf(entity: DxfEntityUnion): string {
  return (entity as { readonly type: string }).type;
}

/** Το σχήμα από το οποίο το `rectangleEntityVertices` παράγει τις 4 κορυφές (και οι δύο κωδικοποιήσεις). */
type RectangleLike = {
  corner1?: Point2D; corner2?: Point2D;
  x?: number; y?: number; width?: number; height?: number; rotation?: number;
};

/**
 * ADR-186 / ADR-561 — normalize a RAW scene entity's discriminator for the drag-preview
 * pipeline. An `'lwpolyline'` (e.g. the result of joining two lines at an angle) is
 * geometrically a STANDARD polyline — same `{ vertices, closed, bulges }` shape — and the
 * committed canvas already renders it as one (`dxf-scene-entity-converter`: «LWPolyline →
 * render as standard polyline»). But this preview SSoT + the ghost model builder
 * (`buildEntityModelFromDxf`) are keyed on `'polyline'`, and preview callers pass the RAW
 * scene entity (`getEntity`), so a joined lwpolyline would match no branch → the ghost never
 * appears. Map the discriminator up-front (shallow clone, shape untouched) so it transforms +
 * renders EXACTLY like a polyline.
 */
export function normalizePreviewEntity(entity: DxfEntityUnion): DxfEntityUnion {
  const t = rawTypeOf(entity);
  if (t === 'lwpolyline') {
    return { ...(entity as object), type: 'polyline' } as DxfEntityUnion;
  }
  // ADR-620/513/349 — a scene RECTANGLE is geometrically a closed 4-vertex polyline: the main
  // canvas already projects it (`rectangleToVertices`), the grips are polyline vertex grips, and
  // the corner-stretch commit (`stretchRectangle`) coerces it to a polyline. But this preview SSoT
  // + the ghost model builder are keyed on `'polyline'`, and preview callers pass the RAW scene
  // entity (`getEntity`) — a freshly-drawn rectangle (corner1/corner2, x/y/w/h undefined) matched
  // NO branch → the reshape/rotation ghost never appeared (Giorgio 2026-07-18). Map it to a
  // polyline with the SAME `rectangleEntityVertices` order the grips + commit use, so a corner-grip
  // stretch ghosts as a polyline vertex move (preview ≡ commit). Degenerate rect (NaN verts) → keep
  // raw (no ghost, matches the commit's finite-guard skip). Mirror of the lwpolyline mapping above.
  if (t === 'rectangle' || t === 'rect') {
    const vertices = rectangleEntityVertices(entity as RectangleLike);
    if (vertices.some((v) => !Number.isFinite(v.x) || !Number.isFinite(v.y))) return entity;
    return { ...(entity as object), type: 'polyline', vertices, closed: true } as DxfEntityUnion;
  }
  return entity;
}
