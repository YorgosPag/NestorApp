'use client';

/**
 * @fileoverview **ΟΙ ΠΡΑΞΕΙΣ ΤΗΣ ΟΘΟΝΗΣ ΤΟΠΟΘΕΤΗΣΗΣ** — τοποθέτηση, αφαίρεση, βελάκι, αποσύνδεση, χώρος, κάτοψη, κλίμακα,
 * θέση, προσανατολισμός, αναίρεση (ADR-884 Φ2δ · §4.10 · Φ2στ-β · §4.13).
 * @related `services/spatial-tour/spatial-tour-graph.client.ts` (η ΜΙΑ κλήση) · `lib/spatial-tour/tour-graph-edit.ts` ·
 *   `lib/spatial-tour/tour-plan-edit.ts` (οι **ίδιες** καθαρές αλλαγές με τον διακομιστή — αισιόδοξη εφαρμογή) ·
 *   `lib/spatial-tour/tour-graph-inverse.ts`
 * @module components/spatial-tour/editor/useTourEditorActions
 *
 * 🔑 **Βελάκι · αποσύνδεση · χώρος σημείου · θέση · προσανατολισμός · αλλαγή/αφαίρεση σχήματος χώρου = αισιόδοξα** (πρότυπο
 *   Gmail/Figma): η αλλαγή φαίνεται αμέσως με τη **ΜΙΑ** καθαρή συνάρτηση του γραφέα (`tour-editor-optimistic.ts`), και μετά
 *   έρχεται η αλήθεια του διακομιστή (ξαναφόρτωση). Άρνηση ⇒ επαναφορά + ονομασμένο μήνυμα.
 * 🔑 **Τοποθέτηση · αφαίρεση · κάτοψη · κλίμακα · ΝΕΟ σχήμα = κλειδωμένα**: νέο id στον διακομιστή (N.6) · εικόνα που
 *   ετοιμάζει ο διακομιστής · ξανακλιμάκωση όλου του ορόφου. Μια αισιόδοξη εικόνα εδώ θα ήταν δεύτερη αλήθεια.
 * 🔑 **Αναίρεση = νέες εντολές μέσα από τον ίδιο γραφέα** (`inverseOf`), ποτέ τοπική στοίβα καταστάσεων. Το «πριν» είναι ο
 *   γράφος της οθόνης **με** τα σχήματα χώρων (Γ3γ-1) — αλλιώς η αναίρεση αλλαγής/αφαίρεσης χώρου δεν θα είχε τι να ξαναγράψει.
 */

import { useCallback, useMemo, useRef, useState } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { optimisticGraph, type OptimisticCaptureOf } from '@/lib/spatial-tour/tour-editor-optimistic';
import type {
  TourFloorPlanPick,
  TourGraphCommand,
  TourPlacementTarget,
  TourPlanXY,
  TourSpaceDraft,
} from '@/lib/spatial-tour/tour-graph-edit';
import { inverseOf } from '@/lib/spatial-tour/tour-graph-inverse';
import { isTourShapeRefusal } from '@/lib/spatial-tour/tour-refusal-vocabulary';
import type { TourRoomInput } from '@/lib/spatial-tour/tour-room';
import { graphLevelsOfViewer, viewerLevelsOf } from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import { useNotifications } from '@/providers/NotificationProvider';
import { editTourGraphFromScreen } from '@/services/spatial-tour/spatial-tour-graph.client';
import type { SpatialTour, TourLevelKey, TourSubject } from '@/types/spatial-tour';

import { TOUR_REFUSAL_KEY } from '../spatial-tour-labels';
import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import { TOUR_EDITOR_KEYS } from './tour-editor-labels';
import { TOUR_SHAPE_KEYS, TOUR_SHAPE_REFUSAL_KEY } from './tour-shape-labels';
import type { TourEditorDataHandle, TourEditorGraphData } from './useTourEditorData';

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
  /**
   * Έγκριση περιγράμματος χώρου (Γ3β) — `spaceId === null` ⇒ νέος (**κλειδωμένο**: το id το κόβει ο διακομιστής, N.6)·
   * αλλαγή υπάρχοντος ⇒ αισιόδοξα, με την **ίδια** κρίση (και επικάλυψης) που θα κάνει ο διακομιστής.
   */
  readonly space: (levelKey: TourLevelKey, spaceId: string | null, space: TourSpaceDraft) => Promise<boolean>;
  readonly unspace: (levelKey: TourLevelKey, spaceId: string) => Promise<boolean>;
  /** Νοητή διαχωριστική γραμμή (Δ8.2) — `separationId === null` ⇒ νέα (κλειδωμένο), αλλιώς αισιόδοξα. */
  readonly separate: (levelKey: TourLevelKey, separationId: string | null, a: TourPlanXY, b: TourPlanXY) => Promise<boolean>;
  readonly unseparate: (levelKey: TourLevelKey, separationId: string) => Promise<boolean>;
}

