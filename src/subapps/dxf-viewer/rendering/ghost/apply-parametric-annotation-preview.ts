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
import { applyTableGripDrag } from '../../bim/table/table-entity-grips';
import type { TableEntity } from '../../types/table-entity';
// 🔴 Giorgio 2026-08-04 — η ζωντανή ένδειξη μεγέθους («Πλάτος: 14,14 (104 pixel)»).
import { tableResizeReadoutForModels } from '../../bim/table/table-resize-readout';
import { showTableResizeReadout } from '../../state/table-resize-readout-store';
import { applyImageGripDrag } from '../../bim/image/image-grips';
import type { ImageEntity } from '../../types/image';
import { ShiftKeyTracker } from '../../keyboard/ShiftKeyTracker';
import { activeTableModel } from '../../bim/table/table-worksheet-resolve';

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
    shiftHeld?: boolean,
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
  // ADR-654 — ο ΙΔΙΟΣ ζωντανός Shift που διαβάζει και το commit
  // (`commitParametricAnnotationGripDrag`). Ίδιο input → ίδιο patch → preview ≡ commit:
  // το φάντασμα δείχνει ΑΚΡΙΒΩΣ ό,τι θα γραφτεί (κλειδωμένος ή ελεύθερος λόγος πλευρών).
  const patch = apply(kind, target, anchorPos ?? target.position, delta, rotate, ShiftKeyTracker.getSnapshot());
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
    // ── ADR-739 Φ.Γ — γενικός πίνακας (move / rotation / όριο στήλης) ──
    // Το ίδιο μοτίβο με τα τρία αδέλφια: η διάταξη είναι ΠΑΡΑΓΩΓΗ, άρα ένα σύρσιμο λαβής
    // είναι patch παραμέτρων και το φάντασμα ξαναϋπολογίζει. Χωρίς αυτό, το σύρσιμο ορίου
    // στήλης δεν θα έδειχνε **τίποτα** μέχρι το commit — ακριβώς η ασυμμετρία που ο ADR-662
    // §13 έκλεισε για την τοπογραφική επιφάνεια όταν εκείνη απέκτησε λαβές.
    tableGhostWithReadout(entity, preview) ??
    // ── ADR-654 — raster image (move / rotation / 4 corner resize) ──
    parametricGhost<'image', ImageEntity>(
      entity, preview, 'image', 'image-rotation', applyImageGripDrag,
    )
  );
}

/**
 * 🔴 Το φάντασμα του πίνακα **και** η ένδειξη μεγέθους, στην ίδια αναπνοή.
 *
 * ## Γιατί η ένδειξη γεννιέται ΕΔΩ και όχι στον χειριστή του ποντικιού
 * Ο χειριστής της λαβής (`grip-mouse-move-handler`) έχει `worldPos` και `activeGrip`, αλλά
 * **δεν έχει την οντότητα** — θα έπρεπε να ψάξει τη σκηνή με το `entityId` και μετά να
 * ξαναϋπολογίσει μόνος του το νέο μέγεθος από το `delta`. Δηλαδή τρίτο αντίγραφο της ίδιας
 * αριθμητικής, που θα απέκλινε στο φράγμα ελάχιστου μεγέθους.
 *
 * Εδώ υπάρχουν και τα δύο μοντέλα — πριν και μετά — άρα η ένδειξη **διαβάζει** το νούμερο
 * που μόλις γράφτηκε: ό,τι δείχνει το φάντασμα δείχνει και η πινακίδα, χωρίς εγγύηση προς
 * συντήρηση. Το φάντασμα τρέχει ήδη σε κάθε καρέ της σύρσης, οπότε δεν προστίθεται πέρασμα.
 *
 * ⚠️ **Καμία απόκρυψη εδώ**: το φάντασμα δεν ξέρει πότε τελειώνει η σύρση (απλώς παύει να
 * καλείται). Το σβήσιμο ζει στο `mouseup` του grip engine και στο commit της χειρονομίας
 * λωρίδας — δηλαδή στα δύο σημεία που **ξέρουν** ότι η χειρονομία τελείωσε.
 */
function tableGhostWithReadout(
  entity: DxfEntityUnion,
  preview: EntityPreviewTransform,
): DxfEntityUnion | null {
  const ghost = parametricGhost<'table', TableEntity>(
    entity, preview, 'table', 'table-rotation', applyTableGripDrag,
  );
  if (!ghost) return null;

  const readout = tableResizeReadoutForModels(
    entity as TableEntity,
    // ADR-833 Φάση 2 — το μοντέλο του **ενεργού φύλλου** του φαντάσματος: η σύρση μεγέθους
    // αλλάζει το φύλλο που βλέπει ο χρήστης, και η ένδειξη διαβάζει ό,τι ακριβώς γράφτηκε.
    activeTableModel(ghost as TableEntity),
  );
  if (readout) showTableResizeReadout(readout);
  return ghost;
}
