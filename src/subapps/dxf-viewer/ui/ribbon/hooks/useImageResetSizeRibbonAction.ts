'use client';

/**
 * ADR-654 — Action interceptor για το «Επαναφορά Διαστάσεων» (`image-reset-size`) κουμπί του
 * contextual tab «Εικόνα». Mirror του `useExplodeRibbonAction`: πιάνει το ένα action, resolve
 * τις επιλεγμένες εικόνες, και τις επαναφέρει στο εργοστασιακό τους μέγεθος/αναλογία με ΕΝΑ
 * undoable βήμα (πολλές = `CompositeCommand`, atomic undo). Κάθε άλλο action πέφτει στο fallback.
 *
 * Big-player (PowerPoint «Reset Size» / ArchiCAD «fit to original proportions»): ο χρήστης μπορεί
 * αθελά του να παραμορφώσει ένα entourage sprite με τις μεσοπλευρικές λαβές· αυτό το «ξεκουμπώνει».
 * Η math ζει ΟΛΗ στο pure `resetImageDimensions` (κέντρο σταθερό, rotation ανέγγιχτη) — εδώ μόνο
 * το wiring: selection → (decode fallback αν χρειαστεί) → `UpdateEntityCommand`.
 *
 * Δρόμος A (νέες εικόνες): έχουν `intrinsicWidth/Height` → σύγχρονο, μηδέν decode. Δρόμος C fallback
 * (legacy/μη-entourage): async decode του `url` (SSoT `decodeImageWithTimeout`, ήδη σε browser cache)
 * → pixel-aspect → un-deform. Ο handler είναι async· το ribbon action callback το τρέχει fire-and-forget.
 *
 * @see ../../../bim/image/reset-image-dimensions.ts — pure geometry SSoT (A + C fallback)
 * @see ./useExplodeRibbonAction.ts — the interceptor pattern this mirrors
 * @see ../data/contextual-image-tab.ts — το κουμπί (action:'image-reset-size')
 */

import React from 'react';
import type { RibbonActionPayload } from '../context/RibbonCommandContext';
import { useCommandHistory } from '../../../core/commands';
import { UpdateEntityCommand } from '../../../core/commands/entity-commands/UpdateEntityCommand';
import { CompositeCommand } from '../../../core/commands/CompositeCommand';
import type { ICommand } from '../../../core/commands/interfaces';
import { createLevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import {
  resetImageDimensions,
  hasStoredIntrinsicSize,
  type DecodedPixelSize,
} from '../../../bim/image/reset-image-dimensions';
import { imageIntrinsicSize } from '../../../rendering/entities/shared/image-intrinsic-size';
import { decodeImageWithTimeout } from '../../../export/core/image-export-shared';
import { isImageEntity, type ImageEntity } from '../../../types/image';
import type { LevelSceneWriter } from '../../../systems/levels/level-scene-accessor';
import type { useUniversalSelection } from '../../../systems/selection';

/** Το action key του κουμπιού (SSoT — ίδιο string στο `contextual-image-tab.ts`). */
export const IMAGE_RESET_SIZE_ACTION = 'image-reset-size';

type UniversalSelectionLike = Pick<
  ReturnType<typeof useUniversalSelection>,
  'getSelectedEntityIds'
>;

export interface UseImageResetSizeRibbonActionProps {
  readonly levelManager: LevelSceneWriter;
  readonly universalSelection: UniversalSelectionLike;
  /** Fall-through for non-reset actions. */
  readonly fallback: (action: string, data?: RibbonActionPayload) => void;
}

/** Decode του `url` → pixel μέγεθος (naturalWidth/Height) για τον aspect fallback· `null` σε αποτυχία. */
async function decodeToPixelSize(url: string): Promise<DecodedPixelSize | null> {
  const img = await decodeImageWithTimeout(url);
  if (!img) return null;
  const { w, h } = imageIntrinsicSize(img);
  return { w, h };
}

export function useImageResetSizeRibbonAction(
  props: UseImageResetSizeRibbonActionProps,
): (action: string, data?: RibbonActionPayload) => void {
  const { levelManager, universalSelection, fallback } = props;
  const { execute: executeCommand } = useCommandHistory();

  return React.useCallback(
    (action: string, data?: RibbonActionPayload) => {
      if (action !== IMAGE_RESET_SIZE_ACTION) {
        fallback(action, data);
        return;
      }

      const levelId = levelManager.currentLevelId;
      const scene = levelId ? levelManager.getLevelScene(levelId) : null;
      if (!levelId || !scene) return;

      // Οι επιλεγμένες εικόνες (μόνο `type:'image'` — το κουμπί ζει σε per-image contextual tab).
      const selectedIds = new Set(universalSelection.getSelectedEntityIds());
      const images = scene.entities.filter(
        (e): e is ImageEntity => selectedIds.has(e.id) && isImageEntity(e),
      );
      if (images.length === 0) return;

      void (async () => {
        // Δρόμος C fallback: decode ΜΟΝΟ όσες εικόνες δεν κρατούν intrinsic (Δρόμος A → μηδέν δίκτυο).
        const patches = await Promise.all(
          images.map(async (image) => {
            const decoded = hasStoredIntrinsicSize(image) ? null : await decodeToPixelSize(image.url);
            const patch = resetImageDimensions(image, decoded);
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
          if (!entry) continue; // παραμορφωμένη ⇒ null (no-op ή αποτυχία decode): παράλειψη.
          commands.push(new UpdateEntityCommand(entry.id, entry.patch, sm, 'Reset image size'));
        }
        if (commands.length === 0) return; // όλες ήδη στο σωστό μέγεθος → τίποτα να αναιρέσει.

        // ΕΝΑ atomic undo: πολλές εικόνες → CompositeCommand, μία → σκέτο command.
        executeCommand(commands.length === 1 ? commands[0] : new CompositeCommand(commands));
      })();
    },
    [levelManager, universalSelection, fallback, executeCommand],
  );
}
