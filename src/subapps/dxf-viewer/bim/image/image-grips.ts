/**
 * ADR-654 — Raster image grip SSoT (pure helpers).
 *
 * Η ΜΙΑ πηγή που τροφοδοτεί ΚΑΙ ΤΑ ΔΥΟ grip paths μιας εικόνας (entourage sprite /
 * furniture-plan sprite / σφραγίδα πινακίδας), ώστε να μην μπορούν να αποκλίνουν:
 *   - `computeDxfEntityGrips` (GRIP_PRODUCERS['image']) → interaction + hit-testing.
 *   - `ImageRenderer.getGrips()` → η on-canvas ζωγραφική των λαβών.
 * (Πριν το ADR-654 ο renderer ζωγράφιζε 8 άτυπες λαβές που ΔΕΝ υπήρχαν στο registry —
 * φαίνονταν αλλά δεν έπιαναν, γι' αυτό η εικόνα δεν μετακινούνταν από λαβή.)
 *
 * Λαβές (Revit «Image» / Figma frame parity — corner-anchored ορθογώνιο):
 *   0    → MOVE σταυρός στο ΚΕΝΤΡΟ του κουτιού (`movesEntity` → whole-entity translate
 *          του `position`· το ίδιο 4-arrow glyph με τον τοίχο, μέσω `grip-glyph-registry`).
 *   1    → ROTATION λαβή στο μέσο της ΠΑΝΩ ακμής (curved glyph). Το drag γράφει ΜΟΝΟ
 *          `rotation` (μοίρες, swept-angle SSoT· hot-grip → orbit γύρω από επιλεγμένο κέντρο).
 *   2..5 → SIZE λαβές στις 4 γωνίες (σειρά `RECT_CORNERS` = NE/NW/SW/SE). Το drag κρατά την
 *          ΑΝΤΙΘΕΤΗ γωνία σταθερή (κοινός `rect-grip-engine`, ίδια σημασιολογία με τοίχο/
 *          κολόνα/block) → πατάει `position` + `width` + `height`.
 *   6..8 → SIZE μεσοπλευρικές λαβές (E/S/W — ΟΧΙ πάνω, όπου κάθεται το ROTATION grip). 1-άξονα
 *          stretch με την ΑΝΤΙΘΕΤΗ ακμή σταθερή (κοινός `rect-grip-engine` `applyRectEdgeDrag`,
 *          ΙΔΙΟ code με τοίχο/block) → `position` + `width`/`height`. `type:'midpoint'` → gated
 *          από το «Midpoints» preference (wall parity)· μη-ομοιόμορφο scale εξ ορισμού.
 *
 * ΜΗΔΕΝ νέα γεωμετρία: το ορθογώνιο περιγράφεται με το κοινό `RectFrame` (`rect-frame.ts`),
 * το resize τρέχει στον κοινό `rect-grip-engine`, η περιστροφή στο κοινό `rotateEntityGripDragDeg`.
 * Το `geometry` δεν υπάρχει καν — το `ImageEntity` είναι flat params (position/width/height/
 * rotation), οπότε το commit είναι ένα `UpdateEntityCommand` patch (μέσω του shared
 * `commitParametricAnnotationGripDrag`), ίδιο με scale-bar / opening-info-tag.
 *
 * @see bim/grips/rect-frame.ts — RectFrame + corner/edge world readers (shared)
 * @see bim/grips/rect-grip-engine.ts — opposite-corner-fixed resize (shared)
 * @see rendering/entities/shared/image-rect-vertices.ts — το vertex SSoT του render/hit-test
 * @see docs/centralized-systems/reference/adrs/ADR-654-furniture-plan-entourage.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, ImageGripKind } from '../../hooks/grip-types';
import type { ImageEntity } from '../../types/image';
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import { RECT_CORNERS, rectCornerWorld, rectEdgeWorld, type RectCorner, type RectEdge, type RectFrame } from '../grips/rect-frame';
import { applyRectCornerDrag, applyRectEdgeDrag } from '../grips/rect-grip-engine';
import { rotateVector, rotateEntityGripDragDeg } from '../grips/grip-math';

/** Τα grip kinds της εικόνας (δρομολογούνται από το `PARAMETRIC_COMMIT_HANDLERS`). */
export const IMAGE_MOVE_KIND: ImageGripKind = 'image-move';
export const IMAGE_ROTATION_KIND: ImageGripKind = 'image-rotation';

/** Γωνιακά kinds — ΙΔΙΑ σειρά με το `RECT_CORNERS` (NE, NW, SW, SE). */
const IMAGE_CORNER_KINDS: readonly ImageGripKind[] = [
  'image-corner-ne',
  'image-corner-nw',
  'image-corner-sw',
  'image-corner-se',
];

