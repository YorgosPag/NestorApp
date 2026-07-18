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
// ADR-677 — η πληκτρολογημένη τιμή ερμηνεύεται στη μονάδα εμφάνισης του χρήστη.
import { fromDisplay } from '../../config/units';
import { displayUnitState } from '../../config/display-unit-state';
import { immediateSceneScale } from '../cursor/ImmediateSceneScaleStore';

type Listener = () => void;
type ConfirmFn = (distance: number, sign: 1 | -1, refGuideId: string) => void;
type CancelFn = () => void;
/** Διαβάζεται τη στιγμή του commit — ΟΧΙ στο activate (ADR-040 κανόνας 2). */
type SignResolver = () => 1 | -1;

/**
 * Ελάχιστη αποδεκτή απόσταση σε scene units. Ο έλεγχος γίνεται ΜΕΤΑ τη μετατροπή:
 * το «0.0005» σε μέτρα είναι 0,5 mm — υπαρκτή απόσταση, όχι θόρυβος.
 */
const SCENE_EPSILON = 0.001;

/**
 * Ο πληκτρολογημένος αριθμός είναι στη ΜΟΝΑΔΑ ΕΜΦΑΝΙΣΗΣ που έχει επιλέξει ο χρήστης
 * (status bar) — ο κόσμος όμως μετριέται σε scene units. Μία μετατροπή, στο σύνορο
 * εισόδου: display → mm → scene. Ίδιο πρότυπο με το SNAP step (`CadStatusBar`,
 * ADR-677): το UI boundary μετατρέπει, το domain μένει canonical.
 *
 * ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΟΝ CALLER: ο buffer είναι το ΜΟΝΟ σημείο όπου μπαίνει τιμή σε
 * μονάδα χρήστη. Αν η μετατροπή ζούσε στη ροή «Παράλληλος Οδηγός», κάθε μελλοντικός
 * καταναλωτής αυτού του γενικού store θα κληρονομούσε σιωπηλά το ίδιο σφάλμα.
 * Και οι ΔΥΟ έξοδοι (`getPendingDistance` για το φάντασμα, `confirm` για το commit)
 * επιστρέφουν πλέον scene units — αλλιώς φάντασμα και commit θα διαφωνούσαν κατά ×1000.
 */
function _typedToSceneUnits(typed: number): number {
  const mm = fromDisplay(typed, displayUnitState.getUnit());
  return mm * immediateSceneScale.getMmToScene();
}

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
    if (!Number.isFinite(value)) return null;
    const scene = _typedToSceneUnits(Math.abs(value));
    return scene < SCENE_EPSILON ? null : scene;
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
    const typed = _dde.commit();
    const value = typed === null ? null : _typedToSceneUnits(Math.abs(typed));
    if (value === null || value < SCENE_EPSILON) {
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
    cb?.(value, sign, refGuideId);
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
