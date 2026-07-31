'use client';

/**
 * ADR-739 Φάση Δ βήμα 2 — Double-click → inline table-cell editor (**2D**).
 *
 * Καθρέφτης του `useTextDoubleClickEditor` (ADR-344 Φ6.E): κρατά ΤΟΠΙΚΟ React state
 * (`editingState`) — καμία `useSyncExternalStore`, ασφαλές μέσα στον orchestrator
 * (ADR-040 rule 1). ΠΟΙΟ κελί χτυπήθηκε + ΠΩΣ γίνεται commit ζουν στο καθαρό
 * `bim/table/table-cell-edit-session.ts` (ADR-739 Φ.Δ) — αυτό το hook είναι ο 2D
 * «ανοιχτήρας»: βρίσκει το σημείο κόσμου του διπλού κλικ, ρωτά το SSoT ποιο κελί
 * χτυπήθηκε, και στήνει την αγκύρωση.
 *
 * Selection-driven, ίδιος κανόνας ενεργοποίησης με τον text editor: ανοίγει ΜΟΝΟ όταν
 * υπάρχει ΑΚΡΙΒΩΣ μία επιλεγμένη οντότητα και είναι πίνακας (`isTableEntity`). Η ΘΕΣΗ
 * (ποιο κελί) χρειάζεται το σημείο κόσμου του ΚΛΙΚ — γι' αυτό, σε αντίθεση με το κείμενο
 * (που αγκυρώνεται στην οντότητα ολόκληρη), εδώ γίνεται η ίδια αντίστροφη προβολή
 * οθόνης→κόσμου με το `useOpeningInfoTagDoubleClick` (ADR-612).
 *
 * Commit: `execute(new UpdateEntityCommand(...))` μέσα από το `buildTableCellEditCommand`
 * — ΙΔΙΟ command bus με το `OpeningInfoTagEditorOverlay` (`useCommandHistory().execute`
 * πάνω από τον `LevelSceneManagerAdapter` singleton, ADR-527). Ο πίνακας ξαναδιαβάζεται
 * ΤΗ ΣΤΙΓΜΗ του commit (όχι η στιγμιότυπη αναφορά του ανοίγματος), ώστε δύο διαδοχικές
 * επεξεργασίες να μην γράφουν πάνω σε μπαγιάτικο μοντέλο.
 *
 * @see bim/table/table-cell-edit-session.ts — ΠΟΙΟ κελί + ΠΩΣ γίνεται commit
 * @see ui/table-cell-editor/TableCellEditorOverlay.tsx — η όψη (dumb, prop-driven)
 * @see ui/text-toolbar/hooks/useTextDoubleClickEditor.ts — ο αδελφός που καθρεφτίζει
 */

import { useCallback, useMemo, useState } from 'react';
import type React from 'react';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { useCommandHistory } from '../../core/commands';
import { isTableEntity } from '../../types/table-entity';
import type { TableEntity } from '../../types/table-entity';
import type { TableColumnId, TableRowId } from '../../types/table';
import { buildTableCellEditCommand, resolveTableCellEditTarget } from '../../bim/table/table-cell-edit-session';
import { createTextEditorAnchor2D } from '../text-toolbar/text-editor-anchor-2d';
import type { TextEditorAnchor } from '../text-toolbar/TextEditorAnchorLayer';
import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';
import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';

/** Σταθερό μέγεθος κουτιού (px) — ένα απλό αλφαριθμητικό input, όχι TipTap αυτόματης μεγέθυνσης. */
const CELL_EDITOR_WIDTH_PX = 140;
const CELL_EDITOR_HEIGHT_PX = 24;

interface EditingState {
  readonly entityId: string;
  readonly rowId: TableRowId;
  readonly colId: TableColumnId;
  readonly initialText: string;
  readonly anchor: TextEditorAnchor;
}

interface UseTableCellDoubleClickEditorParams {
  readonly transformRef: React.RefObject<ViewTransform>;
  readonly containerRef: React.RefObject<HTMLDivElement | null>;
  readonly getSelectedEntityIds: () => readonly string[];
  readonly levelManager: LevelManagerLike;
}

interface TableCellDoubleClickEditorApi {
  readonly editingState: EditingState | null;
  readonly handleDoubleClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  readonly onCommit: (nextText: string) => void;
  readonly onCancel: () => void;
}

/** Η επιλεγμένη οντότητα, αν είναι ΑΚΡΙΒΩΣ μία και είναι πίνακας — αλλιώς `null`. */
function resolveSelectedTable(
  levelManager: LevelManagerLike,
  getSelectedEntityIds: () => readonly string[],
): TableEntity | null {
  const ids = getSelectedEntityIds();
  if (ids.length !== 1) return null;
  const levelId = levelManager.currentLevelId;
  const scene = levelId ? levelManager.getLevelScene(levelId) : null;
  const entity = scene?.entities.find((e) => e.id === ids[0]);
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
  const [editingState, setEditingState] = useState<EditingState | null>(null);

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const entity = resolveSelectedTable(levelManager, getSelectedEntityIds);
      if (!entity) return;
      const container = containerRef.current;
      const transform = transformRef.current;
      if (!container || !transform) return;

      const worldPoint = eventWorldPoint(event, container, transform);
      const target = resolveTableCellEditTarget(entity, worldPoint);
      if (!target) return;

      const anchor = createTextEditorAnchor2D({
        worldPoint: target.anchorWorldPoint,
        getContainer: () => containerRef.current,
        size: { width: CELL_EDITOR_WIDTH_PX, height: CELL_EDITOR_HEIGHT_PX },
      });
      setEditingState({
        entityId: entity.id,
        rowId: target.rowId,
        colId: target.colId,
        initialText: target.text,
        anchor,
      });
    },
    [levelManager, getSelectedEntityIds, containerRef, transformRef],
  );

  const onCancel = useCallback(() => setEditingState(null), []);

  const onCommit = useCallback(
    (nextText: string) => {
      const state = editingState;
      setEditingState(null);
      if (!state) return;
      const { currentLevelId, getLevelScene, setLevelScene } = levelManager;
      if (!currentLevelId || !setLevelScene) return;
      // Ξαναδιάβασμα ΤΗ ΣΤΙΓΜΗ του commit — όχι η στιγμιότυπη αναφορά του ανοίγματος.
      const entity = getLevelScene(currentLevelId)?.entities.find((e) => e.id === state.entityId);
      if (!entity || !isTableEntity(entity)) return;
      const sceneManager = createLevelSceneManagerAdapter(getLevelScene, setLevelScene, currentLevelId);
      const command = buildTableCellEditCommand(entity, state.rowId, state.colId, nextText, sceneManager);
      if (command) execute(command);
    },
    [editingState, levelManager, execute],
  );

  return useMemo(
    () => ({ editingState, handleDoubleClick, onCommit, onCancel }),
    [editingState, handleDoubleClick, onCommit, onCancel],
  );
}
