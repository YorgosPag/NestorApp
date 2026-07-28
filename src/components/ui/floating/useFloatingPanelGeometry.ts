'use client';

/**
 * ADR-723 — Η **μία** αποθήκη γεωμετρίας μιας αιωρούμενης παλέτας.
 *
 * Συνθέτει τρία κομμάτια που μέχρι τώρα δεν συνυπήρχαν πουθενά:
 *   1. {@link useDraggable}  — θέση (υπάρχον SSoT, ADR-176 pointer events, ADR-030 όρια)
 *   2. {@link useResizable}  — μέγεθος (ADR-723)
 *   3. {@link readPanelGeometry} / {@link writePanelGeometry} — μνήμη ανά χρήστη (ADR-723)
 *
 * ── ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ HOOK ΚΑΙ ΟΧΙ ΜΕΣΑ ΣΤΟ `FloatingPanel.tsx` ──
 *
 * Το `FloatingPanel.tsx` είναι ήδη ~460 γραμμές· η σύνθεση των τριών προσθέτει ~130 λογικής και
 * θα το περνούσε το όριο των 500 (N.7.1). Πιο ουσιαστικά: το component είναι **απόδοση**, αυτό
 * εδώ είναι **κατάσταση**. Ο διαχωρισμός επιτρέπει να ελεγχθεί η γεωμετρία χωρίς να αποδοθεί
 * ούτε ένα `<Card>`.
 *
 * ── Η ΣΕΙΡΑ ΠΟΥ ΕΧΕΙ ΣΗΜΑΣΙΑ ──
 *
 * Η αποθηκευμένη γεωμετρία διαβάζεται στο **πρώτο** render (lazy `useState` initializer), όχι σε
 * `useEffect`. Ο λόγος είναι το `useDraggable`, που δέχεται `initialPosition` **μόνο** κατά την
 * αρχικοποίηση του δικού του state: αν η επαναφορά ερχόταν από effect, η παλέτα θα εμφανιζόταν
 * για ένα frame στην προεπιλεγμένη θέση και μετά θα πηδούσε. Η ανάγνωση localStorage στο πρώτο
 * render είναι ασφαλής ως προς hydration επειδή το `FloatingPanel` επιστρέφει `null` μέχρι το
 * `isMounted` — δηλαδή το πρώτο render **δεν** παράγει DOM προς σύγκριση.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { useDraggable, type DraggableOptions } from '@/hooks/useDraggable';
import { useResizable, type ResizeEdge } from '@/hooks/useResizable';
import {
  DEFAULT_MIN_PANEL_SIZE,
  clampPanelGeometry,
  isPanelGeometryWithinBounds,
  panelDragBounds,
  type PanelGeometry,
  type PanelPosition,
  type PanelSize,
  type ViewportSize,
} from './floating-panel-geometry';
import {
  readPanelGeometry,
  writePanelGeometry,
  type FloatingPanelId,
} from './floating-panel-persistence';

// ============================================================================
// ΤΥΠΟΙ
// ============================================================================

export interface UseFloatingPanelGeometryOptions {
  /** Ορατότητα — προωθείται στο {@link useDraggable} για τη λογική auto-center. */
  readonly isVisible: boolean;
  /** Θέση όταν δεν υπάρχει αποθηκευμένη. */
  readonly defaultPosition: PanelPosition;
  /** Μέγεθος όταν δεν υπάρχει αποθηκευμένο. */
  readonly defaultSize: PanelSize;
  /** Ενεργοποιεί τις 8 λαβές. Όταν `false`, το μέγεθος μένει στο `defaultSize`. */
  readonly resizable?: boolean;
  readonly minSize?: PanelSize;
  readonly maxSize?: PanelSize;
  /**
   * Ταυτότητα για μόνιμη αποθήκευση θέσης/μεγέθους. Όταν λείπει, **τίποτα δεν αποθηκεύεται** —
   * ρητή επιλογή, ώστε οι 17 υπάρχουσες παλέτες να μη γίνουν σιωπηλά persistent.
   */
  readonly persistenceKey?: FloatingPanelId;
  /** Προωθείται αυτούσιο στο {@link useDraggable} (π.χ. `getClientPosition`). */
  readonly draggableOptions?: Partial<DraggableOptions>;
}

export interface FloatingPanelGeometryState {
  readonly position: PanelPosition;
  readonly size: PanelSize;
  readonly isDragging: boolean;
  readonly isResizing: boolean;
  readonly activeEdge: ResizeEdge | null;
  readonly elementRef: React.RefObject<HTMLDivElement>;
  /**
   * Ίδια υπογραφή με το `DraggableState.handleMouseDown` (ADR-176: η υλοποίηση δέχεται και
   * `PointerEvent`, αλλά ο δηλωμένος τύπος του SSoT είναι `MouseEvent` — δεν τον διευρύνουμε
   * εδώ, γιατί θα ήταν δεύτερη, ασύμφωνη δήλωση της ίδιας συνάρτησης).
   */
  readonly handleMouseDown: (event: React.MouseEvent) => void;
  readonly startResize: (edge: ResizeEdge, event: React.PointerEvent) => void;
}

