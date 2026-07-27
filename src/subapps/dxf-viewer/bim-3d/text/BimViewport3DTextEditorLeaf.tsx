'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-344 Φ-3D — BimViewport3DTextEditorLeaf: το λεπτό leaf που προσαρτά τον in-place text
 * editor μέσα στο 3D viewport.
 *
 * Είναι σκόπιμα **αυτοδύναμο**: δένει μόνο του τον native `dblclick` listener στον renderer
 * canvas και δεν ζητά τίποτα από τον `BimViewport3D` παρά το `managerRef`. Ο λόγος είναι
 * αρχιτεκτονικός, όχι κοσμητικός — ο orchestrator είναι στο όριο των 500 γραμμών (N.7.1) και
 * ο ADR-040 λέει ότι νέες συνδρομές πάνε στα φύλλα, ποτέ στον orchestrator.
 *
 * ADR-040 συμμόρφωση: μηδέν `useSyncExternalStore`. Το μόνο React state είναι η ανοιχτή
 * συνεδρία επεξεργασίας — αλλάζει όταν ο χρήστης κάνει διπλό κλικ ή commit, δηλαδή δύο φορές
 * ανά διόρθωση, όχι στα 60fps. Το ακολούθημα της κάμερας γίνεται **επιτακτικά** μέσα στο
 * `TextEditorAnchorLayer`, χωρίς κανένα render.
 *
 * @see ./use-bim3d-text-double-click-editor.ts — η λογική
 * @see ./text-edit-anchor-3d.ts — η προβολή
 * @see ../../ui/text-toolbar/TextEditorOverlay.tsx — ο ΙΔΙΟΣ editor με το 2D
 */

import React, { useMemo, type MutableRefObject } from 'react';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { TextEditorOverlay } from '../../ui/text-toolbar/TextEditorOverlay';
import { useBim3DTextDoubleClickEditor } from './use-bim3d-text-double-click-editor';
import type { Bim3DProjectionSource } from './text-edit-anchor-3d';

export interface BimViewport3DTextEditorLeafProps {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
  /** Ο renderer canvas· `null` όσο η σκηνή δεν έχει προσαρτηθεί ακόμη. */
  readonly canvasEl: HTMLCanvasElement | null;
}

export function BimViewport3DTextEditorLeaf({
  managerRef,
  canvasEl,
}: BimViewport3DTextEditorLeafProps): React.ReactElement | null {
  // Σταθερή αναφορά: το `source` ταξιδεύει μέσα στο anchor μιας ανοιχτής συνεδρίας, οπότε ένα
  // φρέσκο αντικείμενο ανά render θα ξανάδενε τη συνδρομή του scheduler σε κάθε render.
  const source = useMemo<Bim3DProjectionSource>(
    () => ({
      getCamera: () => managerRef.current?.getCamera() ?? null,
      getCanvas: () => managerRef.current?.getRendererCanvas() ?? null,
    }),
    [managerRef],
  );

  const { editingState, onCommit, onCancel } = useBim3DTextDoubleClickEditor({ canvasEl, source });

  if (!editingState) return null;
  return (
    <TextEditorOverlay
      entityId={editingState.entityId}
      initial={editingState.initial}
      anchor={editingState.anchor}
      onCommit={onCommit}
      onCancel={onCancel}
    />
  );
}
