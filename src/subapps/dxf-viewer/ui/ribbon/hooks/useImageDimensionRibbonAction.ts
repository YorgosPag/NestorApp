'use client';

/**
 * ADR-654 — Action interceptor για τις ΔΥΟ ενέργειες διαστάσεων του contextual tab «Εικόνα»:
 * «Επαναφορά Διαστάσεων» (`image-reset-size`) + «Κλείδωμα Αναλογιών» (`image-lock-aspect`).
 * Mirror του `useExplodeRibbonAction`: πιάνει τα δύο actions, resolve τις επιλεγμένες εικόνες, και
 * τις πατά με ΕΝΑ undoable βήμα (πολλές = `CompositeCommand`, atomic undo). Κάθε άλλο action → fallback.
 *
 * Big-player (Giorgio 2026-07-15): ΔΥΟ ξεχωριστά κουμπιά — «Επαναφορά Διαστάσεων» επαναφέρει το
 * ΑΠΟΛΥΤΟ αρχικό μέγεθος (PowerPoint «Reset Size»)· «Κλείδωμα Αναλογιών» κάνει un-deform κρατώντας
 * την κλίμακα (ArchiCAD «fit to proportions»). ΕΝΑΣ interceptor για τα δύο — ίδιο pipeline, αλλάζει
 * μόνο η pure patch fn (N.18: μηδέν δίδυμος hook).
 *
 * Η math ζει ΟΛΗ στο pure `reset-image-dimensions.ts` (κέντρο σταθερό, rotation ανέγγιχτη) — εδώ
 * μόνο το wiring: selection → (decode fallback αν χρειαστεί) → `UpdateEntityCommand`. Εικόνες με
 * `intrinsicWidth/Height` = σύγχρονο, μηδέν decode· legacy = async decode του `url` (SSoT
 * `decodeImageWithTimeout`, ήδη σε browser cache). Ο handler είναι async· fire-and-forget από το callback.
 *
 * @see ../../../bim/image/reset-image-dimensions.ts — pure geometry SSoT (και οι δύο ενέργειες)
 * @see ./useExplodeRibbonAction.ts — the interceptor pattern this mirrors
 * @see ../data/contextual-image-tab.ts — τα δύο κουμπιά (actions image-reset-size / image-lock-aspect)
 */

import React from 'react';
import type { RibbonActionPayload } from '../context/RibbonCommandContext';
import { useCommandHistory } from '../../../core/commands';
import { UpdateEntityCommand } from '../../../core/commands/entity-commands/UpdateEntityCommand';
import { CompositeCommand } from '../../../core/commands/CompositeCommand';
import type { ICommand } from '../../../core/commands/interfaces';
import { createLevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import {
  resetImageToOriginalSize,
  lockImageAspect,
  hasStoredIntrinsicSize,
  type DecodedPixelSize,
  type ImageResetPatch,
} from '../../../bim/image/reset-image-dimensions';
import { imageIntrinsicSize } from '../../../rendering/entities/shared/image-intrinsic-size';
import { decodeImageWithTimeout } from '../../../export/core/image-export-shared';
import { isImageEntity, type ImageEntity } from '../../../types/image';
import type { LevelSceneWriter } from '../../../systems/levels/level-scene-accessor';
import type { useUniversalSelection } from '../../../systems/selection';

/** Action keys (SSoT — ίδια strings στο `contextual-image-tab.ts`). */
export const IMAGE_RESET_SIZE_ACTION = 'image-reset-size';
export const IMAGE_LOCK_ASPECT_ACTION = 'image-lock-aspect';

/** Ανά action: η pure patch fn + το label του undoable command. */
const HANDLERS: Readonly<
  Record<string, { readonly patch: (e: ImageEntity, d?: DecodedPixelSize | null) => ImageResetPatch | null; readonly label: string }>
> = {
  [IMAGE_RESET_SIZE_ACTION]: { patch: resetImageToOriginalSize, label: 'Reset image size' },
  [IMAGE_LOCK_ASPECT_ACTION]: { patch: lockImageAspect, label: 'Lock image aspect' },
};

type UniversalSelectionLike = Pick<
  ReturnType<typeof useUniversalSelection>,
  'getSelectedEntityIds'
>;

export interface UseImageDimensionRibbonActionProps {
  readonly levelManager: LevelSceneWriter;
  readonly universalSelection: UniversalSelectionLike;
  /** Fall-through for non-image-dimension actions. */
  readonly fallback: (action: string, data?: RibbonActionPayload) => void;
}

/** Decode του `url` → pixel μέγεθος (naturalWidth/Height) για τον aspect υπολογισμό· `null` σε αποτυχία. */
async function decodeToPixelSize(url: string): Promise<DecodedPixelSize | null> {
  const img = await decodeImageWithTimeout(url);
  if (!img) return null;
  const { w, h } = imageIntrinsicSize(img);
  return { w, h };
}

export function useImageDimensionRibbonAction(
  props: UseImageDimensionRibbonActionProps,
): (action: string, data?: RibbonActionPayload) => void {
  const { levelManager, universalSelection, fallback } = props;
  const { execute: executeCommand } = useCommandHistory();

  return React.useCallback(
    (action: string, data?: RibbonActionPayload) => {
      const handler = HANDLERS[action];
      if (!handler) {
        fallback(action, data);
        return;
      }

      const levelId = levelManager.currentLevelId;
      const scene = levelId ? levelManager.getLevelScene(levelId) : null;
      if (!levelId || !scene) return;

      // Οι επιλεγμένες εικόνες (μόνο `type:'image'` — τα κουμπιά ζουν σε per-image contextual tab).
      const selectedIds = new Set(universalSelection.getSelectedEntityIds());
      const images = scene.entities.filter(
        (e): e is ImageEntity => selectedIds.has(e.id) && isImageEntity(e),
      );
      if (images.length === 0) return;

      void (async () => {
        // decode ΜΟΝΟ όσες εικόνες δεν κρατούν intrinsic (intrinsic → μηδέν δίκτυο).
        const patches = await Promise.all(
          images.map(async (image) => {
            const decoded = hasStoredIntrinsicSize(image) ? null : await decodeToPixelSize(image.url);
            const patch = handler.patch(image, decoded);
            return patch ? { id: image.id, patch } : null;
          }),
        );

        const commands: ICommand[] = [];
        const sm = createLevelSceneManagerAdapter(
          levelManager.getLevelScene,
          levelManager.setLevelScene,
          levelId,
        );
        for (const entry of patches) {
          if (!entry) continue; // null = no-op (ήδη σωστό) ή αποτυχία decode: παράλειψη.
          commands.push(new UpdateEntityCommand(entry.id, entry.patch, sm, handler.label));
        }
        if (commands.length === 0) return; // όλες ήδη στο σωστό μέγεθος → τίποτα να αναιρέσει.

        // ΕΝΑ atomic undo: πολλές εικόνες → CompositeCommand, μία → σκέτο command.
        executeCommand(commands.length === 1 ? commands[0] : new CompositeCommand(commands));
      })();
    },
    [levelManager, universalSelection, fallback, executeCommand],
  );
}
