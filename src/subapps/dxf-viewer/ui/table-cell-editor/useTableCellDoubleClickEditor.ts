'use client';

/**
 * ADR-739 Φάση Δ βήμα 2 — ο **οδηγός του δρομέα κελιού** στον 2D καμβά.
 *
 * Ήταν «ο ανοιχτήρας του διπλού κλικ»· τώρα είναι ο ένας τόπος που ξέρει **και** το
 * μοντέλο **και** το DOM, δηλαδή ο μόνος που μπορεί να απαντήσει στις τρεις ερωτήσεις του
 * επεξεργαστή: «τι γράφω;» (commit), «πού πάω;» (move), «τι κείμενο έχει το κελί;».
 *
 * Ό,τι **δεν** χρειάζεται και τα δύο, ζει αλλού και δεν το ξαναγράφουμε εδώ:
 *   - ΠΟΙΟ είναι το επόμενο κελί → `bim/table/table-cell-navigation.ts` (καθαρό)
 *   - ΠΩΣ γίνεται commit + ΠΟΥ αγκυρώνεται → `bim/table/table-cell-edit-session.ts`
 *   - ΠΟΙΑ είναι η κατάσταση του δρομέα → `state/table-cell-cursor-store.ts`
 *   - ΤΙ σημαίνει κάθε πλήκτρο → `ui/table-cell-editor/table-cell-key-intent.ts`
 *
 * Κρατά **μηδέν** δική του κατάσταση: ο δρομέας ζει σε store επειδή τον διαβάζει και ο
 * ζωγράφος του καμβά, που δεν βλέπει React state. Η συνδρομή είναι χαμηλής συχνότητας
 * (ένα πάτημα πλήκτρου), δηλαδή ακριβώς το ίδιο κόστος με το `useState` που αντικατέστησε
 * — ο κανόνας 1 του ADR-040 αφορά υψίσυχνα stores (pan/zoom/hover), όχι το πληκτρολόγιο.
 *
 * @see bim/table/table-cell-navigation.ts — ΠΟΙΟ κελί είναι το επόμενο
 * @see ui/table-cell-editor/TableCellEditorOverlay.tsx — η όψη + η ιδιοκτησία πλήκτρων
 * @see ui/text-toolbar/hooks/useTextDoubleClickEditor.ts — ο αδελφός που καθρεφτίζει
 */

import { useCallback, useMemo } from 'react';
import type React from 'react';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { useCommandHistory } from '../../core/commands';
import { isTableEntity } from '../../types/table-entity';
import type { TableEntity } from '../../types/table-entity';
import { resolveTableModel } from '../../bim/table/table-model-helpers';
import {
  buildTableCellEditCommand,
  resolveTableCellEditTarget,
  resolveTableCellEditTargetById,
} from '../../bim/table/table-cell-edit-session';
import {
  moveTableCursor,
  tableCursorAt,
  type TableCursorMove,
} from '../../bim/table/table-cell-navigation';
import {
  closeTableCellCursor,
  setTableCellCursor,
  useTableCellCursor,
} from '../../state/table-cell-cursor-store';
import { createTextEditorAnchor2D } from '../text-toolbar/text-editor-anchor-2d';
import type { TableCellEditorOverlayProps } from './TableCellEditorOverlay';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';
import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';

/** Σταθερό μέγεθος κουτιού (px) — ένα απλό αλφαριθμητικό input, όχι TipTap αυτόματης μεγέθυνσης. */
const CELL_EDITOR_WIDTH_PX = 140;
const CELL_EDITOR_HEIGHT_PX = 24;

interface UseTableCellDoubleClickEditorParams {
  readonly transformRef: React.RefObject<ViewTransform>;
  readonly containerRef: React.RefObject<HTMLDivElement | null>;
  readonly getSelectedEntityIds: () => readonly string[];
  readonly levelManager: LevelManagerLike;
}

/**
 * Ό,τι χρειάζεται ο καλών για να στήσει την όψη. Το `key` ταξιδεύει **δίπλα** στα props
 * και όχι μέσα τους: το React το καταναλώνει, δεν φτάνει ποτέ στο component — και εδώ
 * κουβαλά τον αριθμό συνεδρίας, που είναι ακριβώς ο λόγος που ξαναστήνεται το `<input>`.
 */
