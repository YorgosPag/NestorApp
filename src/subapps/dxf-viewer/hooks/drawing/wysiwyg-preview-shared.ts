/**
 * @module wysiwyg-preview-shared
 * @description SSoT για τα κοινά glue μοτίβα **όλων** των WYSIWYG placement previews
 * (δοκάρι / τοίχος / θεμελίωση / κολώνα). Πριν, κάθε `*-preview-helpers.ts` αντέγραφε:
 *   1. το «snapped-or-raw cursor» read (`getImmediateSnap()` με fallback)·
 *   2. το «flag εντότητα ως WYSIWYG ghost» wrapper (`preview`+`wysiwygPreview`+status).
 * Πλέον ζουν ΜΙΑ φορά εδώ — μηδέν διπλότυπο (N.0.2 / SSoT).
 *
 * @see ./beam-preview-helpers.ts · ./foundation-preview-helpers.ts · ./column-preview-helpers.ts — consumers
 * @see ../../canvas-v2/preview-canvas/bim-preview-render.ts — ρεντάρει το flagged entity με τον πραγματικό renderer
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md §3.8
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ExtendedSceneEntity } from './drawing-types';
import type { GhostStatusColor } from '../../bim/ghosts/ghost-status-color';
import type { GhostFaceFrame } from '../../bim/framing/linear-member-face-snap';
import {
  resolveGhostFaceDimensions,
  type GhostFaceDimensionsMeta,
} from '../../bim/framing/ghost-face-dim-references';
import { arcListeningDimConfigStore } from '../../bim/framing/arc-listening-dim-config';
import type { SceneUnits } from '../../utils/scene-units';
import { getImmediateSnap } from '../../systems/cursor/ImmediateSnapStore';

// ADR-508 §dim — listening-dimension dim-line offsets, screen-relative (× worldPerPixel) so the
// witness rows sit a constant pixel distance from the face at every zoom. SHARED SSoT for ALL
// member ghosts (wall / beam / column) — μηδέν διπλότυπο.
const GHOST_DIM_GAP_OFFSET_PX = 22;
const GHOST_DIM_CENTER_OFFSET_PX = 50;
const GHOST_DIM_MIN_PX = 2;

/**
 * ADR-508 §dim — SSoT: build listening-dimension metadata from a 🟢 face-snap frame (gap-left /
 * gap-right / centre-to-centre, zoom-adaptive). `null` όταν δεν υπάρχει frame ή είναι 🔴 overlap.
 * Καταναλώνεται ΟΛΩΝ των member-ghost helpers (wall/beam/column) → ένας κώδικας για όλα.
 */
export function resolveGhostFaceDimensionsMeta(
  faceFrame: GhostFaceFrame | undefined,
  isOverlap: boolean,
  sceneUnits: SceneUnits,
  wpp: number,
): GhostFaceDimensionsMeta | null {
  if (!faceFrame || isOverlap) return null;
  // ADR-398 §3.12 — οι ρυθμίσεις arc-length dims (config SSoT)· ο ευθύς κλάδος τις αγνοεί (gated).
  const arcConfig = arcListeningDimConfigStore.get();
  const dims = resolveGhostFaceDimensions(faceFrame, {
    gapOffsetScene: GHOST_DIM_GAP_OFFSET_PX * wpp,
    centerOffsetScene: GHOST_DIM_CENTER_OFFSET_PX * wpp,
    minValueScene: GHOST_DIM_MIN_PX * wpp,
    arcConfig,
  });
  return dims.length > 0 ? { sceneUnits, dims, labelMode: arcConfig.labelMode } : null;
}

/**
 * Το σημείο στο οποίο κουμπώνει το ghost = **ΑΚΡΙΒΩΣ** το σημείο που χρησιμοποιεί το
 * commit. Ο `snap-scheduler` γράφει το face/corner/grid snapped point στο `ImmediateSnap`
 * στο ίδιο move· εδώ διαβάζεται imperatively (zero React, ADR-040). Fallback στον raw
 * cursor όταν δεν υπάρχει armed snap → ο άξονας του ghost ταυτίζεται με το σταυρόνημα.
 */
export function resolveEffectivePreviewCursor(cursorPoint: Readonly<Point2D>): Point2D {
  const snap = getImmediateSnap();
  return snap?.found === true && snap.point != null
    ? { x: snap.point.x, y: snap.point.y }
    : { x: cursorPoint.x, y: cursorPoint.y };
}

/**
 * Flag μια φρεσκο-χτισμένη BIM εντότητα ως **WYSIWYG placement ghost**: ο PreviewCanvas
 * (`BimPreviewRenderer`) τη ρεντάρει μέσω του ΠΡΑΓΜΑΤΙΚΟΥ renderer (full fidelity).
 * Optional `ghostStatusColor` (🔴 overlap) → ο `PreviewRenderer` ζωγραφίζει status schematic
 * αντί WYSIWYG (ADR-398 §3.6 red-only). Optional `faceDimensions` (ADR-508 §dim) → listening
 * dimensions που ζωγραφίζει ο handler ως overlay πάνω από το ghost. Generic ώστε να δέχεται
 * κάθε `*Entity` + display-modified παραλλαγές (π.χ. beam cutback) χωρίς `any`.
 */
export function toWysiwygPreviewEntity<T extends object>(
  entity: T,
  id: string,
  ghostStatusColor?: GhostStatusColor | null,
  faceDimensions?: GhostFaceDimensionsMeta | null,
): ExtendedSceneEntity {
  return {
    ...entity,
    id,
    preview: true,
    wysiwygPreview: true,
    ...(ghostStatusColor ? { ghostStatusColor } : {}),
    ...(faceDimensions && faceDimensions.dims.length > 0 ? { faceDimensions } : {}),
  } as unknown as ExtendedSceneEntity;
}
