'use client';

/**
 * @fileoverview **ΟΙ ΠΡΑΞΕΙΣ ΤΗΣ ΟΘΟΝΗΣ ΤΟΠΟΘΕΤΗΣΗΣ** — τοποθέτηση, αφαίρεση, βελάκι, αποσύνδεση, χώρος, κάτοψη, κλίμακα,
 * θέση, προσανατολισμός, αναίρεση (ADR-884 Φ2δ · §4.10 · Φ2στ-β · §4.13).
 * @related `services/spatial-tour/spatial-tour-graph.client.ts` (η ΜΙΑ κλήση) · `lib/spatial-tour/tour-graph-edit.ts` ·
 *   `lib/spatial-tour/tour-plan-edit.ts` (οι **ίδιες** καθαρές αλλαγές με τον διακομιστή — αισιόδοξη εφαρμογή) ·
 *   `lib/spatial-tour/tour-graph-inverse.ts`
 * @module components/spatial-tour/editor/useTourEditorActions
 *
 * 🔑 **Βελάκι · αποσύνδεση · χώρος σημείου · θέση · προσανατολισμός · ΚΑΘΕ πράξη σχήματος χώρου = αισιόδοξα** (πρότυπο
 *   Gmail/Figma): η αλλαγή φαίνεται αμέσως με τη **ΜΙΑ** καθαρή συνάρτηση του γραφέα (`tour-editor-optimistic.ts`), και μετά
 *   έρχεται η αλήθεια του διακομιστή (ξαναφόρτωση). Άρνηση ⇒ επαναφορά + ονομασμένο μήνυμα.
 * 🔑 **Τοποθέτηση · αφαίρεση · κάτοψη · κλίμακα = κλειδωμένα**: νέο σημείο στον διακομιστή · εικόνα που ετοιμάζει ο διακομιστής ·
 *   ξανακλιμάκωση όλου του ορόφου. Μια αισιόδοξη εικόνα εδώ θα ήταν δεύτερη αλήθεια.
 * 🔑 **Νέο σχήμα = οριστικό id στον browser** (Γ3γ-2α, πρότυπο Figma/Linear): το κόβει ο `enterpriseIdService` (N.6) μέσω
 *   `newSpaceId` όταν **γεννιέται** το σχήμα στην οθόνη (Γ3γ-2β — η πρόταση το έχει ήδη, άρα ο προέλεγχος τρέχει την ίδια εντολή)
 *   ⇒ φαίνεται αμέσως, σύρεται/αναιρείται αμέσως· ο διακομιστής ελέγχει πρόθεμα/UUID και ξανακρίνει.
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
  TourRedactionEdit,
  TourShapeMode,
  TourSpaceDraft,
} from '@/lib/spatial-tour/tour-graph-edit';
import { inverseOf } from '@/lib/spatial-tour/tour-graph-inverse';
import { redactionsOf } from '@/lib/spatial-tour/tour-redaction-edit';
import type { TourRoomInput } from '@/lib/spatial-tour/tour-room';
import { graphLevelsOfViewer, viewerLevelsOf } from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import { useNotifications } from '@/providers/NotificationProvider';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { editTourGraphFromScreen } from '@/services/spatial-tour/spatial-tour-graph.client';
import type { SpatialTour, TourLevelKey, TourRedaction, TourSubject } from '@/types/spatial-tour';

import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import { TOUR_EDITOR_KEYS } from './tour-editor-labels';
import { TOUR_REDACTION_KEYS } from './tour-redaction-labels';
import { TOUR_SHAPE_KEYS, tourGraphRefusalKey } from './tour-shape-labels';
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
   * Έγκριση/αλλαγή περιγράμματος χώρου με **ρητή πρόθεση** (`create` με id που κόπηκε ήδη με {@link TourEditorActions.newSpaceId}
   * — Γ3γ-2β: η πρόταση έχει το οριστικό της id από τη γέννησή της, άρα ο προέλεγχος τρέχει την ΙΔΙΑ εντολή — ή `replace`).
   * Αισιόδοξα, με την **ίδια** κρίση (και επικάλυψης) που θα κάνει ο διακομιστής.
   */
  readonly space: (levelKey: TourLevelKey, target: TourShapeTarget, space: TourSpaceDraft) => Promise<boolean>;
  /** Οριστικό id νέου χώρου (N.6, `enterpriseIdService`) — κόβεται **μία** φορά, όταν γεννιέται το σχήμα στην οθόνη. */
  readonly newSpaceId: () => string;
  readonly unspace: (levelKey: TourLevelKey, spaceId: string) => Promise<boolean>;
  /** Νοητή διαχωριστική γραμμή (Δ8.2) — `separationId === null` ⇒ νέα (id κομμένο εδώ), αλλιώς αλλαγή· πάντα αισιόδοξα. */
  readonly separate: (levelKey: TourLevelKey, separationId: string | null, a: TourPlanXY, b: TourPlanXY) => Promise<boolean>;
  readonly unseparate: (levelKey: TourLevelKey, separationId: string) => Promise<boolean>;
  /**
   * **Εφαρμογή του προχείρου θολώματος** μιας λήψης (Φ2ζ ζ3) — **μία** εντολή-δέσμη ⇒ μία επανα-ψήση, μία «Αναίρεση». Όχι αισιόδοξη
   * εικόνα: τα pixel τα φτιάχνει ο ψήστης· η άμεση εικόνα είναι η προεπισκόπηση του προχείρου (shader).
   */
  readonly redactions: (captureId: string, edits: readonly TourRedactionEdit[]) => Promise<boolean>;
  /** Οριστικό id νέου κύκλου θολώματος (N.6) — κόβεται όταν **γεννιέται** ο κύκλος στο πρόχειρο. */
  readonly newRedactionId: () => string;
}

