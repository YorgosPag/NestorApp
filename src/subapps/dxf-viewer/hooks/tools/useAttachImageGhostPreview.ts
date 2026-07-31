'use client';

/**
 * ADR-736 §6 / ADR-624 — Το WYSIWYG ghost της εντολής «Εικόνα» (`attach-image`).
 *
 * 🔴 **Γιατί γράφτηκε, ενώ το tool είχε ήδη `getGhostFootprint`:** το είχε και **κανείς δεν το
 * ζωγράφιζε**. Οι 7 υπάρχοντες ghost mounts καλύπτουν την οικογένεια των BIM single-click
 * εργαλείων· οι 4 entourage οικογένειες (έπιπλα/άνθρωποι/οχήματα/φυτά) τοποθετούν **στα τυφλά**
 * μέχρι σήμερα — η `computeFootprint` τους υπολογίζεται και πετιέται. Ένα getter χωρίς mount
 * δεν είναι ghost· είναι νεκρός κώδικας που *μοιάζει* με χαρακτηριστικό.
 *
 * Thin binding του Level-1 primitive (`useWysiwygPlacementGhost`) και **όχι** του bridge-store
 * factory: αυτή η οικογένεια δεν έχει tool-bridge store — το «ποια εικόνα» ζει στο
 * `attachedImageSelection` (ADR-654 M6 ιδίωμα). Το entity το χτίζει ο **ΙΔΙΟΣ** `buildGhost` του
 * commit placer, άρα το φάντασμα είναι κατά ταυτότητα ό,τι θα καρφωθεί.
 *
 * `useImmediateSnap: false` — free-point τοποθέτηση: το commit διαβάζει τον **RAW** worldPoint
 * (βλ. `canvas-click-bim-dispatch`, PRIORITY 4.915f), οπότε ένα snapped ghost θα κουνιόταν σε
 * άλλο σημείο από αυτό που τελικά καρφώνεται, και θα lag-άριζε στα ~30fps του snap.
 *
 * @see ./use-wysiwyg-placement-ghost.ts — το primitive (build → paint πάνω στο RAF harness)
 * @see ../../bim/image/attached-image-placement.ts — store + placer (η μία πηγή του μεγέθους)
 */

import type { Entity } from '../../rendering/types/Types';
import type { LevelSceneReader } from '../../systems/levels/level-scene-accessor';
import { resolveSceneUnits } from '../../utils/scene-units';
import {
  attachedImageSelection,
  attachedImagePlacer,
} from '../../bim/image/attached-image-placement';
import { useWysiwygPlacementGhost } from './use-wysiwyg-placement-ghost';

export interface AttachImageGhostPreviewProps {
  /** Το εργαλείο περιμένει θέση — μόνο τότε ζωγραφίζεται φάντασμα. */
  readonly isAwaitingPosition: boolean;
  /** Οι μονάδες της σκηνής βγαίνουν από το ενεργό level — ΙΔΙΑ πηγή με το commit. */
  readonly levelManager: LevelSceneReader;
  getCanvas(): HTMLCanvasElement | null;
  getViewportElement?(): HTMLElement | null;
}

export function useAttachImageGhostPreview(props: AttachImageGhostPreviewProps): void {
  const { isAwaitingPosition, levelManager, getCanvas, getViewportElement } = props;

  useWysiwygPlacementGhost({
    isActive: isAwaitingPosition,
    getCanvas,
    getViewportElement,
    useImmediateSnap: false,
    buildGhostEntity: (frame): Entity | null => {
      if (!frame.effectiveCursor) return null;
      // Event-time read (ADR-040): η επιλογή αλλάζει χωρίς React re-render, και το ghost
      // τρέχει ανά frame — ποτέ snapshot από κλείσιμο.
      const selection = attachedImageSelection.get();
      if (!selection) return null;
      const levelId = levelManager.currentLevelId;
      const ghost = attachedImagePlacer.buildGhost({
        position: frame.effectiveCursor,
        itemId: selection.id,
        url: selection.url,
        sceneUnits: levelId ? resolveSceneUnits(levelManager.getLevelScene(levelId)) : 'mm',
      });
      return ghost as unknown as Entity | null;
    },
    // Κενά: ο builder διαβάζει ΟΛΑ όσα χρειάζεται φρέσκα στο call time (store + level).
    drawDeps: [],
  });
}