// ============================================================================
// ΙΔΙΩΤΙΚΑ ΒΟΗΘΗΤΙΚΑ
// ============================================================================

/** SSR-safe ανάγνωση viewport. Στον server δίνει 0×0 ⇒ κάθε clamp είναι no-op. */
function readViewport(): ViewportSize {
  if (typeof window === 'undefined') return { width: 0, height: 0 };
  return { width: window.innerWidth, height: window.innerHeight };
}

/**
 * Παρακολουθεί το μέγεθος του παραθύρου, με **συγχώνευση σε frame**.
 *
 * Το `resize` πυροδοτείται δεκάδες φορές ανά δευτερόλεπτο όσο ο χρήστης σέρνει τη γωνία του
 * παραθύρου. Χωρίς rAF coalescing, κάθε συμβάν θα προκαλούσε render της παλέτας — και η παλέτα
 * του Διαχειριστή Στρώσεων αποδίδει 58 σειρές. Ένα render ανά frame είναι το σωστό ταβάνι
 * (ίδιο σχήμα με τον `UnifiedFrameScheduler` του viewer).
 *
 * Ιδιωτικό επίτηδες: αν εξαγόταν, θα γινόταν δεύτερο, ανεπίσημο SSoT για το «μέγεθος παραθύρου».
 */
function useViewport(): ViewportSize {
  const [viewport, setViewport] = useState<ViewportSize>(readViewport);

  useEffect(() => {
    let frame = 0;
    const onResize = (): void => {
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const next = readViewport();
        // Ταυτότητα-φύλακας: ίδιες διαστάσεις ⇒ ίδιο αντικείμενο ⇒ κανένα render παρακάτω.
        setViewport((prev) =>
          prev.width === next.width && prev.height === next.height ? prev : next,
        );
      });
    };

    window.addEventListener('resize', onResize);
    // Πρώτη μέτρηση μετά το mount: το initializer έτρεξε πιθανώς σε SSR context (0×0).
    onResize();

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return viewport;
}

// ============================================================================
// ΤΟ HOOK
// ============================================================================

