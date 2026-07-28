/**
 * usePolylineClosureCommands — ADR-718 §Β: το «Κλείσιμο / Άνοιγμα πολυγραμμής» του
 * `EntityContextMenu` (AutoCAD `PEDIT` → Close / Open).
 *
 * Αδελφό του {@link useEntityLayerCommands}: ζει έξω από τον `CanvasSection` (N.7.1) και
 * γεννά **έτοιμα props** του μενού από την τρέχουσα επιλογή — καμία γεωμετρία εδώ, μόνο η
 * σύνδεση «τι επιτρέπει το `polyline-closure-ops`» → «τι δείχνει το μενού».
 *
 * **Μία γραμμή, όχι δύο.** Μια πολυγραμμή είναι είτε κλειστή είτε ανοιχτή, ποτέ και τα δύο·
 * το AutoCAD δείχνει *Close* σε ανοιχτή και *Open* σε κλειστή, ποτέ ζευγάρι με το ένα
 * απενεργοποιημένο. Ο τύπος το κωδικοποιεί (`action: 'close' | 'open'`) ώστε να μην μπορεί
 * να αναπαρασταθεί κατάσταση που δεν υπάρχει.
 *
 * @see systems/polyline/polyline-closure-ops — τα κατηγορήματα + ο builder (SSoT)
 * @see hooks/canvas/useEntityLayerCommands — το idiom που αντιγράφει η δομή
 */

import { useMemo } from 'react';
import type { Entity } from '../../types/entities';
import type { ICommand } from '../../core/commands/interfaces';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import {
  buildPolylineClosureCommand,
  canClosePolyline,
  canOpenPolyline,
} from '../../systems/polyline/polyline-closure-ops';

type LevelManagerLike = Pick<LevelSceneWriter, 'currentLevelId' | 'getLevelScene' | 'setLevelScene'>;

/** Η μία διαθέσιμη πράξη κλεισίματος για την τρέχουσα επιλογή — ή `undefined` (καμία). */
export interface PolylineClosureMenuProps {
  readonly polylineClosure?: {
    readonly action: 'close' | 'open';
    readonly run: () => void;
  };
}

export function usePolylineClosureCommands(
  selectedEntityIds: readonly string[],
  entities: readonly Entity[] | undefined,
  levelManager: LevelManagerLike,
  executeCommand: (cmd: ICommand) => void,
): PolylineClosureMenuProps {
  return useMemo<PolylineClosureMenuProps>(() => {
    // Εντολή μίας οντότητας (AutoCAD PEDIT): σε πολλαπλή επιλογή δεν προσφέρεται — «κλείσε τα
    // όλα» θα ήταν άλλη εντολή, με άλλο undo, και δεν την ζήτησε κανείς.
    if (selectedEntityIds.length !== 1) return {};
    const entityId = selectedEntityIds[0];
    const entity = entities?.find((e) => e.id === entityId);
    const action: 'close' | 'open' | null = canClosePolyline(entity)
      ? 'close'
      : canOpenPolyline(entity)
        ? 'open'
        : null;
    if (!action) return {};

    return {
      polylineClosure: {
        action,
        run: () => {
          const levelId = levelManager.currentLevelId;
          if (!levelId) return;
          const adapter = createLevelSceneManagerAdapter(
            levelManager.getLevelScene,
            levelManager.setLevelScene,
            levelId,
          );
          const cmd = buildPolylineClosureCommand(entityId, { kind: action }, adapter);
          if (cmd) executeCommand(cmd);
        },
      },
    };
  }, [selectedEntityIds, entities, levelManager, executeCommand]);
}
