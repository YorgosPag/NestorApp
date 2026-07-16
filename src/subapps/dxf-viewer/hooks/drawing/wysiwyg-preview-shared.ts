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
import type { AnySceneEntity } from '../../types/scene';
// Type-only, ώστε ο κύκλος με το `placement-overlay-fields` (που εισάγει από εδώ το
// `OpeningConflictMeta`) να σβήνει στο compile — μηδέν runtime import, μηδέν TDZ.
import type {
  PlacementOverlayFields,
  PlacementGhostEntity,
} from '../../bim/placement/placement-overlay-fields';
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
export const GHOST_DIM_GAP_OFFSET_PX = 22;
const GHOST_DIM_CENTER_OFFSET_PX = 50;
export const GHOST_DIM_MIN_PX = 2;

/**
 * ADR-508 §opening-conflict — meta που επισυνάπτεται στο 🔴 wall ghost όταν ο κάθετος τοίχος κόβει
 * άνοιγμα host. Μόνο αριθμοί (mm) → pure/N.11-clean· ο `drawing-hover-handler` μεταφράζει + μορφοποιεί
 * το κείμενο σε display units (i18n).
 */
export interface OpeningConflictMeta {
  /** [lo, hi] mm — η κατακόρυφη ζώνη σύγκρουσης (η «κομμένη» περιοχή του ανοίγματος). */
  readonly bandMm: readonly [number, number];
}

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
 * Τα overlay-meta που μπορεί να συνοδεύουν ένα WYSIWYG ghost.
 *
 * **Δεν ξανα-δηλώνονται εδώ**: είναι ακριβώς το υποσύνολο του `PlacementOverlayFields`
 * (ADR-544 SSoT) που προσαρτά αυτό το wrapper — ο τύπος του κάθε πεδίου έχει ΕΝΑΝ ιδιοκτήτη.
 * Τα `null` επιτρέπονται γιατί οι καλούντες περνούν ρητό `null` για «δεν ισχύει» (το ίδιο
 * νόημα με το `undefined` εδώ: το πεδίο απλώς δεν προσαρτάται).
 */
export type WysiwygGhostOverlays = {
  readonly [K in keyof Pick<
    PlacementOverlayFields,
    'ghostStatusColor' | 'faceDimensions' | 'openingConflict' | 'wallHud' | 'hudSpecLabel'
  >]?: PlacementOverlayFields[K] | null;
};

/**
 * Flag μια φρεσκο-χτισμένη BIM εντότητα ως **WYSIWYG placement ghost**: ο PreviewCanvas
 * (`BimPreviewRenderer`) τη ρεντάρει μέσω του ΠΡΑΓΜΑΤΙΚΟΥ renderer (full fidelity).
 *
 * Τα overlays έρχονται ως **ένα options object** αντί για ουρά θέσεων: μεγάλωνε κατά ένα
 * param ανά ADR (7 στην ADR-564), κι έτσι κάθε caller που ήθελε το τελευταίο έπρεπε να
 * περάσει `null` για όλα τα ενδιάμεσα (`toWysiwygPreviewEntity(e, id, null, null, null, hud, label)`).
 *
 * Το `T` δεσμεύεται σε `AnySceneEntity` — αυτό που **όντως** περνούν όλοι οι καλούντες
 * (μαζί με τις display-modified παραλλαγές, π.χ. beam cutback: είναι κι αυτές κανονικές
 * οντότητες με επιπλέον `geometry.displayOutline`). Χωρίς τη δέσμευση η επιστροφή ήταν
 * `as unknown as ExtendedSceneEntity` — type-lie, αφού ένα σκέτο `object` δεν είναι ghost.
 *
 * @see ADR-663 §4 part 5 — γιατί έφυγε το `as unknown as`
 */
export function toWysiwygPreviewEntity<T extends AnySceneEntity>(
  entity: T,
  id: string,
  overlays: WysiwygGhostOverlays = {},
): PlacementGhostEntity {
  const { ghostStatusColor, faceDimensions, openingConflict, wallHud, hudSpecLabel } = overlays;
  return {
    ...entity,
    id,
    preview: true,
    wysiwygPreview: true,
    ...(ghostStatusColor ? { ghostStatusColor } : {}),
    ...(faceDimensions && faceDimensions.dims.length > 0 ? { faceDimensions } : {}),
    ...(openingConflict ? { openingConflict } : {}),
    ...(wallHud ? { wallHud } : {}),
    // ADR-564 §linear-hud — προ-μεταφρασμένη ετικέτα spec ανά μέλος (π.χ. δοκάρι «b·h»). Όταν
    // απουσιάζει, ο handler πέφτει πίσω στην ετικέτα τοίχου (`buildWallHudSpecLabel`) — μηδέν
    // αλλαγή στον τοίχο.
    ...(hudSpecLabel ? { hudSpecLabel } : {}),
  };
}
