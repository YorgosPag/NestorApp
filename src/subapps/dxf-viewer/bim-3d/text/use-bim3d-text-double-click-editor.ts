'use client';

/**
 * ADR-344 Φ-3D / ADR-537 §text — διπλό κλικ σε κείμενο **μέσα στο 3D viewport** ανοίγει τον
 * ΙΔΙΟ in-place TipTap editor με το 2D.
 *
 * Ο αδελφός του `useTextDoubleClickEditor` (2D) και mirror του
 * `use-bim3d-dxf-edit-interaction` (ADR-537: «τα ΙΔΙΑ grips + το ΙΔΙΟ commit με το 2D»).
 * Ό,τι είναι κοινό ζει αλλού και δεν ξαναγράφεται εδώ:
 *   - ποια οντότητα / πώς γίνεται commit → `ui/text-toolbar/text-edit-session.ts`
 *   - πού κάθεται ο editor              → `./text-edit-anchor-3d.ts`
 *   - πώς μετακινείται χωρίς re-render  → `ui/text-toolbar/TextEditorAnchorLayer.tsx`
 *
 * ### Γιατί native listener στον καμβά και όχι React `onDoubleClick`
 * Το `BimViewport3D` δηλώνει `onDoubleClick={(e) => e.stopPropagation()}` για να μη διαρρεύσει
 * το γεγονός στους 2D handlers. Το `stopPropagation` του React **δεν** σταματά τη διάδοση στο
 * DOM (ίδιος λόγος για τον οποίο το OrbitControls συνεχίζει να λαμβάνει γεγονότα — σχόλιο στο
 * `BimViewport3D`), οπότε ένας native listener στον renderer canvas τα βλέπει κανονικά. Έτσι το
 * χαρακτηριστικό μπαίνει ΧΩΡΙΣ να αγγίξει τον orchestrator — ο οποίος είναι ήδη στο όριο των
 * 500 γραμμών (N.7.1) — και ακολουθεί το ΙΔΙΟ pattern (`addEventListener` + `AbortController`)
 * με τον raw-DXF grip editor του ADR-537.
 *
 * ### Η επιλογή είναι ΚΟΙΝΗ με το 2D
 * Το 3D pick raw-DXF οντοτήτων γράφει στο ΙΔΙΟ `SelectedEntitiesStore` που διαβάζουν οι 2D
 * λαβές (`use-bim3d-pointer-handlers` → `applyDxfEntityClickSelection`). Άρα κλικ στο 3D +
 * διπλό κλικ ανοίγει τον editor, και ένα κείμενο επιλεγμένο στο 2D είναι ήδη επεξεργάσιμο
 * μόλις γυρίσεις σε 3D — χωρίς δεύτερο μηχανισμό επιλογής.
 *
 * ### ⚠️ Ο σωστός ΟΡΟΦΟΣ, όχι ο ενεργός
 * Με «Όλοι οι όροφοι» (`floor3DScope: 'all'`) βλέπεις — και άρα διπλοκλικάρεις — κείμενο που
 * ζει σε ΑΛΛΟ level. Το commit ΔΕΝ επιτρέπεται να πάει στο `currentLevelId`: θα έγραφε τη
 * διόρθωση σε λάθος όροφο, σιωπηλά, χωρίς κανένα σφάλμα πουθενά. Γι' αυτό το level λύνεται
 * ανά οντότητα με `resolveEntityLevelId` και τα services χτίζονται πάνω σε ΑΥΤΟ
 * (`buildDxfTextServices`).
 *
 * ### Γιατί το lookup γίνεται στο `SceneModel` και όχι στο `DxfScene`
 * Στο `DxfScene` το MTEXT έχει ήδη κανονικοποιηθεί σε `type:'text'` από τον
 * `convertTextEntity`. Το `SceneModel` είναι το μόνο επίπεδο όπου το ερώτημα «TEXT ή MTEXT;»
 * έχει ακόμη απάντηση — και είναι επίσης το επίπεδο πάνω στο οποίο γράφουν τα commands.
 *
 * ADR-040: μόνο τοπικό React state· μηδέν `useSyncExternalStore`. Όλες οι αναγνώσεις store
 * γίνονται στον χρόνο του γεγονότος. ADR-371: ανενεργό χωρίς levels context.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCommandHistory } from '../../core/commands';
import { useLevelsOptional } from '../../systems/levels/useLevels';
import { useCanEditText } from '../../hooks/useCanEditText';
import { SelectedEntitiesStore } from '../../systems/selection/SelectedEntitiesStore';
import { buildTextEditCommand, resolveTextEditTarget } from '../../ui/text-toolbar/text-edit-session';
import { buildDxfTextServices } from '../../ui/text-toolbar/hooks/useDxfTextServices';
import { resolveEntityLevelId } from '../animation/bim3d-edit-live-preview-apply';
import { createTextEditorAnchor3D, type Bim3DProjectionSource } from './text-edit-anchor-3d';
import type { TextEditorAnchor } from '../../ui/text-toolbar/TextEditorAnchorLayer';
import type { DxfTextNode } from '../../text-engine/types';

/** Σταθερό, ευανάγνωστο μέγεθος κουτιού (px) — AutoCAD MTEXTFIXED=2· δεν ζουμάρει. */
const EDITOR_BOX_PX = { width: 220, height: 32 } as const;