export function useFloatingPanelGeometry(
  options: UseFloatingPanelGeometryOptions,
): FloatingPanelGeometryState {
  const {
    isVisible,
    defaultPosition,
    defaultSize,
    resizable = false,
    minSize = DEFAULT_MIN_PANEL_SIZE,
    maxSize,
    persistenceKey,
    draggableOptions,
  } = options;

  const viewport = useViewport();

  /**
   * Επαναφορά — **μία φορά**, στο πρώτο render.
   *
   * Το αποτέλεσμα περνά υποχρεωτικά από `clampPanelGeometry`: η αποθηκευμένη θέση είναι
   * ιστορικό, όχι αλήθεια (η οθόνη μπορεί να έχει αλλάξει). Δες το τεκμηριωμένο ελάττωμα
   * «palette lost off-screen» στο `floating-panel-geometry.ts`.
   */
  const [restored] = useState<PanelGeometry | null>(() => {
    if (!persistenceKey) return null;
    const stored = readPanelGeometry(persistenceKey);
    if (!stored) return null;
    const measured = readViewport();
    // Πριν το mount δεν υπάρχει viewport (SSR): κρατάμε την τιμή ωμή και η διάσωση θα τρέξει
    // στο πρώτο πραγματικό `useViewport` — ποτέ δεν εφαρμόζεται μη-επικυρωμένη γεωμετρία,
    // γιατί το component δεν αποδίδει πριν το mount.
    if (measured.width === 0 || measured.height === 0) return stored;
    return clampPanelGeometry(stored, measured, minSize, maxSize);
  });

  const [size, setSize] = useState<PanelSize>(() =>
    restored ? { width: restored.width, height: restored.height } : defaultSize,
  );

  // Τα όρια θέσης εξαρτώνται από το **τρέχον** πλάτος/ύψος — γι' αυτό υπολογίζονται εδώ και όχι
  // από το σταθερό `defaultSize`. Ίδια συνάρτηση με την επαναφορά ⇒ αδύνατο να αποκλίνουν.
  const bounds = useMemo(() => panelDragBounds(size, viewport), [size, viewport]);

  /**
   * ⚠️ Η ΑΠΟΘΗΚΕΥΜΕΝΗ ΘΕΣΗ ΝΙΚΑ ΤΟΝ ΥΠΟΛΟΓΙΣΤΗ ΘΕΣΗΣ.
   *
   * Το `getClientPosition` του {@link useDraggable} τρέχει σε effect **μετά** το mount και κάνει
   * άνευ όρων `setPosition(...)`. Αν περνούσε μαζί με επαναφορά, θα έσβηνε τη θέση που μόλις
   * θυμηθήκαμε — η παλέτα θα «θυμόταν» για ένα frame και μετά θα πηδούσε στην προεπιλογή.
   * Ο υπολογιστής είναι **αρχική τοποθέτηση**, όχι κανόνας: όταν υπάρχει προτίμηση χρήστη,
   * αποσύρεται.
   */
  const effectiveDraggableOptions = useMemo(() => {
    if (!restored || !draggableOptions?.getClientPosition) return draggableOptions;
    const rest: Partial<DraggableOptions> = { ...draggableOptions };
    delete rest.getClientPosition;
    return rest;
  }, [restored, draggableOptions]);

  const {
    position,
    isDragging,
    elementRef,
    handleMouseDown,
    setPosition,
  } = useDraggable(isVisible, {
    initialPosition: restored ? { x: restored.x, y: restored.y } : defaultPosition,
    autoCenter: false,
    elementWidth: size.width,
    elementHeight: size.height,
    minPosition: bounds.min,
    maxPosition: bounds.max,
    ...effectiveDraggableOptions,
  });

  const persist = useCallback(
    (geometry: PanelGeometry): void => {
      if (persistenceKey) writePanelGeometry(persistenceKey, geometry);
    },
    [persistenceKey],
  );

  const handleResize = useCallback(
    (next: PanelGeometry): void => {
      setSize({ width: next.width, height: next.height });
      // Οι βόρειες/δυτικές λαβές μετακινούν **και** τη θέση (το απέναντι περίγραμμα μένει
      // καρφωμένο). Περνά από το `setPosition` του draggable, ώστε ο κανόνας ορίων να είναι ο
      // ίδιος είτε ο χρήστης σέρνει είτε αλλάζει μέγεθος.
      setPosition({ x: next.x, y: next.y });
    },
    [setPosition],
  );

  const { isResizing, activeEdge, startResize } = useResizable({
    enabled: resizable,
    position,
    size,
    minSize,
    maxSize,
    onResize: handleResize,
    // Persist στο τέλος της χειρονομίας, όχι σε κάθε frame: μία εγγραφή αντί για ~60/δευτ.
    onResizeEnd: persist,
  });

  /**
   * Persist στο **τέλος** ενός συρσίματος.
   *
   * Το `useDraggable` δεν εκθέτει `onDragEnd`, οπότε η κατερχόμενη ακμή του `isDragging`
   * ανιχνεύεται εδώ. Ο έλεγχος `wasDragging` είναι απαραίτητος: χωρίς αυτόν το effect θα
   * έγραφε σε **κάθε** render (mount, αλλαγή μεγέθους παραθύρου, re-render γονέα).
   */
  const wasDraggingRef = useRef(false);
  useEffect(() => {
    const wasDragging = wasDraggingRef.current;
    wasDraggingRef.current = isDragging;
    if (wasDragging && !isDragging) {
      persist({ ...position, ...size });
    }
  }, [isDragging, position, size, persist]);

  /**
   * Η ΔΙΑΣΩΣΗ — η παλέτα δεν μπορεί δομικά να χαθεί εκτός οθόνης.
   *
   * Τρέχει σε κάθε αλλαγή viewport (μικρότερο παράθυρο, αποσύνδεση οθόνης, περιστροφή tablet,
   * άνοιγμα devtools). Ο έλεγχος `isPanelGeometryWithinBounds` **πρώτα** σημαίνει ότι στη
   * συνήθη περίπτωση δεν γράφεται state ⇒ κανένα render.
   *
   * Δεν τρέχει όσο ο χρήστης κρατά τον δείκτη: το να «διορθώνεις» τη γεωμετρία μέσα σε
   * χειρονομία παράγει μάχη ανάδρασης με τον ίδιο τον χρήστη.
   */
  useEffect(() => {
    if (viewport.width === 0 || viewport.height === 0) return;
    if (isDragging || isResizing) return;

    const current: PanelGeometry = { ...position, ...size };
    if (isPanelGeometryWithinBounds(current, viewport, minSize, maxSize)) return;

    const rescued = clampPanelGeometry(current, viewport, minSize, maxSize);
    setSize({ width: rescued.width, height: rescued.height });
    setPosition({ x: rescued.x, y: rescued.y });
    // Χωρίς persist: το `resize` του παραθύρου είναι συχνά προσωρινό (μεγιστοποίηση/επαναφορά).
    // Η αποθηκευμένη προτίμηση διατηρείται· ο χρήστης δεν «χάνει» τη διάταξή του επειδή
    // μίκρυνε στιγμιαία το παράθυρο. Η νέα θέση αποθηκεύεται μόλις τη μετακινήσει ο ίδιος.
  }, [viewport, position, size, isDragging, isResizing, minSize, maxSize, setPosition]);

  return {
    position,
    size,
    isDragging,
    isResizing,
    activeEdge,
    elementRef,
    handleMouseDown,
    startResize,
  };
}
