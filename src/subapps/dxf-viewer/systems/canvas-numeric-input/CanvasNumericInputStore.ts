/**
 * CanvasNumericInputStore — module-level pub/sub for canvas direct numeric entry.
 * Zero React state. Follows PolygonCropStore / HoverStore pattern (ADR-040).
 *
 * Reuses DirectDistanceEntry (text-engine/interaction) — SSOT for buffer logic.
 * Keyboard routing lives in useCanvasKeyboardShortcuts.
 * Overlay: CanvasNumericInputOverlay (micro-leaf).
 *
 * @see ADR-040: micro-leaf subscriber pattern
 * @see ADR-189: guide-parallel workflow (primary consumer)
 */
import { useSyncExternalStore } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { Guide } from '../guides/guide-types';
import { DirectDistanceEntry } from '../../text-engine/interaction/DirectDistanceEntry';

type Listener = () => void;
type ConfirmFn = (distance: number, sign: 1 | -1, refGuideId: string) => void;
type CancelFn = () => void;
/** Διαβάζεται τη στιγμή του commit — ΟΧΙ στο activate (ADR-040 κανόνας 2). */
type SignResolver = () => 1 | -1;

const _dde = new DirectDistanceEntry();
let _signResolver: SignResolver = () => 1;
/**
 * Ο ΟΔΗΓΟΣ ΑΝΑΦΟΡΑΣ, παγωμένος ως ΑΝΤΙΓΡΑΦΟ στο κλικ — όπως και το anchor.
 * Το leaf που ζωγραφίζει τη διακεκομμένη χρειάζεται τη ΓΕΩΜΕΤΡΙΑ (άξονας/offset/
 * άκρα) για να κλειδώσει το ΟΡΘΟ κάθετα στον οδηγό· ένα σκέτο id δεν αρκεί και θα
 * ανάγκαζε το leaf να συνδρομήσει στο GuideStore (ADR-040: high-freq leaf ≤2 hooks).
 * Το `_refGuideId` καταργήθηκε — το id προκύπτει από `_refGuide.id` (μία πηγή).
 */
let _refGuide: Guide | null = null;
/**
 * Το σημείο ΠΑΝΩ στον οδηγό αναφοράς απ' όπου ξεκινά η δυναμική διακεκομμένη
 * (ADR-189 §3.13). ΠΑΓΩΝΕΙ στο κλικ — σε αντίθεση με την ΠΛΕΥΡΑ, που παραμένει
 * event-time (`_signResolver`). Low-frequency: αλλάζει 1× ανά χειρονομία.
 */
let _anchor: Point2D | null = null;
let _onConfirm: ConfirmFn | null = null;
let _onCancel: CancelFn | null = null;
const _listeners = new Set<Listener>();

function _notify(): void {
  _listeners.forEach(fn => fn());
}

/** Βαθύ-όσο-χρειάζεται αντίγραφο: ο caller δεν πρέπει να μπορεί να μεταλλάξει
 *  τον παγωμένο οδηγό (offset/visible είναι mutable πεδία του `Guide`). */
function _cloneGuide(guide: Guide): Guide {
  return {
    ...guide,
    startPoint: guide.startPoint ? { x: guide.startPoint.x, y: guide.startPoint.y } : undefined,
    endPoint: guide.endPoint ? { x: guide.endPoint.x, y: guide.endPoint.y } : undefined,
  };
}

