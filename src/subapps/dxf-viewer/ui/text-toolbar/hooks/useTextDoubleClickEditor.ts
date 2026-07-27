'use client';

/**
 * ADR-344 Phase 6.E — Double-click → TipTap in-canvas editor (**2D**).
 *
 * AutoCAD `DBLCLKEDIT = 1` parity: a double-click on a TEXT/MTEXT entity opens a
 * contextual in-canvas editor over the entity. On commit, the editor's resulting
 * DxfTextNode is diffed against the pre-edit snapshot and dispatched as one
 * CompoundCommand — a single undo step regardless of how many fields changed
 * (matches AutoCAD's MTEXTEDIT undo grain).
 *
 * ADR-344 Φ-3D — αυτό το hook είναι πλέον ο **2D wrapper** πάνω από τον κοινό πυρήνα:
 *   - ΠΟΙΑ οντότητα + ΠΩΣ γίνεται commit → `text-edit-session.ts` (κοινό με το 3D)
 *   - ΠΟΥ κάθεται ο editor → `text-editor-anchor-2d.ts` (το μόνο 2D-ειδικό κομμάτι)
 * Ο 3D αδελφός είναι το `bim-3d/text/use-bim3d-text-double-click-editor.ts`.
 *
 * Returns:
 *   - `editingState`: `{ entityId, initial, anchor } | null`
 *   - `handleDoubleClick`: bind to canvas container
 *   - `onCommit` / `onCancel`: forward to `<TextEditorOverlay>`
 *
 * Selection-driven trigger: the hook only opens the editor when exactly one entity is
 * selected and it is a TEXT/MTEXT (ο κανόνας ζει στο `resolveTextEditTarget`).
 *
 * ADR-040 note: this hook holds local React state only — no `useSyncExternalStore`, no
 * high-frequency subscription. Safe to mount in the orchestrator (CanvasSection). Η
 * παρακολούθηση του transform γίνεται μέσα στο anchor, επιτακτικά, χωρίς re-render.
 */

import { useCallback, useMemo, useState } from 'react';
import type { ICommand } from '../../../core/commands';
import { buildTextEditCommand, resolveTextEditTarget } from '../text-edit-session';
import { createTextEditorAnchor2D, textEditorBoxHeightPx } from '../text-editor-anchor-2d';
import { useCurrentSceneModel } from './useCurrentSceneModel';
import { useDxfTextServices } from './useDxfTextServices';
import type { TextEditorAnchor } from '../TextEditorAnchorLayer';
import type { DxfTextNode } from '../../../text-engine/types';
import type { AnySceneEntity } from '../../../types/scene';

/** Πλάτος του κουτιού επεξεργασίας (px) — το TipTap μεγαλώνει μόνο του από εκεί και πάνω. */
const EDITOR_BOX_WIDTH_PX = 200;

interface EditingState {
  readonly entityId: string;
  readonly initial: DxfTextNode;
  readonly anchor: TextEditorAnchor;
}

interface CanvasTransform {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

interface UseTextDoubleClickEditorParams {
  readonly transformRef: React.RefObject<CanvasTransform>;
  readonly containerRef: React.RefObject<HTMLDivElement | null>;
  readonly executeCommand: (cmd: ICommand) => void;
  readonly getSelectedEntityIds: () => readonly string[];
}

interface TextDoubleClickEditorApi {
  readonly editingState: EditingState | null;
  readonly handleDoubleClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  readonly onCommit: (next: DxfTextNode) => void;
  readonly onCancel: () => void;
}

/** Το σημείο εισαγωγής της οντότητας σε συντεταγμένες κόσμου (0,0 όταν λείπει). */
function entityWorldPoint(entity: AnySceneEntity): { x: number; y: number } {
  return (
    (entity as unknown as { position?: { x: number; y: number } }).position ?? { x: 0, y: 0 }
  );
}

/** Ύψος κειμένου (μονάδες κόσμου) από το πρώτο run του AST — 0 όταν δεν υπάρχει. */
function firstRunHeight(node: DxfTextNode): number {
  const firstRun = node.paragraphs[0]?.runs[0];
  return firstRun && 'style' in firstRun ? firstRun.style.height : 0;
}

export function useTextDoubleClickEditor(
  params: UseTextDoubleClickEditorParams,
): TextDoubleClickEditorApi {
  const { transformRef, containerRef, executeCommand, getSelectedEntityIds } = params;
  const scene = useCurrentSceneModel();
  const services = useDxfTextServices();
  const [editingState, setEditingState] = useState<EditingState | null>(null);

  const handleDoubleClick = useCallback(
    (_event: React.MouseEvent<HTMLDivElement>) => {
      const target = resolveTextEditTarget(scene, getSelectedEntityIds());
      if (!target) return;
      const container = containerRef.current;
      const transform = transformRef.current;
      if (!container || !transform) return;
      // Το `scale` διαβάζεται ΜΙΑ φορά, μόνο για το αρχικό ΜΕΓΕΘΟΣ του κουτιού (AutoCAD
      // MTEXTFIXED: το κουτί μένει ευανάγνωστο, δεν ζουμάρει μαζί με τον καμβά). Η ΘΕΣΗ
      // διαβάζεται ζωντανά μέσα στο anchor.
      const anchor = createTextEditorAnchor2D({
        worldPoint: entityWorldPoint(target.entity),
        getContainer: () => containerRef.current,
        size: {
          width: EDITOR_BOX_WIDTH_PX,
          height: textEditorBoxHeightPx(firstRunHeight(target.node), transform.scale),
        },
      });
      setEditingState({ entityId: target.entity.id, initial: target.node, anchor });
    },
    [scene, getSelectedEntityIds, transformRef, containerRef],
  );

  const onCancel = useCallback(() => setEditingState(null), []);

  const onCommit = useCallback(
    (next: DxfTextNode) => {
      const state = editingState;
      setEditingState(null);
      if (!state || !services) return;
      const command = buildTextEditCommand(state.entityId, state.initial, next, services);
      if (command) executeCommand(command);
    },
    [editingState, services, executeCommand],
  );

  return useMemo(
    () => ({ editingState, handleDoubleClick, onCommit, onCancel }),
    [editingState, handleDoubleClick, onCommit, onCancel],
  );
}
