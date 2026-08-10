'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL — ΔΙΑΒΑΣΕ ADR-040 ΠΡΙΝ ΑΛΛΑΞΕΙΣ
 *
 * ADR-782 §23 — ο χειριστής δείκτη της **χειροκίνητης τοποθέτησης** υποβάθρου.
 *
 * ## Τι κάνει, και τι σκόπιμα ΔΕΝ κάνει
 * Μεταφράζει εικονοστοιχεία σε **χαρτί** και καλεί τα καθαρά μαθηματικά του
 * `basemap-placement`. Καμία γεωμετρία δεν γεννιέται εδώ· καμία απόφαση προτεραιότητας δεν
 * λαμβάνεται εδώ (ζει στο `basemap-frame`)· καμία κατάσταση δεν κρατιέται σε React state.
 *
 * ## ADR-040 — γιατί δεν υπάρχει καμία συνδρομή υψηλής συχνότητας
 * Το `transform` διαβάζεται **τη στιγμή του γεγονότος** με `getImmediateTransform()` (Φάση
 * XXII.B), όχι ως στιγμιότυπο μέσω props. Ένα στιγμιότυπο θα ήταν **μπαγιάτικο** ακριβώς όταν
 * μετράει: ο χρήστης μπορεί να κάνει zoom με τη ρόδα **μέσα** στο σύρσιμο, και τότε η ίδια
 * μετατόπιση δείκτη αντιστοιχεί σε άλλη απόσταση στο χαρτί. Το ίδιο μάθημα με τους handlers
 * του `guide-click-handlers` / `useCanvasContextMenu` (getter, ποτέ snapshot).
 *
 * ## Γιατί `setPointerCapture`
 * Το σύρσιμο του χάρτη βγαίνει συχνά **έξω** από τον καμβά (ο χρήστης τραβά προς τη μπάρα
 * ορόφων). Χωρίς capture, το `pointerup` χάνεται και η χειρονομία μένει «κολλημένη»: ο χάρτης
 * θα συνέχιζε να ακολουθεί τον δείκτη χωρίς πατημένο κουμπί. Ίδιο πρότυπο με το
 * `use-opening-tag-drag-interaction`.
 *
 * @see ../../systems/basemap/basemap-placement.ts — τα μαθηματικά
 * @see ../../systems/basemap/basemap-placement-session.ts — η κατάσταση της συνεδρίας
 */

import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import {
  getPointerSnapshotFromElement,
  getScreenPosFromEvent,
  screenToWorldWithSnapshot,
} from '../../rendering/core/CoordinateTransforms';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { getBasemapFrame } from '../../systems/basemap/basemap-frame';
import { setBasemapPlacement } from '../../systems/basemap/basemap-placement-store';
import {
  panBasemapFrame,
  rotateBasemapFrame,
  placeBasemapByCorrespondences,
} from '../../systems/basemap/basemap-placement';
import {
  addPlacementCorrespondence,
  beginPlacementGesture,
  endPlacementGesture,
  getBasemapPlacementSession,
  setPlacementPendingDrawing,
} from '../../systems/basemap/basemap-placement-session';
import { makeWorldToDisplayProjector } from '../../systems/geo-referencing/geo-transform';

/**
 * Πού βρίσκεται ο δείκτης πάνω στο **χαρτί** (τοπικά canonical mm), ή `null` όταν το στοιχείο
 * δεν έχει ακόμη διαστάσεις.
 *
 * ⚠️ Το `null` **δεν** αγνοείται σιωπηλά από τους καλούντες: μια χειρονομία που ξεκινά χωρίς
 * γνωστό σημείο θα υπολόγιζε μετατόπιση από το `(0,0)` και θα εκτόξευε τον χάρτη μακριά.
 */
function pointerDisplayPoint(
  element: HTMLElement | null,
  event: { clientX: number; clientY: number },
): Point2D | null {
  const snapshot = getPointerSnapshotFromElement(element);
  if (!snapshot) return null;
  const screen = getScreenPosFromEvent(event, snapshot);
  return screenToWorldWithSnapshot(screen, getImmediateTransform(), snapshot);
}