export interface Bim3DTextEditingState {
  readonly entityId: string;
  readonly initial: DxfTextNode;
  readonly anchor: TextEditorAnchor;
  /** Ο όροφος όπου ζει η οντότητα — το commit γράφει ΕΚΕΙ, όχι στον ενεργό. */
  readonly levelId: string;
}

export interface Bim3DTextDoubleClickEditorApi {
  readonly editingState: Bim3DTextEditingState | null;
  readonly onCommit: (next: DxfTextNode) => void;
  readonly onCancel: () => void;
}

export function useBim3DTextDoubleClickEditor(params: {
  readonly canvasEl: HTMLCanvasElement | null;
  readonly source: Bim3DProjectionSource;
}): Bim3DTextDoubleClickEditorApi {
  const { canvasEl, source } = params;
  const levels = useLevelsOptional();
  const levelsRef = useRef(levels);
  levelsRef.current = levels;
  const caps = useCanEditText();
  const capsRef = useRef(caps);
  capsRef.current = caps;
  const { execute } = useCommandHistory();
  const [editingState, setEditingState] = useState<Bim3DTextEditingState | null>(null);

  useEffect(() => {
    if (!canvasEl) return;
    const controller = new AbortController();
    canvasEl.addEventListener('dblclick', () => {
      const lv = levelsRef.current;
      if (!lv) return; // ADR-371 — read-only Properties pipeline: κανένα levels context.
      const ids = SelectedEntitiesStore.getSelectedEntityIds();
      if (ids.length !== 1) return;
      const entityId = ids[0]!;
      // Ο όροφος ΤΗΣ ΟΝΤΟΤΗΤΑΣ (όχι ο ενεργός) — δες τη σημείωση για το «Όλοι οι όροφοι».
      const levelId = resolveEntityLevelId(lv, entityId);
      if (!levelId) return;
      const target = resolveTextEditTarget(lv.getLevelScene(levelId), ids);
      if (!target) return;
      setEditingState({
        entityId: target.entity.id,
        initial: target.node,
        levelId,
        anchor: createTextEditorAnchor3D({ entityId, source, size: EDITOR_BOX_PX }),
      });
    }, { signal: controller.signal });
    return () => controller.abort();
  }, [canvasEl, source]);

  const onCancel = useCallback(() => setEditingState(null), []);

  const onCommit = useCallback(
    (next: DxfTextNode) => {
      const state = editingState;
      setEditingState(null);
      const lv = levelsRef.current;
      if (!state || !lv) return;
      const services = buildDxfTextServices({
        levelId: state.levelId,
        getLevelScene: lv.getLevelScene,
        setLevelScene: lv.setLevelScene,
        scene: lv.getLevelScene(state.levelId),
        canUnlockLayer: capsRef.current.canUnlockLayer,
      });
      if (!services) return;
      const command = buildTextEditCommand(state.entityId, state.initial, next, services);
      if (command) execute(command);
    },
    [editingState, execute],
  );

  return useMemo(
    () => ({ editingState, onCommit, onCancel }),
    [editingState, onCommit, onCancel],
  );
}
