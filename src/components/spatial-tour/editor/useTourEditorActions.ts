'use client';

/**
 * @fileoverview **ΟΙ ΠΡΑΞΕΙΣ ΤΗΣ ΟΘΟΝΗΣ ΤΟΠΟΘΕΤΗΣΗΣ** — τοποθέτηση, αφαίρεση, βελάκι, αποσύνδεση, χώρος, κάτοψη, κλίμακα,
 * θέση, προσανατολισμός, αναίρεση (ADR-884 Φ2δ · §4.10 · Φ2στ-β · §4.13).
 * @related `services/spatial-tour/spatial-tour-graph.client.ts` (η ΜΙΑ κλήση) · `lib/spatial-tour/tour-graph-edit.ts` ·
 *   `lib/spatial-tour/tour-plan-edit.ts` (οι **ίδιες** καθαρές αλλαγές με τον διακομιστή — αισιόδοξη εφαρμογή) ·
 *   `lib/spatial-tour/tour-graph-inverse.ts`
 * @module components/spatial-tour/editor/useTourEditorActions
 *
 * 🔑 **Βελάκι · αποσύνδεση · χώρος · θέση · προσανατολισμός = αισιόδοξα** (πρότυπο Gmail): η αλλαγή φαίνεται αμέσως με τη
 *   **ΜΙΑ** καθαρή συνάρτηση του γραφέα, και μετά έρχεται η αλήθεια του διακομιστή (ξαναφόρτωση). Άρνηση ⇒ επαναφορά +
 *   ονομασμένο μήνυμα.
 * 🔑 **Τοποθέτηση · αφαίρεση · κάτοψη · κλίμακα = κλειδωμένα**: νέο id στον διακομιστή (N.6) · εικόνα που ετοιμάζει ο
 *   διακομιστής · ξανακλιμάκωση όλου του ορόφου. Μια αισιόδοξη εικόνα εδώ θα ήταν δεύτερη αλήθεια.
 * 🔑 **Αναίρεση = νέες εντολές μέσα από τον ίδιο γραφέα** (`inverseOf`), ποτέ τοπική στοίβα καταστάσεων.
 */

import { useCallback, useMemo, useRef, useState } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  linkNodes,
  nameNode,
  unlinkNodes,
  type TourFloorPlanPick,
  type TourGraphCommand,
  type TourPlacementTarget,
} from '@/lib/spatial-tour/tour-graph-edit';
import { inverseOf } from '@/lib/spatial-tour/tour-graph-inverse';
import { orientNode, positionNode } from '@/lib/spatial-tour/tour-plan-edit';
import type { TourRoomInput } from '@/lib/spatial-tour/tour-room';
import { graphLevelsOfViewer } from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import { useNotifications } from '@/providers/NotificationProvider';
import { editTourGraphFromScreen } from '@/services/spatial-tour/spatial-tour-graph.client';
import type { SpatialTour, TourCapture, TourLevelKey, TourNode, TourSubject } from '@/types/spatial-tour';

import { TOUR_REFUSAL_KEY } from '../spatial-tour-labels';
import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import { TOUR_EDITOR_KEYS } from './tour-editor-labels';
import type { TourEditorDataHandle } from './useTourEditorData';

export interface TourEditorActions {
  /** Κλειδωμένη πράξη σε εξέλιξη — οι φόρμες κλειδώνουν. */
  readonly busy: boolean;
  readonly place: (captureId: string, target: TourPlacementTarget) => Promise<boolean>;
  readonly unplace: (captureId: string) => Promise<boolean>;
  readonly placeArrow: (fromNodeId: string, toNodeId: string, bearingRad: number) => void;
  readonly unlink: (a: string, b: string) => void;
  /** Ο χώρος ενός σημείου (Φ2στ · §4.12) — αισιόδοξα, με «Αναίρεση»· `null` ⇒ ξανά «Σημείο N». */
  readonly name: (nodeId: string, room: TourRoomInput | null) => void;
  /** Κάτοψη ορόφου (Φ2στ-β) — `null` ⇒ χωρίς κάτοψη. */
  readonly choosePlan: (levelKey: TourLevelKey, pick: TourFloorPlanPick | null) => Promise<boolean>;
  /** Κλίμακα της ενεργής κάτοψης (μέτρα ανά pixel εικόνας). */
  readonly calibrate: (levelKey: TourLevelKey, metresPerPixel: number | null) => Promise<boolean>;
  /** Θέση σημείου σε μέτρα κάτοψης — `null` ⇒ εκτός κάτοψης. */
  readonly position: (nodeId: string, point: { readonly x: number; readonly y: number } | null) => void;
  /** Κατεύθυνση λήψης κόσμου — στρέφει και τα βελάκια του σημείου. */
  readonly orient: (captureId: string, headingRad: number) => void;
}

type Graph = Pick<SpatialTour, 'levels' | 'nodes'>;
type CaptureOf = (captureId: string) => Pick<TourCapture, 'headingRad' | 'nodeId'> | undefined;