export interface BasemapPlacementPointerHandlers {
  readonly onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  readonly onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  readonly onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  /** Ξεκινά **στροφή** αντί για μετατόπιση — το καλεί η λαβή, όχι η επιφάνεια. */
  readonly onRotateHandleDown: (event: ReactPointerEvent<HTMLElement>) => void;
}

export function useBasemapPlacementInteraction(): BasemapPlacementPointerHandlers {
  /** Το τελευταίο σημείο του δείκτη σε χαρτί — η αναφορά της επόμενης κίνησης. */
  const lastRef = useRef<Point2D | null>(null);
  /** Ο άξονας της στροφής, παγωμένος στην αρχή της χειρονομίας. */
  const pivotRef = useRef<Point2D | null>(null);

  const start = useCallback(
    (event: ReactPointerEvent<HTMLElement>, gesture: 'drag' | 'rotate'): void => {
      const frame = getBasemapFrame();
      const display = pointerDisplayPoint(event.currentTarget, event);
      if (!frame || !display) return;

      event.currentTarget.setPointerCapture(event.pointerId);
      lastRef.current = display;
      // Ο άξονας είναι το σημείο **γύρω** από το οποίο στρίβει ο χάρτης: η αρχή του σχεδίου, που
      // είναι και το σημείο που δηλώνει η άγκυρα (basemap-frame). Έτσι η στροφή είναι η ίδια
      // πράξη με το «πόσο στραμμένο είναι το οικόπεδο ως προς τον βορρά».
      pivotRef.current = { x: 0, y: 0 };
      beginPlacementGesture(gesture, frame.geo);
      event.stopPropagation();
    },
    [],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      const session = getBasemapPlacementSession();
      if (!session.active) return;
      if (session.tool === 'match') {
        capturePick(event);
        return;
      }
      start(event, 'drag');
    },
    [start],
  );

  const onRotateHandleDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      if (!getBasemapPlacementSession().active) return;
      start(event, 'rotate');
    },
    [start],
  );

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>): void => {
    const session = getBasemapPlacementSession();
    const previous = lastRef.current;
    const pivot = pivotRef.current;
    if (session.gesture === 'none' || !previous || !pivot) return;

    const display = pointerDisplayPoint(event.currentTarget, event);
    const frame = getBasemapFrame();
    if (!display || !frame) return;

    const next =
      session.gesture === 'drag'
        ? panBasemapFrame(frame.geo, previous, display)
        : rotateBasemapFrame(frame.geo, pivot, previous, display);
    setBasemapPlacement(next);
    lastRef.current = display;
  }, []);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    lastRef.current = null;
    pivotRef.current = null;
    endPlacementGesture();
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp, onRotateHandleDown };
}

/**
 * Το εργαλείο **αντιστοίχισης**: πρώτο κλικ = σημείο του σχεδίου, δεύτερο = το ίδιο σημείο πάνω
 * στον χάρτη.
 *
 * 🔑 Το δεύτερο κλικ μετατρέπεται **αμέσως** σε απόλυτη συντεταγμένη κόσμου, με το πλαίσιο που
 * ισχύει **εκείνη τη στιγμή** — δες `PlacementCorrespondence` για το γιατί αυτό είναι το μόνο
 * που κάνει τη δεύτερη αντιστοίχιση να μη διαψεύδει την πρώτη.
 */
function capturePick(event: ReactPointerEvent<HTMLElement>): void {
  const display = pointerDisplayPoint(event.currentTarget, event);
  const frame = getBasemapFrame();
  if (!display || !frame) return;
  event.stopPropagation();

  const session = getBasemapPlacementSession();
  if (!session.pendingDrawing) {
    setPlacementPendingDrawing(display);
    return;
  }

  const world = makeWorldToDisplayProjector(frame.geo).unproject(display.x, display.y);
  const pair = { drawing: session.pendingDrawing, world };
  addPlacementCorrespondence(pair);

  // Λύνεται **από την αρχή** με όλες τις αντιστοιχίες, όχι σταδιακά: οι συντεταγμένες κόσμου
  // είναι απόλυτες, άρα η επανάληψη είναι ιδεοδύναμη — η δεύτερη αντιστοίχιση **διορθώνει** την
  // πρώτη αντί να συσσωρεύεται πάνω της.
  const pairs = [...session.correspondences, pair].slice(-2);
  setBasemapPlacement(placeBasemapByCorrespondences(frame.geo, pairs));
}
