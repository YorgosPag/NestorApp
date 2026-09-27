'use client';

/**
 * @fileoverview **ΟΙ ΠΡΑΞΕΙΣ ΤΗΣ ΟΘΟΝΗΣ ΤΟΠΟΘΕΤΗΣΗΣ** — τοποθέτηση, αφαίρεση, βελάκι, αποσύνδεση, αναίρεση
 * (ADR-884 Φ2δ · §4.10).
 * @related `services/spatial-tour/spatial-tour-graph.client.ts` (η ΜΙΑ κλήση) · `lib/spatial-tour/tour-graph-edit.ts`
 *   (οι **ίδιες** καθαρές αλλαγές με τον διακομιστή — αισιόδοξη εφαρμογή) · `lib/spatial-tour/tour-graph-inverse.ts`
 * @module components/spatial-tour/editor/useTourEditorActions
 *
 * 🔑 **Βελάκι/αποσύνδεση = αισιόδοξα** (πρότυπο Gmail): η αλλαγή φαίνεται αμέσως με τη **ΜΙΑ** καθαρή συνάρτηση του
 *   γραφέα, και μετά έρχεται η αλήθεια του διακομιστή (ξαναφόρτωση). Άρνηση ⇒ επαναφορά + ονομασμένο μήνυμα.
 * 🔑 **Τοποθέτηση/αφαίρεση = όχι αισιόδοξα**: το νέο σημείο παίρνει id **στον διακομιστή** (N.6) — ένα προσωρινό id
 *   στην οθόνη θα ήταν δεύτερη ταυτότητα για το ίδιο σημείο.
 * 🔑 **Αναίρεση = νέες εντολές μέσα από τον ίδιο γραφέα** (`inverseOf`), ποτέ τοπική στοίβα καταστάσεων.
 */

import { useCallback, useRef, useState } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { linkNodes, unlinkNodes, type TourGraphCommand, type TourPlacementTarget } from '@/lib/spatial-tour/tour-graph-edit';
import { inverseOf } from '@/lib/spatial-tour/tour-graph-inverse';
import { useNotifications } from '@/providers/NotificationProvider';
import { editTourGraphFromScreen } from '@/services/spatial-tour/spatial-tour-graph.client';
import type { TourNode, TourSubject } from '@/types/spatial-tour';

import { TOUR_REFUSAL_KEY } from '../spatial-tour-labels';
import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import { TOUR_EDITOR_KEYS } from './tour-editor-labels';
import type { TourEditorDataHandle } from './useTourEditorData';

export interface TourEditorActions {
  /** Τοποθέτηση/αφαίρεση σε εξέλιξη — η φόρμα κλειδώνει. */
  readonly busy: boolean;
  readonly place: (captureId: string, target: TourPlacementTarget) => Promise<boolean>;
  readonly unplace: (captureId: string) => Promise<boolean>;
  readonly placeArrow: (fromNodeId: string, toNodeId: string, bearingRad: number) => void;
  readonly unlink: (a: string, b: string) => void;
}

/** Η αισιόδοξη εικόνα μιας εντολής — `null` για ό,τι δεν εφαρμόζεται αισιόδοξα. */
function optimisticNodes(command: TourGraphCommand, nodes: readonly TourNode[]): readonly TourNode[] | null {
  const graph = { levels: [], nodes };
  const result = command.op === 'link' ? linkNodes(graph, command.fromNodeId, command.toNodeId, command.bearingRad)
    : command.op === 'unlink' ? unlinkNodes(graph, command.fromNodeId, command.toNodeId) : null;
  return result?.kind === 'edited' ? result.graph.nodes : null;
}

const SUCCESS_KEY: Record<TourGraphCommand['op'], string> = {
  place: TOUR_EDITOR_KEYS.placed,
  unplace: TOUR_EDITOR_KEYS.removed,
  link: TOUR_EDITOR_KEYS.arrowSaved,
  unlink: TOUR_EDITOR_KEYS.unlinked,
};

export function useTourEditorActions(subject: TourSubject, data: TourEditorDataHandle): TourEditorActions {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const { success, error } = useNotifications();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(0);
  const { load, reload, setNodes } = data;
  const nodes = load.kind === 'loaded' ? load.data.nodes : null;

  const runUndo = useCallback(async (commands: readonly TourGraphCommand[]) => {
    for (const command of commands) {
      const result = await editTourGraphFromScreen(subject, command);
      if (result.kind !== 'ok') { error(t(TOUR_EDITOR_KEYS.saveFailed)); break; }
    }
    await reload();
  }, [subject, reload, error, t]);

  const send = useCallback(async (command: TourGraphCommand): Promise<boolean> => {
    if (nodes === null) return false;
    const optimistic = optimisticNodes(command, nodes);
    if (optimistic !== null) setNodes(optimistic);
    inFlight.current += 1;
    const result = await editTourGraphFromScreen(subject, command);
    inFlight.current -= 1;
    if (result.kind !== 'ok') {
      // Επαναφορά μόνο αν καμία άλλη αλλαγή δεν πέρασε στο μεταξύ — αλλιώς η αλήθεια έρχεται από τη φόρτωση.
      if (optimistic !== null && inFlight.current === 0) setNodes(nodes);
      error(t(result.kind === 'refused' ? TOUR_REFUSAL_KEY[result.reason] : TOUR_EDITOR_KEYS.saveFailed));
      await reload();
      return false;
    }
    const undo = result.value.changed ? inverseOf(command, { nodes }) : null;
    success(t(SUCCESS_KEY[command.op]), undo === null ? undefined : {
      actions: [{ label: t(TOUR_EDITOR_KEYS.undo), onClick: () => void runUndo(undo) }],
    });
    await reload();
    return true;
  }, [nodes, subject, setNodes, reload, success, error, t, runUndo]);

  const locked = useCallback(async (command: TourGraphCommand) => {
    setBusy(true);
    try { return await send(command); } finally { setBusy(false); }
  }, [send]);

  return {
    busy,
    place: (captureId, target) => locked({ op: 'place', captureId, target }),
    unplace: (captureId) => locked({ op: 'unplace', captureId }),
    placeArrow: (fromNodeId, toNodeId, bearingRad) => void send({ op: 'link', fromNodeId, toNodeId, bearingRad }),
    unlink: (a, b) => void send({ op: 'unlink', fromNodeId: a, toNodeId: b }),
  };
}