function optimisticOrient(graph: Graph, command: Extract<TourGraphCommand, { op: 'orient' }>, captureOf: CaptureOf) {
  const capture = captureOf(command.captureId);
  if (capture === undefined || capture.nodeId === null) return null;
  return orientNode(graph, capture.nodeId, command.headingRad - capture.headingRad);
}

/** Η αισιόδοξη εικόνα μιας εντολής — `null` για ό,τι δεν εφαρμόζεται αισιόδοξα. */
function optimisticNodes(command: TourGraphCommand, graph: Graph, captureOf: CaptureOf): readonly TourNode[] | null {
  const result = command.op === 'link' ? linkNodes(graph, command.fromNodeId, command.toNodeId, command.bearingRad)
    : command.op === 'unlink' ? unlinkNodes(graph, command.fromNodeId, command.toNodeId)
    : command.op === 'name' ? nameNode(graph, command.nodeId, command.room)
    : command.op === 'position' ? positionNode(graph, command.nodeId, command.point)
    : command.op === 'orient' ? optimisticOrient(graph, command, captureOf) : null;
  return result?.kind === 'edited' ? result.graph.nodes : null;
}

const SUCCESS_KEY: Record<TourGraphCommand['op'], string> = {
  place: TOUR_EDITOR_KEYS.placed,
  unplace: TOUR_EDITOR_KEYS.removed,
  link: TOUR_EDITOR_KEYS.arrowSaved,
  unlink: TOUR_EDITOR_KEYS.unlinked,
  name: TOUR_EDITOR_KEYS.roomSaved,
  floorplan: TOUR_EDITOR_KEYS.planChosen,
  calibrate: TOUR_EDITOR_KEYS.planCalibrated,
  position: TOUR_EDITOR_KEYS.pointPositioned,
  orient: TOUR_EDITOR_KEYS.pointOriented,
};

/** Ο γράφος της οθόνης (κόμβοι + ενεργές κατόψεις) και οι λήψεις — `null` πριν φορτωθεί. */
function useEditorGraph(load: TourEditorDataHandle['load']): { readonly graph: Graph; readonly captureOf: CaptureOf } | null {
  return useMemo(() => {
    if (load.kind !== 'loaded') return null;
    const { nodes, levels, captures } = load.data;
    return { graph: { nodes, levels: graphLevelsOfViewer(levels) }, captureOf: (id: string) => captures.find((c) => c.id === id) };
  }, [load]);
}

export function useTourEditorActions(subject: TourSubject, data: TourEditorDataHandle): TourEditorActions {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const { success, error } = useNotifications();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(0);
  const { reload, setNodes } = data;
  const editor = useEditorGraph(data.load);

  const runUndo = useCallback(async (commands: readonly TourGraphCommand[]) => {
    for (const command of commands) {
      const result = await editTourGraphFromScreen(subject, command);
      if (result.kind !== 'ok') { error(t(TOUR_EDITOR_KEYS.saveFailed)); break; }
    }
    await reload();
  }, [subject, reload, error, t]);

  const send = useCallback(async (command: TourGraphCommand): Promise<boolean> => {
    if (editor === null) return false;
    const { graph, captureOf } = editor;
    const optimistic = optimisticNodes(command, graph, captureOf);
    if (optimistic !== null) setNodes(optimistic);
    inFlight.current += 1;
    const result = await editTourGraphFromScreen(subject, command);
    inFlight.current -= 1;
    if (result.kind !== 'ok') {
      // Επαναφορά μόνο αν καμία άλλη αλλαγή δεν πέρασε στο μεταξύ — αλλιώς η αλήθεια έρχεται από τη φόρτωση.
      if (optimistic !== null && inFlight.current === 0) setNodes(graph.nodes);
      error(t(result.kind === 'refused' ? TOUR_REFUSAL_KEY[result.reason] : TOUR_EDITOR_KEYS.saveFailed));
      await reload();
      return false;
    }
    const undo = result.value.changed ? inverseOf(command, graph, { headingOf: (id) => captureOf(id)?.headingRad }) : null;
    success(t(SUCCESS_KEY[command.op]), undo === null ? undefined : {
      actions: [{ label: t(TOUR_EDITOR_KEYS.undo), onClick: () => void runUndo(undo) }],
    });
    await reload();
    return true;
  }, [editor, subject, setNodes, reload, success, error, t, runUndo]);

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
    name: (nodeId, room) => void send({ op: 'name', nodeId, room }),
    choosePlan: (levelKey, pick) => locked({ op: 'floorplan', levelKey, plan: pick }),
    calibrate: (levelKey, metresPerPixel) => locked({ op: 'calibrate', levelKey, metresPerPixel }),
    position: (nodeId, point) => void send({ op: 'position', nodeId, point }),
    orient: (captureId, headingRad) => void send({ op: 'orient', captureId, headingRad }),
  };
}
