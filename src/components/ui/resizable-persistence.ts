'use client';

/**
 * @fileoverview **ΠΟΤΕ ΓΡΑΦΕΤΑΙ ΤΟ ΠΛΑΤΟΣ ΕΝΟΣ PANEL** — μία φορά, στο τέλος μιας **χειρονομίας του χρήστη** (ADR-724 §5.2–§5.3).
 * @related `./resizable.tsx` (ο ΕΝΑΣ wrapper της `react-resizable-panels`) · καταναλωτές: `dxf-viewer/layout/WorkspaceSplitLayout.tsx`
 *   (ADR-724) · `spatial-tour/viewer/TourViewer.tsx` (ADR-884 Φ2στ-γ Γ2)
 * @module components/ui/resizable-persistence
 *
 * Ζούσε γραμμένο μέσα στο `WorkspaceSplitLayout`· η στήλη κατόψεων της περιήγησης χρειάστηκε **ακριβώς** την ίδια
 * μηχανική, άρα έγινε ένα σημείο (N.0.2). **Τι** αποθηκεύεται και **πού** μένει στον καταναλωτή (`persist`).
 *
 * ── ΤΑ ΤΕΣΣΕΡΑ ΜΕΤΡΗΜΕΝΑ ΣΗΜΕΙΑ (ADR-724 §14.2 — μη τα «απλοποιήσεις») ──
 *
 * 1. **Κατά το σύρσιμο το πλάτος ζει μόνο στο DOM** (η βιβλιοθήκη γράφει `flex-grow`)· εδώ μόνο σε `ref`. Μηδέν render,
 *    μηδέν localStorage ανά pixel (ADR-040).
 * 2. **Φύλακας πρόθεσης**: το `onLayoutChanged` πυροδοτείται και όταν στενέψει το **παράθυρο** — αν γράφαμε τότε, το
 *    προτιμώμενο πλάτος θα ξεχνιόταν. Γράφουμε μόνο μετά από δείκτη, πλήκτρο ή διπλό κλικ πάνω στο διαχωριστικό.
 * 3. **Η εγγραφή αναβάλλεται ένα καρέ**: το `onLayoutChanged` καλείται **πριν** εφαρμοστεί η διάταξη — μετρημένο
 *    `487,2` αντί για `603,6`. Μετά το `requestAnimationFrame` το DOM είναι η αλήθεια· το `ref` μένει εφεδρεία.
 * 4. **Το πληκτρολόγιο γράφει μόνο του**: η χειρονομία του δεν έχει «απελευθέρωση δείκτη», άρα δεν στοιχηματίζουμε ότι
 *    θα έρθει `onLayoutChanged`. Ίδια συνάρτηση, δύο σκανδάλες — το rAF ακυρώνει το προηγούμενο, άρα **μία** εγγραφή.
 *
 * ⚠️ Το **διπλό κλικ** (επαναφορά στο `defaultSize`) το εκτελεί η **βιβλιοθήκη** (listener σε capture στο `document`)·
 *   εδώ σημειώνεται **μόνο** η πρόθεση, ώστε το store να ακολουθήσει ό,τι εφαρμόστηκε. Δεύτερη `resize()` θα άλλαζε το
 *   μέγεθος **δύο φορές** ανά διπλό κλικ.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { KeyboardEvent, RefObject } from 'react';

import type { PanelSize } from './resizable';

/**
 * Τα πλήκτρα που το WAI-ARIA splitter της `react-resizable-panels@4.7.2` μεταφράζει ΟΝΤΩΣ σε αλλαγή πλάτους (handler `Te`).
 * ⚠️ **Υποσύνολο** του `isDirectionalKey` (`lib/a11y/keyboard-scope.ts`): εκεί η ερώτηση είναι «ποιος κατέχει το πλήκτρο;»·
 * εδώ «ήταν αυτό πρόθεση αλλαγής πλάτους;». Το `Enter` (σύμπτυξη ενός `collapsible` panel) **αλλάζει** πλάτος.
 */
const RESIZE_KEYS: ReadonlySet<string> = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter']);

export interface PanelWidthPersistence {
  /** Στο `elementRef` του panel — η αλήθεια για το πλάτος μετά το flush. */
  readonly elementRef: RefObject<HTMLDivElement | null>;
  /** Στο `onResize` του panel (~60/δευτ. — μόνο `ref`). */
  readonly onResize: (size: PanelSize) => void;
  /** Στο `onLayoutChanged` του group. */
  readonly onLayoutChanged: () => void;
  /** Στο `ResizableHandle`. */
  readonly separatorProps: {
    readonly onPointerDown: () => void;
    readonly onDoubleClick: () => void;
    readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  };
  /** Για χειρονομία **εκτός** διαχωριστικού (π.χ. κουμπί απόκρυψης): γράψε μετά την επόμενη διάταξη. */
  readonly persistSoon: () => void;
}

/** Οι χειριστές που γράφουν το πλάτος ενός panel **μία** φορά ανά χειρονομία. `persist` δέχεται px όπως τα μέτρησε το DOM. */
export function usePanelWidthPersistence(persist: (widthPx: number) => void, initialWidth: number): PanelWidthPersistence {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const measured = useRef(initialWidth);
  const intent = useRef(false);
  const frame = useRef<number | null>(null);
  const write = useRef(persist);
  write.current = persist;

  const persistSoon = useCallback((): void => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const element = elementRef.current;
      write.current(element ? element.getBoundingClientRect().width : measured.current);
    });
  }, []);

  // Η αναβολή δεν επιζεί του component: εγγραφή μετά την αποπροσάρτηση = πλάτος διάταξης που δεν υπάρχει πια.
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);

  return useMemo<PanelWidthPersistence>(() => {
    const markIntent = (): void => { intent.current = true; };
    return {
      elementRef,
      onResize: (size) => { measured.current = size.inPixels; },
      onLayoutChanged: () => {
        if (!intent.current) return;
        intent.current = false;
        persistSoon();
      },
      separatorProps: {
        onPointerDown: markIntent,
        onDoubleClick: markIntent,
        onKeyDown: (event) => {
          if (!RESIZE_KEYS.has(event.key)) return;
          intent.current = true;
          persistSoon();
        },
      },
      persistSoon,
    };
  }, [persistSoon]);
}
