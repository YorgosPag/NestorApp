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
import { DirectDistanceEntry } from '../../text-engine/interaction/DirectDistanceEntry';

type Listener = () => void;
type ConfirmFn = (distance: number, sign: 1 | -1, refGuideId: string) => void;
type CancelFn = () => void;
/** Διαβάζεται τη στιγμή του commit — ΟΧΙ στο activate (ADR-040 κανόνας 2). */
type SignResolver = () => 1 | -1;

const _dde = new DirectDistanceEntry();
let _signResolver: SignResolver = () => 1;
let _refGuideId: string | null = null;
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
    refGuideId: string,
    anchor: Point2D,
    onConfirm: ConfirmFn,
    onCancel?: CancelFn,
  ): void {
    _signResolver = signResolver;
    _refGuideId = refGuideId;
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
    const refGuideId = _refGuideId!;
    const sign = _signResolver();
    const cb = _onConfirm;
    _refGuideId = null;
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
    _refGuideId = null;
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

/** Η πληκτρολογημένη απόσταση, για το φάντασμα-οδηγό (WYSIWYG με το commit). */
export function useCanvasNumericPendingDistance(): number | null {
  return useSyncExternalStore(
    CanvasNumericInputStore.subscribe,
    CanvasNumericInputStore.getPendingDistance,
    _getNullDistance,
  );
}
