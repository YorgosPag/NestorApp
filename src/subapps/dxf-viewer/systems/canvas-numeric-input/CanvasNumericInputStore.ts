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
import { DirectDistanceEntry } from '../../text-engine/interaction/DirectDistanceEntry';

type Listener = () => void;
type ConfirmFn = (distance: number, sign: 1 | -1, refGuideId: string) => void;
type CancelFn = () => void;

const _dde = new DirectDistanceEntry();
let _sign: 1 | -1 = 1;
let _refGuideId: string | null = null;
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

  activate(sign: 1 | -1, refGuideId: string, onConfirm: ConfirmFn, onCancel?: CancelFn): void {
    _sign = sign;
    _refGuideId = refGuideId;
    _onConfirm = onConfirm;
    _onCancel = onCancel ?? null;
    _dde.begin();
    _notify();
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
    const sign = _sign;
    const cb = _onConfirm;
    _refGuideId = null;
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
