'use client';

/**
 * 🔴 ADR-739 §66 — **ΟΙ ΓΡΑΦΕΙΣ ΣΚΗΝΗΣ ΤΟΥ ΠΙΝΑΚΑ**, σε ένα μέρος: ζωντανή προεπισκόπηση
 * (χωρίς ιστορικό) και μετακίνηση της οντότητας (μία εντολή).
 *
 * ## Γιατί εξήχθη — και γιατί ως **patch**, όχι ως δεύτερη «preview μοντέλου»
 * Η προεπισκόπηση ζούσε ως ιδιωτικό `useCallback` στο `useTableCellDoubleClickEditor` όσο ο
 * μόνος καταναλωτής της ήταν η σύρση μεγέθους, που γράφει **μοντέλο**. Με τη μετακίνηση (§66)
 * ήρθε δεύτερος καταναλωτής που γράφει **θέση** — και η προφανής κίνηση, ένα δεύτερο
 * `previewTablePosition` δίπλα στο `previewTableModel`, θα ήταν sibling clone με ταυτόσημο
 * σώμα (CHECK 3.28 / N.18): ίδια ανάγνωση ορόφου, ίδιο `map` οντοτήτων, ίδιο `setLevelScene`,
 * με **μία** λέξη διαφορά στο τι μπαλώνεται.
 *
 * Το σοβαρό δεν είναι οι γραμμές: θα ήταν **δύο σημεία** που πρέπει να θυμούνται τον ίδιο
 * κανόνα («νέο αντικείμενο οντότητας ⇒ οι απομνημονεύσεις της διάταξης ακυρώνονται μόνες
 * τους»), και η τρίτη χειρονομία που θα ήθελε προεπισκόπηση θα γεννούσε το τρίτο. Το
 * `Partial<TableEntity>` λέει ακριβώς αυτό που συμβαίνει: *«αυτά τα πεδία, πάνω σε αυτή την
 * οντότητα, τώρα, χωρίς ιστορικό»*.
 *
 * ## 🔑 Η διαφορά από το {@link useTableModelCommit} — και γιατί ΔΕΝ ενοποιήθηκαν
 * Εκείνο είναι η **μία διαδρομή commit του μοντέλου** και κουβαλά δύο πράγματα που ανήκουν
 * αποκλειστικά στο μοντέλο: τον φύλακα ταυτότητας `nextModel === entity.model` (εγγύηση των
 * καθαρών πράξεων του §6.6) και το σβήσιμο των μυρμηγκιών του προχείρου (§48). Η **θέση** δεν
 * έχει καμία από τις δύο σημασίες: μια μετακίνηση δεν ακυρώνει πρόχειρο, και η ισότητα
 * σημείων είναι σύγκριση **τιμής**, όχι αναφοράς. Ένα κοινό «commit οτιδήποτε» θα έπρεπε να
 * μάθει και τις δύο εξαιρέσεις — δηλαδή θα ήταν ένα σώμα με δύο συμπεριφορές κρυμμένες σε
 * `if`, όχι SSoT.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/use-table-scene-writers
 * @see ui/table-cell-editor/use-table-model-commit.ts — η ΜΙΑ διαδρομή commit του μοντέλου
 * @see ui/table-cell-editor/table-move-drag.ts — ο καταναλωτής της θέσης (§66)
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §66
 */

import { useCallback, useMemo } from 'react';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { UpdateEntityCommand } from '../../core/commands/entity-commands/UpdateEntityCommand';
import type { TableEntity } from '../../types/table-entity';
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand } from '../../core/commands';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';

export interface UseTableSceneWritersParams {
  readonly levelManager: LevelManagerLike;
  readonly execute: (command: ICommand) => void;
}

export interface TableSceneWriters {
  /** §31.9 — ζωντανή προεπισκόπηση **μοντέλου** (σύρση μεγέθους, λαβή συμπλήρωσης). */
  readonly previewModel: (entity: TableEntity, model: TableEntity['model']) => void;
  /** §66 — ζωντανή προεπισκόπηση **θέσης** (μετακίνηση από τη γωνία). */
  readonly previewPosition: (entity: TableEntity, position: Point2D) => void;
  /** §66 — η τελική θέση ως **μία** εντολή αναίρεσης. */
  readonly commitPosition: (entity: TableEntity, position: Point2D) => void;
}

export function useTableSceneWriters(params: UseTableSceneWritersParams): TableSceneWriters {
  const { levelManager, execute } = params;

  /**
   * Ο ΕΝΑΣ γραφέας «χωρίς ιστορικό»: μπάλωμα πάνω στη ζωντανή οντότητα του ορόφου.
   *
   * Νέο αντικείμενο οντότητας ⇒ οι απομνημονεύσεις της διάταξης ακυρώνονται από μόνες τους
   * (η ταυτότητα ΕΙΝΑΙ η έκδοση, δες `resizeTableColumnLeftOfEdge`).
   */
  const previewPatch = useCallback(
    (entity: TableEntity, patch: Partial<TableEntity>): void => {
      const { currentLevelId, getLevelScene, setLevelScene } = levelManager;
      if (!currentLevelId || !setLevelScene) return;
      const scene = getLevelScene(currentLevelId);
      if (!scene) return;
      setLevelScene(currentLevelId, {
        ...scene,
        entities: scene.entities.map((e) => (e.id === entity.id ? { ...entity, ...patch } : e)),
      });
    },
    [levelManager],
  );

  const commitPosition = useCallback(
    (entity: TableEntity, position: Point2D): void => {
      const { currentLevelId, getLevelScene, setLevelScene } = levelManager;
      if (!currentLevelId || !setLevelScene) return;
      // Φύλακας «τίποτα δεν άλλαξε», σε **τιμή**: το κατώφλι της σύρσης το εγγυάται ήδη, αλλά
      // ένα βήμα αναίρεσης που δεν αναιρεί τίποτα είναι το είδος του σφάλματος που εμφανίζεται
      // μόνο σε οριακή χειρονομία και δεν αναπαράγεται ποτέ όταν το ψάχνεις (N.7.2 #4).
      if (position.x === entity.position.x && position.y === entity.position.y) return;
      const sceneManager = createLevelSceneManagerAdapter(getLevelScene, setLevelScene, currentLevelId);
      const command = new UpdateEntityCommand(entity.id, { position }, sceneManager, 'Move table');
      if (command.validate() !== null) return;
      execute(command);
    },
    [levelManager, execute],
  );

  return useMemo(
    (): TableSceneWriters => ({
      previewModel: (entity, model) => previewPatch(entity, { model }),
      previewPosition: (entity, position) => previewPatch(entity, { position }),
      commitPosition,
    }),
    [previewPatch, commitPosition],
  );
}
