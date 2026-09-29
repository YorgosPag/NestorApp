'use client';

/**
 * @fileoverview **ΤΟ ΕΡΓΑΛΕΙΟ ΘΟΛΩΜΑΤΟΣ ΕΝΟΣ ΣΗΜΕΙΟΥ** — πρόχειρο ανά λήψη, λειτουργία πινέλου, «Εφαρμογή» σε δέσμη, Esc (ADR-884
 * Φ2ζ ζ3 · §4.15).
 * @related `lib/spatial-tour/tour-redaction-draft.ts` (ο reducer — όλη η κρίση) · `useTourEditorActions.ts` (`redactions` — η ΜΙΑ
 *   εντολή) · `tour-editor-escape.ts` · `TourRedactionOverlay.tsx` · `TourRedactionTools.tsx`
 * @module components/spatial-tour/editor/redaction/useRedactionTool
 *
 * 🔑 **Πρόχειρο ανά λήψη, όχι ανά οθόνη**: ο υπεύθυνος που πάει σε άλλο σημείο και γυρίζει βρίσκει τους κύκλους του όπως τους
 *   άφησε (Figma: η δουλειά δεν χάνεται από μια πλοήγηση). Νέα αλήθεια από τον διακομιστή ⇒ `rebase` **κατά την ανάγνωση**,
 *   χωρίς effect (ποτέ ένα καρέ με παλιά εφαρμοσμένα).
 * 🔑 **Esc**: επιλεγμένος κύκλος ⇒ αποεπιλογή · πινέλο ⇒ έξοδος · αλλιώς ο διάλογος κλείνει (ΕΝΑΣ ιδιοκτήτης).
 */

import { useCallback, useMemo, useState } from 'react';

import type { TourRedactionEdit } from '@/lib/spatial-tour/tour-graph-edit';
import {
  draftEdits,
  initialRedactionDraft,
  redactionDraftReducer,
  type TourRedactionDraft,
  type TourRedactionDraftAction,
} from '@/lib/spatial-tour/tour-redaction-draft';
import type { TourCapture, TourRedaction } from '@/types/spatial-tour';

import { useTourEditorEscapeClaim } from '../tour-editor-escape';

const NONE: readonly TourRedaction[] = [];

export interface RedactionTool {
  /** Η λήψη του σημείου — `null` πριν φορτώσει η σκηνή. */
  readonly captureId: string | null;
  readonly draft: TourRedactionDraft;
  readonly edits: readonly TourRedactionEdit[];
  readonly brush: boolean;
  readonly setBrush: (on: boolean) => void;
  readonly dispatch: (action: TourRedactionDraftAction) => void;
  /** Id νέου κύκλου (N.6) — κόβεται τη στιγμή που **γεννιέται** ο κύκλος. */
  readonly newId: () => string;
  readonly applying: boolean;
  readonly apply: () => Promise<void>;
}

export interface RedactionToolDeps {
  readonly apply: (captureId: string, edits: readonly TourRedactionEdit[]) => Promise<boolean>;
  readonly newId: () => string;
}

/** Το πρόχειρο της λήψης, ακολουθώντας την αλήθεια του διακομιστή (`rebase` κατά την ανάγνωση). */
function draftOf(stored: TourRedactionDraft | undefined, applied: readonly TourRedaction[]): TourRedactionDraft {
  if (stored === undefined) return initialRedactionDraft(applied);
  return stored.applied === applied ? stored : redactionDraftReducer(stored, { kind: 'rebase', applied });
}

/** Esc: επιλεγμένος κύκλος ⇒ αποεπιλογή · πινέλο ⇒ έξοδος · αλλιώς «όχι δικό μου» (ο διάλογος κλείνει). */
function useRedactionEscape(
  draft: TourRedactionDraft, brush: boolean, dispatch: (action: TourRedactionDraftAction) => void, setBrush: (on: boolean) => void,
): void {
  useTourEditorEscapeClaim(brush || draft.selectedId !== null, () => {
    if (draft.selectedId !== null) { dispatch({ kind: 'select', id: null }); return true; }
    if (brush) { setBrush(false); return true; }
    return false;
  });
}

export function useRedactionTool(capture: TourCapture | undefined, deps: RedactionToolDeps): RedactionTool {
  const [drafts, setDrafts] = useState<ReadonlyMap<string, TourRedactionDraft>>(() => new Map());
  const [brush, setBrush] = useState(false);
  const [applying, setApplying] = useState(false);
  const captureId = capture?.id ?? null;
  const applied = capture?.redactions ?? NONE;
  const draft = useMemo(() => draftOf(captureId === null ? undefined : drafts.get(captureId), applied), [drafts, captureId, applied]);
  const edits = useMemo(() => draftEdits(draft), [draft]);

  const dispatch = useCallback((action: TourRedactionDraftAction) => {
    if (captureId === null) return;
    setDrafts((prev) => {
      const next = redactionDraftReducer(draftOf(prev.get(captureId), applied), action);
      return new Map(prev).set(captureId, next);
    });
  }, [captureId, applied]);

  const { apply: send } = deps;
  const apply = useCallback(async () => {
    if (captureId === null || edits.length === 0) return;
    setApplying(true);
    try {
      if (await send(captureId, edits)) {
        setBrush(false);
        setDrafts((prev) => { const next = new Map(prev); next.delete(captureId); return next; });
      }
    } finally {
      setApplying(false);
    }
  }, [captureId, edits, send]);

  useRedactionEscape(draft, brush, dispatch, setBrush);

  const { newId } = deps;
  return useMemo(() => ({ captureId, draft, edits, brush, setBrush, dispatch, newId, applying, apply }),
    [captureId, draft, edits, brush, dispatch, newId, applying, apply]);
}