/** Ποιο σχήμα αγγίζει μια εντολή και με ποια πρόθεση (λεξιλόγιο `TOUR_SHAPE_MODES` — ποτέ τυφλό upsert). */
export interface TourShapeTarget {
  readonly mode: TourShapeMode;
  readonly spaceId: string;
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
  redact: TOUR_REDACTION_KEYS.redactionSaved,
  unredact: TOUR_REDACTION_KEYS.redactionRemoved,
  redactions: TOUR_REDACTION_KEYS.applied,
};

interface EditorGraph {
  readonly graph: Graph;
  /** Τα δεδομένα της οθόνης **όπως ήρθαν** — η επαναφορά μετά από άρνηση. */
  readonly screen: TourEditorGraphData;
  readonly captureOf: OptimisticCaptureOf;
  /** Οι θολωμένες περιοχές μιας λήψης **όπως τις βλέπει η οθόνη** — το «πριν» της αναίρεσης (`undefined` ⇒ άγνωστη λήψη). */
  readonly redactionsOf: (captureId: string) => readonly TourRedaction[] | undefined;
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
      redactionsOf: (id: string) => {
        const capture = captures.find((c) => c.id === id);
        return capture === undefined ? undefined : redactionsOf(capture);
      },
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
    const { graph, screen, captureOf, redactionsOf: redactionsBefore } = editor;
    const optimistic = optimisticGraph(command, graph, captureOf);
    if (optimistic !== null) setGraph(screenGraphOf(optimistic));
    inFlight.current += 1;
    const result = await editTourGraphFromScreen(subject, command);
    inFlight.current -= 1;
    if (result.kind !== 'ok') {
      // Επαναφορά μόνο αν καμία άλλη αλλαγή δεν πέρασε στο μεταξύ — αλλιώς η αλήθεια έρχεται από τη φόρτωση.
      if (optimistic !== null && inFlight.current === 0) setGraph(screen);
      const reason = result.kind === 'refused' ? result.reason : null;
      error(t(reason === null ? TOUR_EDITOR_KEYS.saveFailed : tourGraphRefusalKey(reason)));
      await reload();
      return false;
    }
    const undo = result.value.changed ? inverseOf(command, graph, { headingOf: (id) => captureOf(id)?.headingRad, redactionsOf: redactionsBefore }) : null;
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
    // Νέο σχήμα ⇒ το οριστικό id κόβεται στον browser (N.6) — ίδια αισιόδοξη ροή με την αλλαγή/αφαίρεση.
    space: (levelKey, target, space) => send({ op: 'space', levelKey, spaceId: target.spaceId, mode: target.mode, space }),
    newSpaceId: () => enterpriseIdService.generateTourSpaceId(),
    unspace: (levelKey, spaceId) => send({ op: 'unspace', levelKey, spaceId }),
    separate: (levelKey, separationId, a, b) => send(separationId === null
      ? { op: 'separate', levelKey, separationId: enterpriseIdService.generateTourSeparationId(), mode: 'create', a, b }
      : { op: 'separate', levelKey, separationId, mode: 'replace', a, b }),
    unseparate: (levelKey, separationId) => send({ op: 'unseparate', levelKey, separationId }),
    redactions: (captureId, edits) => send({ op: 'redactions', captureId, edits }),
    newRedactionId: () => enterpriseIdService.generateTourRedactionId(),
  };
}