const CORNER_BY_KIND: Readonly<Partial<Record<ImageGripKind, RectCorner>>> = Object.fromEntries(
  IMAGE_CORNER_KINDS.map((kind, i) => [kind, RECT_CORNERS[i]]),
);

/**
 * Μεσοπλευρικά kinds — 3 πλευρές (E/S/W)· ΟΧΙ πάνω (Ν), όπου κάθεται το `image-rotation` grip
 * (Giorgio 2026-07-14). Σταθερή σειρά → grip indices 6..8.
 */
const IMAGE_EDGE_KINDS: readonly ImageGripKind[] = ['image-edge-e', 'image-edge-s', 'image-edge-w'];

/**
 * kind → `RectEdge` (τοπικός άξονας + πρόσημο): local +X = πλάτος, +Y = ύψος. E=+X, W=−X, S=−Y.
 * Το +Y (πάνω) παραλείπεται σκόπιμα — εκεί είναι η λαβή περιστροφής.
 */
const EDGE_BY_KIND: Readonly<Partial<Record<ImageGripKind, RectEdge>>> = {
  'image-edge-e': { axis: 'x', sign: 1 },
  'image-edge-s': { axis: 'y', sign: -1 },
  'image-edge-w': { axis: 'x', sign: -1 },
};

/** Ελάχιστη ημι-διάσταση (μονάδες σχεδίου) — απλώς εμποδίζει το κουτί να μηδενιστεί/αναποδογυρίσει. */
const MIN_HALF = 1e-6;

/** Το δομικό σχήμα της εικόνας όσον αφορά τη γεωμετρία κουτιού (flat params). */
export interface ImageBoxShape {
  readonly position: Point2D;
  readonly width: number;
  readonly height: number;
  readonly rotation?: number;
}

/**
 * `ImageEntity` → `RectFrame` (centre-anchored). Το `position` είναι η ΚΑΤΩ-ΑΡΙΣΤΕΡΗ γωνία
 * (y-up, σύμβαση DXF INSERT) και η `rotation` (μοίρες CCW) εφαρμόζεται ΓΥΡΩ ΑΠΟ ΑΥΤΗΝ — άρα
 * το κέντρο είναι `position + R(θ)·(w/2, h/2)`, ακριβώς όπως το παράγει το
 * `createRectangleVertices` (pivot = corner1) στον renderer/hit-test.
 */
export function imageRectFrame(e: ImageBoxShape): RectFrame {
  const halfWidth = e.width / 2;
  const halfLength = e.height / 2;
  const rotationDeg = e.rotation ?? 0;
  return {
    center: translatePoint(e.position, rotateVector({ x: halfWidth, y: halfLength }, rotationDeg)),
    rotationDeg,
    halfWidth,
    halfLength,
  };
}

/** `RectFrame` → flat image params (το `position` ξαναγίνεται η κάτω-αριστερή γωνία). */
function frameToImageParams(frame: RectFrame): Pick<ImageEntity, 'position' | 'width' | 'height'> {
  return {
    position: rectCornerWorld(frame, { sx: -1, sy: -1 }),
    width: frame.halfWidth * 2,
    height: frame.halfLength * 2,
  };
}

/**
 * Οι λαβές μιας εικόνας — το SSoT που καταναλώνουν ΚΑΙ τα δύο grip paths:
 * MOVE (κέντρο) + ROTATION (μέσο πάνω ακμής) + 4 γωνιακές SIZE. Όλες οι θέσεις
 * παράγονται από το `RectFrame` (rotation-aware), ποτέ από raw params.
 */
export function getImageGrips(entity: ImageEntity): GripInfo[] {
  const frame = imageRectFrame(entity);
  const grips: GripInfo[] = [
    {
      entityId: entity.id, gripIndex: 0, type: 'center',
      position: frame.center, movesEntity: true,
      gripKind: { on: 'image', kind: IMAGE_MOVE_KIND },
    },
    {
      entityId: entity.id, gripIndex: 1, type: 'vertex',
      position: rectEdgeWorld(frame, { axis: 'y', sign: 1 }), movesEntity: false,
      gripKind: { on: 'image', kind: IMAGE_ROTATION_KIND },
    },
  ];
  // Γωνιακές λαβές: `type:'corner'` → structural (πάντα ορατές, επιβιώνουν τα grip-type toggles
  // και το multi-select φιλτράρισμα — wall/block parity).
  RECT_CORNERS.forEach((corner, i) => {
    grips.push({
      entityId: entity.id, gripIndex: 2 + i, type: 'corner',
      position: rectCornerWorld(frame, corner), movesEntity: false,
      gripKind: { on: 'image', kind: IMAGE_CORNER_KINDS[i] },
    });
  });
  // Μεσοπλευρικές λαβές (3: E/S/W — ΟΧΙ πάνω): `type:'midpoint'` → helper, gated από το
  // «Midpoints» grip-type preference (wall/block parity)· επιβιώνει τα toggles ως midpoint.
  IMAGE_EDGE_KINDS.forEach((kind, i) => {
    grips.push({
      entityId: entity.id, gripIndex: 6 + i, type: 'midpoint',
      position: rectEdgeWorld(frame, EDGE_BY_KIND[kind]!), movesEntity: false,
      gripKind: { on: 'image', kind },
    });
  });
  return grips;
}

