/**
 * ADR-524 — «Πολλαπλή πλήρωση όμοιων πλαισίων» κοινός suggest hook.
 *
 * Εκθέτει `suggestBatchFillAt(point)` — καλείται μετά από ΚΑΘΕ τοποθέτηση κολόνας/
 * τοιχίου σε πλαίσιο, ανεξάρτητα από το path:
 *   - «Κολώνα σε περιοχή» / 1 κλικ μέσα (`use-column-region-clicks`, regionMethod='inside')
 *   - freehand «Υιοθέτηση μεγέθους ορθογωνίου» (ADR-398 §3.17, `use-column-rect-adopt`)
 *
 * Βρίσκει το πλαίσιο γύρω από το `point` (οι γραμμές υπάρχουν ακόμη), υπολογίζει το
 * resolved χρώμα του, σαρώνει την κάτοψη για όμοια αγέμιστα πλαίσια και — αν βρει —
 * ανοίγει confirm dialog. «Ναι» → batch δημιουργία. Το πλαίσιο που μόλις γέμισε
 * εξαιρείται ΑΥΤΟΜΑΤΑ (η νέα κολόνα είναι ήδη στη scene → idempotency).
 *
 * PURE λογική στο `bim/columns/column-batch-fill.ts`· εδώ μένει μόνο η συλλογή
 * context (entities/layers/units) + το async confirm handshake.
 *
 * @see ../../bim/columns/column-batch-fill.ts (pure orchestrator)
 * @see ../../bim/columns/column-batch-fill-confirm-store.ts
 * @see docs/centralized-systems/reference/adrs/ADR-524-column-batch-fill-same-color-frames.md
 */

import { useCallback, type MutableRefObject } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { ColumnEntity } from '../../bim/types/column-types';
import {
  extractLineSegments,
  findEnclosingRectangle,
} from '../../bim/walls/wall-in-region';
import { buildColumnsFromRects, splitColumnsByIntent } from '../../bim/columns/column-from-faces';
import { appendColumnsWithBreakdown } from '../../bim/columns/append-columns-with-breakdown';
import { scanSameColorUnfilledRects } from '../../bim/columns/column-batch-fill';
import { requestColumnBatchFillConfirm } from '../../bim/columns/column-batch-fill-confirm-store';
import { resolveEntityColorHex } from '../../systems/selection/select-similar-by-color';
import { getLayersById } from '../../stores/LayerStore';
import { resolveRegionLoopTolWorld } from '../../bim/walls/region-tolerance';
import type { SceneUnits } from './column-completion';

export interface ColumnBatchFillSuggestParams {
  /** ADR-524 — batch appender (ΕΝΑΣ adapter για όλες τις κολόνες· βλ. add-column-to-scene). */
  readonly appendColumnsRef: MutableRefObject<(entities: readonly ColumnEntity[]) => void>;
  readonly getSceneEntitiesRef: MutableRefObject<(() => readonly Entity[]) | undefined>;
  readonly getSceneUnitsRef: MutableRefObject<(() => SceneUnits) | undefined>;
  readonly currentLevelId: string;
}

export interface ColumnBatchFillSuggestApi {
  /** Μετά από τοποθέτηση σε πλαίσιο γύρω από `point`: πρότεινε πλήρωση όμοιων πλαισίων. */
  suggestBatchFillAt(point: Readonly<Point2D>): void;
}

export function useColumnBatchFillSuggest(
  params: ColumnBatchFillSuggestParams,
): ColumnBatchFillSuggestApi {
  const { appendColumnsRef, getSceneEntitiesRef, getSceneUnitsRef, currentLevelId } = params;

  const suggestBatchFillAt = useCallback(
    (point: Readonly<Point2D>): void => {
      const entities = getSceneEntitiesRef.current?.() ?? [];
      const sceneUnits = getSceneUnitsRef.current?.() ?? 'mm';
      const tol = resolveRegionLoopTolWorld(sceneUnits);
      const segs = extractLineSegments(entities);
      // Το πλαίσιο γύρω από το σημείο που μόλις γέμισε (οι γραμμές υπάρχουν ακόμη).
      const placedRect = findEnclosingRectangle(segs, point, tol);
      if (!placedRect) return;

      const layersById = getLayersById();
      const colorOf = (e: Entity): string | null => resolveEntityColorHex(e, layersById);
      const { rects } = scanSameColorUnfilledRects(placedRect, segs, entities, tol, colorOf);
      if (rects.length === 0) return;

      const built = buildColumnsFromRects(rects, currentLevelId, sceneUnits);
      if (built.length === 0) return;

      const { primary, secondary } = splitColumnsByIntent(built, 'columns');
      void (async () => {
        const action = await requestColumnBatchFillConfirm({
          columnCount: primary.length,
          wallCount: secondary.length,
        });
        if (action === 'fill-all') {
          appendColumnsWithBreakdown(built, (all) => appendColumnsRef.current(all));
        }
      })();
    },
    [appendColumnsRef, getSceneEntitiesRef, getSceneUnitsRef, currentLevelId],
  );

  return { suggestBatchFillAt };
}
