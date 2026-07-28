'use client';

/**
 * ADR-723 — `useResizable`: αλλαγή μεγέθους αιωρούμενου panel από τις 8 άκρες/γωνίες.
 *
 * Αδελφός του {@link useDraggable} — **ίδιο** λεξιλόγιο (Pointer Events / ADR-176, pointer
 * capture, document listeners, καθαρό TypeScript χωρίς `any`) ώστε τα δύο να συντίθενται
 * χωρίς εκπλήξεις.
 *
 * ── ΓΙΑΤΙ ΓΡΑΦΤΗΚΕ ΑΝΤΙ ΓΙΑ ΕΞΑΡΤΗΣΗ ──
 *
 * Το repo έχει ήδη `react-resizable-panels` (MIT), αλλά λύνει **άλλο** πρόβλημα: split-pane
 * groups με διαχωριστικά μέσα σε ροή διάταξης (`PanelGroup` / `Separator`). Δεν αλλάζει μέγεθος
 * ένα ελεύθερα τοποθετημένο `position: fixed` στοιχείο, και δεν έχει έννοια «η βόρεια άκρη
 * μετακινεί και τη θέση». Οι εναλλακτικές του κλάδου (`re-resizable`, `react-rnd`) θα
 * πρόσθεταν εξάρτηση για ~120 γραμμές λογικής που ούτως ή άλλως πρέπει να δένουν με τον
 * υπάρχοντα κανόνα ορίων (ADR-030). Άρα: καμία νέα εξάρτηση (ο κανόνας N.5 δεν ενεργοποιείται).
 *
 * ── ΓΙΑΤΙ ΕΛΕΓΧΟΜΕΝΟ (controlled) ──
 *
 * Ο κάτοχος της γεωμετρίας είναι **ένας**: το `useFloatingPanelGeometry`. Αν το hook κρατούσε
 * δικό του `size` state, θα υπήρχαν δύο αλήθειες τη στιγμή της επαναφοράς από localStorage και
 * της διάσωσης στο `window.resize` — ακριβώς το σχήμα που παράγει «το panel πήδηξε πίσω».
 * Εδώ το hook είναι **μηχανισμός**, όχι αποθήκη: παίρνει την τρέχουσα γεωμετρία, επιστρέφει την
 * επόμενη.
 *
 * @see ./useDraggable — ο αδελφός για τη θέση
 * @see @/components/ui/floating/floating-panel-geometry — ο κανόνας ορίων
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import {
  DEFAULT_MIN_PANEL_SIZE,
  type PanelGeometry,
  type PanelPosition,
  type PanelSize,
} from '@/components/ui/floating/floating-panel-geometry';

// ============================================================================
// ΤΥΠΟΙ
// ============================================================================

/**
 * Η άκρη ή γωνία από την οποία ξεκίνησε η αλλαγή μεγέθους.
 *
 * Σύμβαση σημείων του ορίζοντα (n/s/e/w), όπως σε κάθε window manager και στο CSS
 * `resize`/`cursor` (`nwse-resize`, `nesw-resize`, …) — άρα το `cursor` προκύπτει από το id
 * χωρίς πίνακα αντιστοίχισης.
 */
export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Και οι 8 λαβές, σε σταθερή σειρά — για απόδοση χωρίς literal πίνακα στο component. */
export const RESIZE_EDGES: readonly ResizeEdge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

export interface UseResizableOptions {
  /** Όταν `false`, το {@link UseResizableResult.startResize} είναι no-op. */
  readonly enabled?: boolean;
  /** Τρέχουσα θέση πάνω-αριστερής γωνίας (ελεγχόμενη από τον καλούντα). */
  readonly position: PanelPosition;
  /** Τρέχον μέγεθος (ελεγχόμενο από τον καλούντα). */
  readonly size: PanelSize;
  /** Κάτω όριο. Προεπιλογή {@link DEFAULT_MIN_PANEL_SIZE}. */
  readonly minSize?: PanelSize;
  /** Προαιρετικό πάνω όριο — πέρα από το viewport, που επιβάλλεται ούτως ή άλλως. */
  readonly maxSize?: PanelSize;
  /** Καλείται σε κάθε κίνηση δείκτη με τη νέα γεωμετρία (θέση **και** μέγεθος). */
  readonly onResize: (geometry: PanelGeometry) => void;
  /** Καλείται μία φορά στο `pointerup` — το σημείο όπου αξίζει να γίνει persist. */
  readonly onResizeEnd?: (geometry: PanelGeometry) => void;
}

