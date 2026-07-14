'use client';

/**
 * ADR-654 — live «Ιδιότητες» panel sync during an entourage IMAGE move / resize / rotate drag.
 *
 * Pure DATA-SYNC leaf (NO canvas / NO RAF), mirror του `useTextGripRibbonSync` (ADR-557): ενώ ο
 * χρήστης σέρνει μια λαβή (ή το σώμα) της εικόνας, διαβάζει το live `dragPreview`, τρέχει το ΙΔΙΟ
 * `applyImageGripDrag` SSoT που τρέχει ΚΑΙ το commit ΚΑΙ το ghost (preview ≡ commit — zero re-derived
 * math), και δημοσιεύει το προκύπτον `Partial<ImageEntity>` patch στο `EntityPropsLivePreviewStore`,
 * ώστε το αριστερό object inspector (Θέση/Πλάτος/Ύψος/Περιστροφή) να ακολουθεί το drag frame-for-frame.
 *
 * SSoT reuse (zero new mechanism):
 *   - Live math   → `applyImageGripDrag` (bim/image/image-grips) — ΤΟ commit's transform.
 *   - shiftHeld   → `ShiftKeyTracker` (ίδιο SSoT με το commit/ghost) ⇒ aspect-lock parity.
 *   - Channel     → `setEntityPropsLivePreview` (panel-side preview channel· ΚΑΝΕΝΑ command/undo).
 *
 * On release (`dragPreview` → null / μη-image) καθαρίζει το κανάλι, οπότε το panel ξαναδιαβάζει τα
 * committed values από το `currentScene` (που πλέον φέρει το τελικό commit ή το reverted original).
 *
 * @see systems/grip/EntityPropsLivePreviewStore.ts — the panel-side preview channel
 * @see hooks/grips/useTextGripRibbonSync.ts — the sibling text-toolbar live-sync (ADR-557)
 */

import React, { useEffect, useRef } from 'react';
import type { DxfGripDragPreview } from '../grip-computation';
import type { LevelSceneReader } from '../../systems/levels/level-scene-accessor';
import type { ImageEntity } from '../../types/image';
import { applyImageGripDrag, IMAGE_MOVE_KIND } from '../../bim/image/image-grips';
import { gripKindOf } from '../grip-kinds';
import { ShiftKeyTracker } from '../../keyboard/ShiftKeyTracker';
import { setEntityPropsLivePreview } from '../../systems/grip/EntityPropsLivePreviewStore';

export interface UseImagePropsGripSyncProps {
  /** Live grip-drag snapshot (per frame· null between drags). */
  readonly dragPreview: DxfGripDragPreview | null;
  readonly levelManager: LevelSceneReader;
}

export function useImagePropsGripSync(props: UseImagePropsGripSyncProps): void {
  const { dragPreview, levelManager } = props;
  // Redundant-write guard: skip publish when the mapped patch is unchanged from last frame
  // (axis-locked / sub-pixel moves) — avoids panel re-render churn at drag frequency.
  const lastRef = useRef<string | null>(null);
  // True once this drag has published at least one live patch — gates the release clear so we
  // only reset after a real image preview, not on idle renders.
  const wasPreviewingRef = useRef(false);

  useEffect(() => {
    const clear = (): void => {
      lastRef.current = null;
      if (wasPreviewingRef.current) {
        wasPreviewingRef.current = false;
        setEntityPropsLivePreview(null);
      }
    };
    if (!dragPreview) {
      clear();
      return;
    }
    const { currentLevelId } = levelManager;
    if (!currentLevelId) return;
    const raw = levelManager
      .getLevelScene(currentLevelId)
      ?.entities?.find((e) => e.id === dragPreview.entityId);
    if (!raw || raw.type !== 'image') {
      clear();
      return;
    }
    // Every image grip carries the `image-*` kind; a body-drag carries only `movesEntity` → treat
    // as a whole-entity move (identical `position += delta` semantics as the centre MOVE grip).
    const imageKind = gripKindOf(dragPreview, 'image');
    const kind = imageKind ?? (dragPreview.movesEntity ? IMAGE_MOVE_KIND : null);
    if (!kind) {
      clear();
      return;
    }
    const { delta, anchorPos, rotatePivot } = dragPreview;
    if (delta.x === 0 && delta.y === 0) return; // no movement yet — keep committed values

    const image = raw as unknown as ImageEntity;
    // Rotation hot-grip: {pivot, anchor} orbits the picked centre (mirror του ghost· preview ≡ commit).
    const rotate = anchorPos && rotatePivot ? { pivot: rotatePivot, anchor: anchorPos } : undefined;
    const patch = applyImageGripDrag(
      kind,
      image,
      anchorPos ?? image.position,
      delta,
      rotate,
      ShiftKeyTracker.getSnapshot(),
    );
    if (Object.keys(patch).length === 0) return;

    const serialized = JSON.stringify(patch);
    if (serialized === lastRef.current) return;
    lastRef.current = serialized;
    setEntityPropsLivePreview({ entityId: image.id, patch });
    wasPreviewingRef.current = true;
  }, [dragPreview, levelManager]);
}

/** Zero-JSX mount (ADR-040 micro-leaf) — runs the live image-props panel sync. */
export const ImagePropsGripSyncMount = React.memo(function ImagePropsGripSyncMount(
  props: UseImagePropsGripSyncProps,
) {
  useImagePropsGripSync(props);
  return null;
});