export interface TableCellOverlayMount {
  readonly key: string;
  readonly props: TableCellEditorOverlayProps;
}

interface TableCellDoubleClickEditorApi {
  readonly overlay: TableCellOverlayMount | null;
  readonly handleDoubleClick: (event: React.MouseEvent<HTMLDivElement>) => void;
}

/** Η επιλεγμένη οντότητα, αν είναι ΑΚΡΙΒΩΣ μία και είναι πίνακας — αλλιώς `null`. */
function resolveSelectedTable(
  levelManager: LevelManagerLike,
  getSelectedEntityIds: () => readonly string[],
): TableEntity | null {
  const ids = getSelectedEntityIds();
  if (ids.length !== 1) return null;
  return resolveTableById(levelManager, ids[0]);
}

/** Η οντότητα πίνακα με αυτό το id, διαβασμένη **τη στιγμή της κλήσης** (ποτέ στιγμιότυπο). */
function resolveTableById(levelManager: LevelManagerLike, entityId: string): TableEntity | null {
  const levelId = levelManager.currentLevelId;
  const scene = levelId ? levelManager.getLevelScene(levelId) : null;
  const entity = scene?.entities.find((e) => e.id === entityId);
  return entity && isTableEntity(entity) ? entity : null;
}

/** Το σημείο κόσμου ενός mouse event, με την ίδια margin-aware αντιστροφή του renderer. */
function eventWorldPoint(
  event: React.MouseEvent<HTMLDivElement>,
  container: HTMLDivElement,
  transform: ViewTransform,
): Point2D {
  const containerRect = container.getBoundingClientRect();
  const viewport: Viewport = { width: containerRect.width, height: containerRect.height };
  return CoordinateTransforms.screenToWorld(
    { x: event.clientX - containerRect.left, y: event.clientY - containerRect.top },
    transform,
    viewport,
  );
}

