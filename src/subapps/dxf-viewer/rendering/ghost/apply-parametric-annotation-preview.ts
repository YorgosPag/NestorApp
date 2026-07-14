/**
 * SSOT — apply-parametric-annotation-preview
 *
 * Live-ghost transform για τα flat-params entities του καμβά (graphic scale-bar, ADR-583 Φ2.4/Φ3·
 * opening-info-tag, ADR-612· raster image, ADR-654). Κανένα δεν αποθηκεύει `geometry` — το σχήμα
 * παράγεται στο render — άρα ένα grip drag είναι ένα flat-field params patch, δρομολογημένο μέσω
 * του ΙΔΙΟΥ `apply*GripDrag` SSoT που τρέχει και το commit → preview ≡ commit εξ ορισμού.
 * Όταν η λαβή περιστροφής σέρνεται γύρω από ΕΠΙΛΕΓΜΕΝΟ κέντρο (`rotatePivot`, από το hot-grip
 * flow) το ghost κάνει orbit ακριβώς όπως το commit· `anchorPos` == το `BimRotateHotGripStore.anchor`.
 *
 * Τα τρία entities διαφέρουν ΜΟΝΟ σε: tag, rotation kind, drag helper — άρα η ρουτίνα ζει ΜΙΑ
 * φορά ({@link parametricGhost}, N.18), mirror του `commitParametricAnnotationGripDrag` στο
 * commit path. Επιστρέφει `null` όταν το preview δεν αφορά κανένα από αυτά, ώστε ο caller να
 * πέσει στα υπόλοιπα branches του.
 *
 * Extracted from `apply-entity-preview.ts` (SOS N.7.1 — keep that file under 500 lines).
 */

import type { Point2D } from '../types/Types';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { EntityPreviewTransform } from './entity-preview-types';
import { gripKindOf, type GripKindByEntity } from '../../hooks/grip-kinds';
import { applyScaleBarGripDrag } from '../../bim/scale-bar/scale-bar-grips';
import type { ScaleBarEntity } from '../../types/scale-bar';
import { applyOpeningInfoTagGripDrag } from '../../bim/opening-info-tag/opening-info-tag-grips';
import type { OpeningInfoTagEntity } from '../../types/opening-info-tag';
import { applyImageGripDrag } from '../../bim/image/image-grips';
import type { ImageEntity } from '../../types/image';

/** Ο hot-grip κύκλος περιστροφής (επιλεγμένο κέντρο + άγκυρα στο mousedown). */
type RotateCtx = { readonly pivot: Point2D; readonly anchor: Point2D };

/**
 * Το ghost ενός flat-params entity: αν το preview κουβαλά grip kind ΑΥΤΟΥ του τύπου, τρέξε τον
 * κοινό pure transform και κόλλησε το patch πάνω στο entity. Αλλιώς `null` (δεν με αφορά).
 */
function parametricGhost<K extends keyof GripKindByEntity, E extends { position: Point2D }>(
  entity: DxfEntityUnion,
  preview: EntityPreviewTransform,
  on: K,
  rotationKind: GripKindByEntity[K],
  apply: (
    kind: GripKindByEntity[K],
    e: E,
    gripWorldPos: Point2D,
    delta: Point2D,
    rotate?: RotateCtx,
  ) => Partial<E>,
): DxfEntityUnion | null {
  const kind = gripKindOf(preview, on);
  if (!kind || entity.type !== on) return null;
  const { delta, anchorPos, rotatePivot } = preview;
  const target = entity as unknown as E;
  const rotate: RotateCtx | undefined =
    kind === rotationKind && rotatePivot && anchorPos
      ? { pivot: rotatePivot, anchor: anchorPos }
      : undefined;
  const patch = apply(kind, target, anchorPos ?? target.position, delta, rotate);
  return { ...(entity as object), ...patch } as unknown as DxfEntityUnion;
}

export function applyParametricAnnotationPreview(
  entity: DxfEntityUnion,
  preview: EntityPreviewTransform,
): DxfEntityUnion | null {
  return (
    // ── ADR-583 Φ2.4 / Φ3 — graphic scale-bar (move / rotation / length) ──
    parametricGhost<'scale-bar', ScaleBarEntity>(
      entity, preview, 'scale-bar', 'scale-bar-rotation', applyScaleBarGripDrag,
    ) ??
    // ── ADR-612 — opening-info-tag (move / rotation / size) ──
    parametricGhost<'opening-info-tag', OpeningInfoTagEntity>(
      entity, preview, 'opening-info-tag', 'opening-info-tag-rotation', applyOpeningInfoTagGripDrag,
    ) ??
    // ── ADR-654 — raster image (move / rotation / 4 corner resize) ──
    parametricGhost<'image', ImageEntity>(
      entity, preview, 'image', 'image-rotation', applyImageGripDrag,
    )
  );
}