export interface UseResizableResult {
  /** `true` όσο κρατιέται μια λαβή — ο καλών σβήνει transitions και επιλογή κειμένου. */
  readonly isResizing: boolean;
  /** Η άκρη που κρατιέται, ή `null`. Χρήσιμο για οπτική έμφαση της ενεργής λαβής. */
  readonly activeEdge: ResizeEdge | null;
  /** Σύνδεσέ το στο `onPointerDown` κάθε λαβής. */
  readonly startResize: (edge: ResizeEdge, event: React.PointerEvent) => void;
}

/** Η αμετάβλητη αφετηρία μιας χειρονομίας — παγώνεται στο `pointerdown`. */
export interface ResizeOrigin {
  readonly edge: ResizeEdge;
  readonly pointerX: number;
  readonly pointerY: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

// ============================================================================
// ΚΑΘΑΡΟΣ ΠΥΡΗΝΑΣ — εξάγεται για jest χωρίς DOM
// ============================================================================

/** Το γράμμα υπάρχει στο id της άκρης; (`'ne'` περιέχει `'n'` και `'e'`) */
function has(edge: ResizeEdge, letter: 'n' | 's' | 'e' | 'w'): boolean {
  return edge.includes(letter);
}

function clampTo(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/**
 * Η νέα γεωμετρία για δεδομένη αφετηρία και μετατόπιση δείκτη.
 *
 * ── ΤΟ ΣΗΜΕΙΟ ΠΟΥ ΤΑ ΠΕΡΙΣΣΟΤΕΡΑ RESIZE ΤΟ ΚΑΝΟΥΝ ΛΑΘΟΣ ──
 *
 * Στις άκρες **βόρεια/δυτικά** το σταθερό σημείο είναι η **απέναντι** άκρη: μεγαλώνοντας προς
 * τα αριστερά, το δεξί περίγραμμα δεν επιτρέπεται να κουνηθεί. Άρα η θέση **πρέπει** να
 * μετακινηθεί κατά ό,τι άλλαξε το μέγεθος. Ο αφελής υπολογισμός (`width -= dx` χωρίς
 * `x += dx`) παράγει panel που «γλιστράει» — και χειρότερα, όταν φτάσει στο ελάχιστο πλάτος
 * συνεχίζει να μετακινείται. Γι' αυτό η θέση υπολογίζεται από το **περιορισμένο** μέγεθος
 * (`x + (width - nextWidth)`) και όχι από το ωμό `dx`: στο ελάχιστο, το `nextWidth` παύει να
 * αλλάζει ⇒ παύει και η θέση. Δομικά αδύνατο να γλιστρήσει.
 *
 * Το πάνω όριο μεγέθους στις βόρειες/δυτικές άκρες κόβεται επιπλέον στο `origin.y + height` /
 * `origin.x + width`: η παλέτα σταματά να μεγαλώνει όταν η άκρη της φτάσει στην κορυφή /
 * αριστερή πλευρά του viewport, αντί να συνεχίσει «κάτω από» την οθόνη.
 */
export function computeResizedGeometry(
  origin: ResizeOrigin,
  pointerX: number,
  pointerY: number,
  minSize: PanelSize,
  maxSize: PanelSize,
): PanelGeometry {
  const dx = pointerX - origin.pointerX;
  const dy = pointerY - origin.pointerY;

  let width = origin.width;
  let height = origin.height;
  let x = origin.x;
  let y = origin.y;

  if (has(origin.edge, 'e')) {
    width = clampTo(origin.width + dx, minSize.width, maxSize.width);
  } else if (has(origin.edge, 'w')) {
    // Δεν μεγαλώνει πέρα από την αριστερή άκρη του viewport (x ≥ 0).
    const maxWidth = Math.min(maxSize.width, origin.x + origin.width);
    width = clampTo(origin.width - dx, minSize.width, maxWidth);
    x = origin.x + (origin.width - width);
  }

  if (has(origin.edge, 's')) {
    height = clampTo(origin.height + dy, minSize.height, maxSize.height);
  } else if (has(origin.edge, 'n')) {
    // Δεν μεγαλώνει πέρα από την κορυφή του viewport (y ≥ 0) — εκεί χάνεται η επικεφαλίδα.
    const maxHeight = Math.min(maxSize.height, origin.y + origin.height);
    height = clampTo(origin.height - dy, minSize.height, maxHeight);
    y = origin.y + (origin.height - height);
  }

  return { x, y, width, height };
}

/** `cursor` για κάθε άκρη — προκύπτει από τα γράμματα, χωρίς πίνακα 8 εγγραφών. */
export function resizeCursorFor(edge: ResizeEdge): string {
  if (edge === 'n' || edge === 's') return 'ns-resize';
  if (edge === 'e' || edge === 'w') return 'ew-resize';
  if (edge === 'ne' || edge === 'sw') return 'nesw-resize';
  return 'nwse-resize';
}

// ============================================================================
// ΤΟ HOOK
// ============================================================================

export function useResizable(options: UseResizableOptions): UseResizableResult {
  const {
    enabled = true,
    position,
    size,
    minSize = DEFAULT_MIN_PANEL_SIZE,
    maxSize,
    onResize,
    onResizeEnd,
  } = options;

  const [activeEdge, setActiveEdge] = useState<ResizeEdge | null>(null);
  const originRef = useRef<ResizeOrigin | null>(null);
  const latestRef = useRef<PanelGeometry | null>(null);

  // Οι callbacks μέσω ref: το effect των listeners εξαρτάται **μόνο** από το `activeEdge`, άρα
  // δεν ξαναγράφεται σε κάθε render όσο σέρνεται η λαβή (ένα add/remove ανά χειρονομία).
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;
  const onResizeEndRef = useRef(onResizeEnd);
  onResizeEndRef.current = onResizeEnd;
  const limitsRef = useRef({ minSize, maxSize });
  limitsRef.current = { minSize, maxSize };

  const startResize = useCallback(
    (edge: ResizeEdge, event: React.PointerEvent): void => {
      if (!enabled) return;
      // Μόνο κύριο κουμπί: το δεξί κλικ ανοίγει μενού, το μεσαίο κάνει autoscroll.
      if (event.button !== 0) return;

      // Η λαβή ζει ΜΕΣΑ στην επικεφαλίδα/περίγραμμα, όπου κάθεται και ο handler του
      // συρσίματος. Χωρίς αυτό, μία χειρονομία θα ξεκινούσε ΚΑΙ σύρσιμο ΚΑΙ resize.
      event.preventDefault();
      event.stopPropagation();

      // Pointer capture στη λαβή: το `pointermove` συνεχίζει να φτάνει ακόμη κι όταν ο δείκτης
      // φύγει από το στοιχείο ή περάσει πάνω από iframe/canvas (ADR-176).
      event.currentTarget.setPointerCapture?.(event.pointerId);

      originRef.current = {
        edge,
        pointerX: event.clientX,
        pointerY: event.clientY,
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
      };
      latestRef.current = { ...position, ...size };
      setActiveEdge(edge);
    },
    [enabled, position, size],
  );

  useEffect(() => {
    if (activeEdge === null) return;

    const handlePointerMove = (event: PointerEvent): void => {
      const origin = originRef.current;
      if (!origin) return;

      const { minSize: min, maxSize: max } = limitsRef.current;
      // Το viewport είναι το φυσικό πάνω όριο: panel μεγαλύτερο από την οθόνη έχει περιεχόμενο
      // που δεν φτάνεις ποτέ. Διαβάζεται ανά κίνηση ώστε να ισχύει ακόμη κι αν ο χρήστης
      // αλλάξει μέγεθος παραθύρου ΕΝΩ κρατά τη λαβή.
      const bound: PanelSize = {
        width: Math.min(max?.width ?? Number.POSITIVE_INFINITY, window.innerWidth),
        height: Math.min(max?.height ?? Number.POSITIVE_INFINITY, window.innerHeight),
      };

      const next = computeResizedGeometry(origin, event.clientX, event.clientY, min, bound);
      latestRef.current = next;
      onResizeRef.current(next);
    };

    const handlePointerUp = (): void => {
      const final = latestRef.current;
      originRef.current = null;
      setActiveEdge(null);
      if (final) onResizeEndRef.current?.(final);
    };

    // `passive: false` — το `preventDefault` στο move εμποδίζει την επιλογή κειμένου και το
    // native drag εικόνων ενώ αλλάζει το μέγεθος.
    document.addEventListener('pointermove', handlePointerMove, { passive: false });
    document.addEventListener('pointerup', handlePointerUp);
    // Ο χρήστης μπορεί να ακυρώσει με Esc/αλλαγή παραθύρου: ο browser στέλνει pointercancel.
    // Χωρίς αυτό, η λαβή θα έμενε «κολλημένη» και το panel θα ακολουθούσε τον δείκτη.
    document.addEventListener('pointercancel', handlePointerUp);

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [activeEdge]);

  return { isResizing: activeEdge !== null, activeEdge, startResize };
}

export default useResizable;