export function useTableCellDoubleClickEditor(
  params: UseTableCellDoubleClickEditorParams,
): TableCellDoubleClickEditorApi {
  const { transformRef, containerRef, getSelectedEntityIds, levelManager } = params;
  const { execute } = useCommandHistory();
  const cursor = useTableCellCursor();

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const entity = resolveSelectedTable(levelManager, getSelectedEntityIds);
      const container = containerRef.current;
      const transform = transformRef.current;
      if (!entity || !container || !transform) return;

      const target = resolveTableCellEditTarget(entity, eventWorldPoint(event, container, transform));
      if (!target) return;
      // Διπλό κλικ = «θέλω να διορθώσω ΑΥΤΟ το κελί» ⇒ κατάσταση `edit` (κέρσορας στο
      // τέλος), όχι `enter`. Και **νέα** στήλη αγκύρωσης: το κλικ ξεκινά νέα σειρά
      // καταχώρισης, άρα το επόμενο Enter επιστρέφει ΕΔΩ.
      // Το πρόχειρο ξεκινά από το **δεσμευμένο** κείμενο του κελιού: μπήκες με διπλό κλικ
      // για να διορθώσεις, όχι για να ξαναγράψεις από την αρχή (η `enter` κάνει εκείνο).
      setTableCellCursor(entity.id, tableCursorAt(target.rowId, target.colId), 'edit', target.text);
    },
    [levelManager, getSelectedEntityIds, containerRef, transformRef],
  );

  /**
   * Γράφει κείμενο στο τρέχον κελί ως **ένα** αναιρέσιμο `UpdateEntityCommand`.
   *
   * Ο πίνακας ξαναδιαβάζεται ΤΗ ΣΤΙΓΜΗ του commit (όχι η αναφορά του ανοίγματος), ώστε
   * δύο διαδοχικές επεξεργασίες — που πλέον είναι ο **κανόνας**, αφού το Tab γράφει
   * κελί-κελί — να μη γράφουν πάνω σε μπαγιάτικο μοντέλο.
   */
  const commitText = useCallback(
    (nextText: string) => {
      if (!cursor) return;
      const { currentLevelId, getLevelScene, setLevelScene } = levelManager;
      const entity = resolveTableById(levelManager, cursor.entityId);
      if (!entity || !currentLevelId || !setLevelScene) return;
      const sceneManager = createLevelSceneManagerAdapter(getLevelScene, setLevelScene, currentLevelId);
      const command = buildTableCellEditCommand(
        entity,
        cursor.position.rowId,
        cursor.position.colId,
        nextText,
        sceneManager,
      );
      if (command) execute(command);
    },
    [cursor, levelManager, execute],
  );

  /**
   * Μετακίνηση δρομέα. Ο νέος δρομέας μπαίνει **πάντα** σε κατάσταση `nav`: μετακινήθηκες,
   * δεν άρχισες να γράφεις — η γραφή ξεκινά μόλις πατήσεις χαρακτήρα (Excel).
   *
   * `null` από το `moveTableCursor` σημαίνει «άκρη πλέγματος»: ο δρομέας **μένει**. Καμία
   * αναδίπλωση, καμία αυτόματη νέα γραμμή — δες το σκεπτικό στο `table-cell-navigation`.
   */
  const move = useCallback(
    (m: TableCursorMove) => {
      if (!cursor) return;
      const entity = resolveTableById(levelManager, cursor.entityId);
      // Ο πίνακας εξαφανίστηκε κάτω από τον δρομέα (undo / διαγραφή): κλείσε, μη μαντεύεις.
      if (!entity) { closeTableCellCursor(); return; }
      // Το entity κρατά απλό JSON (Φ.Δ Λύση Α)· το `resolveTableModel` είναι ο ΙΔΙΟΣ
      // απομνημονευμένος (WeakMap) δρόμος που περνά και η γεωμετρία — ίδιο persisted ⇒
      // ίδιο μοντέλο, άρα καμία δεύτερη αποσειριοποίηση ανά πάτημα πλήκτρου.
      const next = moveTableCursor(resolveTableModel(entity.model), cursor.position, m);
      if (next) setTableCellCursor(cursor.entityId, next, 'nav');
    },
    [cursor, levelManager],
  );

  const clear = useCallback(() => commitText(''), [commitText]);

  // Το κελί του δρομέα, διαβασμένο από το ΖΩΝΤΑΝΟ μοντέλο σε κάθε απόδοση: κείμενο και
  // αγκύρωση είναι **παράγωγα**, ποτέ αντίγραφα (γι' αυτό το store δεν κρατά κείμενο).
  const target = useMemo(() => {
    if (!cursor) return null;
    const entity = resolveTableById(levelManager, cursor.entityId);
    return entity ? resolveTableCellEditTargetById(entity, cursor.position.rowId, cursor.position.colId) : null;
  }, [cursor, levelManager]);

  // Σταθερή ταυτότητα ανά κελί: το `TextEditorAnchorLayer` ξαναδένει τη συνδρομή του σε
  // κάθε νέο `anchor`, οπότε ένα φρέσκο αντικείμενο ανά απόδοση θα ξέδενε/ξανάδενε τον
  // scheduler σε κάθε πάτημα πλήκτρου.
  const anchor = useMemo(() => {
    if (!target) return null;
    return createTextEditorAnchor2D({
      worldPoint: target.anchorWorldPoint,
      getContainer: () => containerRef.current,
      size: { width: CELL_EDITOR_WIDTH_PX, height: CELL_EDITOR_HEIGHT_PX },
    });
  }, [target, containerRef]);

  const overlay = useMemo<TableCellOverlayMount | null>(() => {
    if (!cursor || !target || !anchor) return null;
    const { entityId, position, mode, sessionId } = cursor;
    return {
      key: `${entityId}:${position.rowId}:${position.colId}:${sessionId}`,
      props: {
        entityId,
        rowId: position.rowId,
        colId: position.colId,
        mode,
        draft: cursor.draft,
        initialText: target.text,
        anchor,
        onCommit: commitText,
        onMove: move,
        onClear: clear,
      },
    };
  }, [cursor, target, anchor, commitText, move, clear]);

  return useMemo(() => ({ overlay, handleDoubleClick }), [overlay, handleDoubleClick]);
}