export const CanvasNumericInputStore = {
  isActive(): boolean {
    return _dde.snapshot().status === 'buffering';
  },

  getBuffer(): string {
    return _dde.snapshot().buffer;
  },

  /**
   * `signResolver` καλείται στο `confirm()`, όχι εδώ: η πλευρά πρέπει να προκύπτει
   * από το ΠΟΥ είναι ο κέρσορας τη στιγμή που ο χρήστης πατά Enter — όχι από το
   * πού έτυχε να πέσει το κλικ επιλογής της αναφοράς.
   */
  activate(
    signResolver: SignResolver,
    refGuide: Guide,
    anchor: Point2D,
    onConfirm: ConfirmFn,
    onCancel?: CancelFn,
  ): void {
    _signResolver = signResolver;
    _refGuide = _cloneGuide(refGuide);
    // Αντίγραφο: ο caller δεν πρέπει να μπορεί να μεταλλάξει το anchor εκ των υστέρων.
    _anchor = { x: anchor.x, y: anchor.y };
    _onConfirm = onConfirm;
    _onCancel = onCancel ?? null;
    _dde.begin();
    _notify();
  },

  /**
   * Το παγωμένο σημείο εκκίνησης της δυναμικής γραμμής. Επιστρέφει ΤΗΝ ΙΔΙΑ
   * αναφορά μεταξύ ειδοποιήσεων — απαραίτητο για `useSyncExternalStore`
   * (νέο literal σε κάθε κλήση ⇒ ατέρμονο re-render).
   */
  getAnchor(): Point2D | null {
    return _anchor;
  },

  /**
   * Ο παγωμένος οδηγός αναφοράς. Ίδια σύμβαση με το `getAnchor`: επιστρέφει ΤΗΝ
   * ΙΔΙΑ ΑΝΑΦΟΡΑ μεταξύ ειδοποιήσεων (νέο literal σε κάθε κλήση ⇒ ατέρμονο
   * re-render στο `useSyncExternalStore`).
   */
  getRefGuide(): Guide | null {
    return _refGuide;
  },

  /**
   * Η πληκτρολογημένη απόσταση ως αριθμός, ή `null` όσο ο buffer είναι κενός/μη
   * έγκυρος. Το φάντασμα-οδηγός τη διαβάζει για να κουμπώσει στην τιμή που
   * γράφει ο χρήστης αντί να ακολουθεί τον κέρσορα (WYSIWYG με το commit).
   */
  getPendingDistance(): number | null {
    const buffer = _dde.snapshot().buffer;
    if (!buffer) return null;
    const value = parseFloat(buffer);
    if (!Number.isFinite(value) || Math.abs(value) < 0.001) return null;
    return Math.abs(value);
  },

  /** Accepts digit, '.', '-', or ',' (normalised to '.'). Returns true if consumed. */
  addChar(ch: string): boolean {
    const key = ch === ',' ? '.' : ch;
    const consumed = _dde.pressKey(key);
    if (consumed) _notify();
    return consumed;
  },

  backspace(): void {
    _dde.pressKey('Backspace');
    _notify();
  },

  /** Commits buffer. Returns false if buffer is empty/zero (no-op). */
  confirm(): boolean {
    const value = _dde.commit();
    if (value === null || Math.abs(value) < 0.001) {
      _dde.reset();
      _notify();
      return false;
    }
    const refGuideId = _refGuide?.id ?? '';
    const sign = _signResolver();
    const cb = _onConfirm;
    _refGuide = null;
    _anchor = null;
    _onConfirm = null;
    _onCancel = null;
    _notify();
    cb?.(Math.abs(value), sign, refGuideId);
    return true;
  },

  cancel(): void {
    const cb = _onCancel;
    _dde.reset();
    _refGuide = null;
    _anchor = null;
    _onConfirm = null;
    _onCancel = null;
    _notify();
    cb?.();
  },

  subscribe(listener: Listener): () => void {
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  },
} as const;

// ── React hooks (ΜΟΝΟ για micro-leaves — ADR-040) ─────────────────────────────

const _getNullAnchor = (): Point2D | null => null;
const _getNullDistance = (): number | null => null;
const _getNullGuide = (): Guide | null => null;

/**
 * Το σημείο εκκίνησης της δυναμικής γραμμής, για το leaf που τη ζωγραφίζει.
 * `null` ⇒ καμία ενεργή χειρονομία ⇒ το preview είναι σβηστό.
 */
export function useCanvasNumericAnchor(): Point2D | null {
  return useSyncExternalStore(
    CanvasNumericInputStore.subscribe,
    CanvasNumericInputStore.getAnchor,
    _getNullAnchor,
  );
}

/**
 * Ο παγωμένος οδηγός αναφοράς, για το leaf που ζωγραφίζει τη διακεκομμένη: του
 * χρειάζεται η ΓΕΩΜΕΤΡΙΑ ώστε το ΟΡΘΟ να κλειδώσει κάθετα ΣΤΟΝ ΟΔΗΓΟ
 * (`resolveParallelCursor`). `null` ⇒ καμία ενεργή χειρονομία.
 */
export function useCanvasNumericRefGuide(): Guide | null {
  return useSyncExternalStore(
    CanvasNumericInputStore.subscribe,
    CanvasNumericInputStore.getRefGuide,
    _getNullGuide,
  );
}

/** Η πληκτρολογημένη απόσταση, για το φάντασμα-οδηγό (WYSIWYG με το commit). */
export function useCanvasNumericPendingDistance(): number | null {
  return useSyncExternalStore(
    CanvasNumericInputStore.subscribe,
    CanvasNumericInputStore.getPendingDistance,
    _getNullDistance,
  );
}