/**
 * Καθαρός μετασχηματισμός — το params patch ενός grip drag εικόνας (το SSoT που τρέχουν ΚΑΙ
 * το commit ΚΑΙ το live ghost → preview ≡ commit εξ ορισμού). `gripWorldPos` = η θέση της
 * λαβής στο mousedown· `delta` = η μετατόπιση του κέρσορα.
 *   - move     → μεταφορά όλης της εικόνας (`position += delta`).
 *   - rotation → swept angle· hot-grip (επιλεγμένο κέντρο) → orbit (position + rotation),
 *                αλλιώς περιστροφή γύρω από το ίδιο το `position` → μόνο `rotation`.
 *   - corner   → resize με την ΑΝΤΙΘΕΤΗ γωνία σταθερή (`applyRectCornerDrag`) → νέο
 *                `position`/`width`/`height`.
 *
 * ΛΟΓΟΣ ΠΛΕΥΡΩΝ (Giorgio 2026-07-14, Figma/Illustrator/PowerPoint parity): η γωνιακή λαβή
 * **ΚΛΕΙΔΩΝΕΙ** τον λόγο πλευρών (uniform scale — καμία παραμόρφωση, κανένα letterbox μέσα
 * στο πλαίσιο). Το **Shift τον ελευθερώνει** για ελεύθερο stretch. Το `shiftHeld` το περνούν
 * ΚΑΙ οι δύο caller (commit + live ghost) διαβάζοντας το ΙΔΙΟ `ShiftKeyTracker` SSoT, οπότε
 * preview ≡ commit· η fn μένει ΚΑΘΑΡΗ (μηδέν DOM/store deps → testable ως γεωμετρία).
 */
export function applyImageGripDrag(
  kind: ImageGripKind,
  entity: ImageEntity,
  gripWorldPos: Point2D,
  delta: Point2D,
  rotate?: { readonly pivot: Point2D; readonly anchor: Point2D },
  shiftHeld?: boolean,
): Partial<ImageEntity> {
  if (kind === IMAGE_MOVE_KIND) {
    return { position: translatePoint(entity.position, delta) };
  }
  if (kind === IMAGE_ROTATION_KIND) {
    const patch = rotateEntityGripDragDeg(
      { position: entity.position, rotationDeg: entity.rotation ?? 0 },
      gripWorldPos, delta, rotate,
    );
    return {
      ...(patch.position ? { position: patch.position } : {}),
      ...(patch.rotationDeg !== undefined ? { rotation: patch.rotationDeg } : {}),
    };
  }
  const edge = EDGE_BY_KIND[kind];
  if (edge) {
    // Μεσοπλευρική: 1-άξονα stretch με την ΑΝΤΙΘΕΤΗ ακμή σταθερή (κοινός `rect-grip-engine`).
    // Καμία aspect-lock — η μεσοπλευρική λαβή είναι εξ ορισμού μη-ομοιόμορφη (Figma/Illustrator
    // edge handle: τεντώνει ΜΟΝΟ πλάτος Ή ΜΟΝΟ ύψος). Δεν δεσμεύεται σε άξονα από το F8.
    const nextEdge = applyRectEdgeDrag(
      imageRectFrame(entity),
      edge,
      delta,
      { minHalfWidth: MIN_HALF, minHalfLength: MIN_HALF },
    );
    return frameToImageParams(nextEdge);
  }
  const corner = CORNER_BY_KIND[kind];
  if (!corner) return {};
  const next = applyRectCornerDrag(
    imageRectFrame(entity),
    corner,
    delta,
    { minHalfWidth: MIN_HALF, minHalfLength: MIN_HALF },
    undefined,          // ortho: η εικόνα δεν δεσμεύεται σε άξονα από το F8
    !shiftHeld,         // lockAspect: κλειδωμένος λόγος πλευρών ΕΚΤΟΣ αν κρατιέται Shift
  );
  return frameToImageParams(next);
}