type Graph = Pick<SpatialTour, 'levels' | 'nodes'>;

/** Ο διαχειριστής βλέπει όλα — ίδια προβολή με το μανιφέστο που του στέλνει ο διακομιστής (`manifestOf`). */
const EDITOR_PROJECTION = { areas: 'shown' } as const;

/** Ο γράφος των καθαρών εντολών ⇒ τα δεδομένα της οθόνης (το αντίστροφο του `useEditorGraph`). */
function screenGraphOf(graph: Graph): TourEditorGraphData {
  return { nodes: graph.nodes, levels: viewerLevelsOf(graph.levels, EDITOR_PROJECTION) };
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
  space: TOUR_SHAPE_KEYS.spaceApproved,
  unspace: TOUR_SHAPE_KEYS.spaceRemoved,
  separate: TOUR_SHAPE_KEYS.separationSaved,
  unseparate: TOUR_SHAPE_KEYS.separationRemoved,
};

interface EditorGraph {
  readonly graph: Graph;
  /** Τα δεδομένα της οθόνης **όπως ήρθαν** — η επαναφορά μετά από άρνηση. */
  readonly screen: TourEditorGraphData;
  readonly captureOf: OptimisticCaptureOf;
}

/** Ο γράφος της οθόνης (κόμβοι + όροφοι με κατόψεις **και σχήματα χώρων**) και οι λήψεις — `null` πριν φορτωθεί. */
function useEditorGraph(load: TourEditorDataHandle['load']): EditorGraph | null {
  return useMemo(() => {
    if (load.kind !== 'loaded') return null;
    const { nodes, levels, captures } = load.data;
    return {
      graph: { nodes, levels: graphLevelsOfViewer(levels) },
      screen: { nodes, levels },
      captureOf: (id: string) => captures.find((c) => c.id === id),
    };
  }, [load]);
}

export function useTourEditorActions(subject: TourSubject, data: TourEditorDataHandle): TourEditorActions {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const { success, error } = useNotifications();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(0);
  const { reload, setGraph } = data;
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
    const { graph, screen, captureOf } = editor;
    const optimistic = optimisticGraph(command, graph, captureOf);
    if (optimistic !== null) setGraph(screenGraphOf(optimistic));
    inFlight.current += 1;
    const result = await editTourGraphFromScreen(subject, command);
    inFlight.current -= 1;
    if (result.kind !== 'ok') {
      // Επαναφορά μόνο αν καμία άλλη αλλαγή δεν πέρασε στο μεταξύ — αλλιώς η αλήθεια έρχεται από τη φόρτωση.
      if (optimistic !== null && inFlight.current === 0) setGraph(screen);
      const reason = result.kind === 'refused' ? result.reason : null;
      error(t(reason === null ? TOUR_EDITOR_KEYS.saveFailed
        : isTourShapeRefusal(reason) ? TOUR_SHAPE_REFUSAL_KEY[reason] : TOUR_REFUSAL_KEY[reason]));
      await reload();
      return false;
    }
    const undo = result.value.changed
      ? inverseOf(command, graph, { headingOf: (id) => captureOf(id)?.headingRad, createdId: result.value.createdId })
      : null;
    success(t(SUCCESS_KEY[command.op]), undo === null ? undefined : {
      actions: [{ label: t(TOUR_EDITOR_KEYS.undo), onClick: () => void runUndo(undo) }],
    });
    await reload();
    return true;
  }, [editor, subject, setGraph, reload, success, error, t, runUndo]);

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
    // Νέο σχήμα ⇒ κλειδωμένο (id στον διακομιστή)· αλλαγή/αφαίρεση υπάρχοντος ⇒ αισιόδοξα.
    space: (levelKey, spaceId, space) => (spaceId === null ? locked : send)({ op: 'space', levelKey, spaceId, space }),
    unspace: (levelKey, spaceId) => send({ op: 'unspace', levelKey, spaceId }),
    separate: (levelKey, separationId, a, b) => (separationId === null ? locked : send)({ op: 'separate', levelKey, separationId, a, b }),
    unseparate: (levelKey, separationId) => send({ op: 'unseparate', levelKey, separationId }),
  };
}
