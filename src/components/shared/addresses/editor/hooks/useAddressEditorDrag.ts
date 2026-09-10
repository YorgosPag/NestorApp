'use client';

/**
 * =============================================================================
 * useAddressEditorDrag — το σύρσιμο πινέζας μέσα στον editor (ADR-332 D27 Βήμα Β)
 * =============================================================================
 *
 * Εκκρεμές σύρσιμο · οι δύο επιβεβαιώσεις («Ναι, ενημέρωσε» / «Μόνο η θέση») · ακύρωση ·
 * αναίρεση της **πινέζας**. Εξήχθη από τον `AddressEditor` (466 γρ., N.7.1).
 *
 * 🔴 **Τι διορθώνει**: ο editor κρατούσε **μόνο κείμενο**. Η θέση του χεριού χανόταν πριν
 * ανοίξει ο διάλογος, το «Ναι, ενημέρωσε» έγραφε το κείμενο της μηχανής χωρίς τη θέση που
 * το γέννησε, και η αναίρεση επανέφερε το κείμενο αφήνοντας την πινέζα εκεί που ήταν.
 *
 * 🔑 **Δύο κανάλια, καθαρά χωρισμένα**: η **θέση** φεύγει **μόνο** από το `placement.onPlace`
 * (και στις δύο επιβεβαιώσεις), το **κείμενο** μόνο από το `applyText` / `onDragApplied`.
 * Έτσι «Μόνο η θέση» και «Ναι, ενημέρωσε» διαφέρουν **ακριβώς** στο κείμενο — τίποτε άλλο.
 *
 * @module components/shared/addresses/editor/hooks/useAddressEditorDrag
 */

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { GeoPoint } from '@/types/geo/coordinates';
import { usePinDropGate } from '../../usePinDropGate';
import type { CorrectionAction } from '@/services/geocoding/address-corrections-telemetry.service';
import type { AddressEditorPlacementOptions, EditorPinDrop } from '../AddressEditor.types';
import type { ResolvedAddressFields, UndoEntry } from '../types';
import type { PushUndoInput } from './useAddressUndo';

/** Οι δύο εκβάσεις ενός επιβεβαιωμένου συρσίματος στην τηλεμετρία διορθώσεων. */
export type DragCorrectionAction = Extract<CorrectionAction, 'used-drag' | 'kept-user'>;

export interface UseAddressEditorDragDeps {
  readonly userInputRef: MutableRefObject<ResolvedAddressFields>;
  readonly undo: { readonly push: (input: PushUndoInput) => unknown };
  /** Γράφει το κείμενο στη φόρμα (κατάσταση + γονιός + «μπαγιάτικο» στη μηχανή). */
  readonly applyText: (next: ResolvedAddressFields) => void;
  readonly recordDrag: (action: DragCorrectionAction, finalAddress: ResolvedAddressFields) => void;
  readonly onDragApplied?: (addr: ResolvedAddressFields) => void;
  readonly placement?: AddressEditorPlacementOptions;
  /** Η ακύρωση επαναφέρει την πινέζα του χάρτη (ο γονιός αυξάνει το `dragResetKey`). */
  readonly onCancel?: () => void;
}

export interface AddressEditorDrag {
  readonly pendingDrag: EditorPinDrop | null;
  readonly queue: (drop: EditorPinDrop) => void;
  readonly confirm: () => void;
  /** `undefined` όταν ο καλών δεν αποθηκεύει θέση — ο διάλογος τότε δεν το προσφέρει. */
  readonly confirmPositionOnly: (() => void) | undefined;
  readonly cancel: () => void;
  readonly restorePoint: (entry: UndoEntry, direction: 'undo' | 'redo') => void;
}

/**
 * Εφαρμόζει ένα επιβεβαιωμένο σύρσιμο. `fields === null` ⇒ «Μόνο η θέση».
 *
 * ⚠️ Η τηλεμετρία γράφεται **πριν** αλλάξει το κείμενο — διαβάζει ό,τι είχε πληκτρολογήσει
 * ο άνθρωπος, όπως έκανε και ο παλιός `handleDragConfirm`.
 */
function commitDrag(
  deps: UseAddressEditorDragDeps,
  lastPoint: MutableRefObject<GeoPoint | null>,
  point: GeoPoint,
  fields: ResolvedAddressFields | null,
): void {
  const before = deps.userInputRef.current;
  const after = fields ?? before;
  deps.undo.push({
    kind: fields ? 'drag-applied' : 'drag-position',
    before,
    after,
    i18nKey: fields ? 'addresses.editor.undo.dragApplied' : 'addresses.editor.undo.dragPosition',
    point: { before: lastPoint.current, after: point },
  });
  deps.recordDrag(fields ? 'used-drag' : 'kept-user', after);
  lastPoint.current = point;
  deps.placement?.onPlace(point);
  if (fields) {
    deps.applyText(fields);
    deps.onDragApplied?.(fields);
  }
}

export function useAddressEditorDrag(deps: UseAddressEditorDragDeps): AddressEditorDrag {
  const [pendingDrag, setPendingDrag] = useState<EditorPinDrop | null>(null);
  const gate = usePinDropGate();
  /** Η τελευταία θέση που επιβεβαιώθηκε εδώ — `null` = η θέση της εγγραφής πριν τη φόρμα. */
  const lastPointRef = useRef<GeoPoint | null>(null);
  const depsRef = useRef(deps);
  useEffect(() => {
    depsRef.current = deps;
  });

  // 🔑 Β13: η ίδια χειρονομία φτάνει δύο φορές (`pending` → τελική) — κλεισμένη ΔΕΝ ξανανοίγει.
  const queue = useCallback((drop: EditorPinDrop) => {
    if (gate.admits(drop)) setPendingDrag(drop);
  }, [gate]);

  const confirm = useCallback(() => {
    if (pendingDrag?.text.kind !== 'resolved') return;
    commitDrag(depsRef.current, lastPointRef, pendingDrag.point, pendingDrag.text.address);
    gate.settle(pendingDrag);
    setPendingDrag(null);
  }, [pendingDrag, gate]);

  const confirmPositionOnly = useCallback(() => {
    if (!pendingDrag) return;
    commitDrag(depsRef.current, lastPointRef, pendingDrag.point, null);
    gate.settle(pendingDrag);
    setPendingDrag(null);
  }, [pendingDrag, gate]);

  const cancel = useCallback(() => {
    gate.settle(pendingDrag);
    setPendingDrag(null);
    depsRef.current.onCancel?.();
  }, [pendingDrag, gate]);

  const restorePoint = useCallback((entry: UndoEntry, direction: 'undo' | 'redo') => {
    const { placement } = depsRef.current;
    if (!entry.point || !placement) return;
    const target = direction === 'undo' ? entry.point.before : entry.point.after;
    lastPointRef.current = target;
    placement.onRestore(target);
  }, []);

  return {
    pendingDrag,
    queue,
    confirm,
    confirmPositionOnly: deps.placement ? confirmPositionOnly : undefined,
    cancel,
    restorePoint,
  };
}
