/**
 * LinetypeScaleStore — global LTSCALE knob (ADR-510 Φ2).
 *
 * Micro-leaf singleton (ADR-040 pattern: useSyncExternalStore-compatible).
 * Holds the drawing-wide linetype scale factor (AutoCAD `LTSCALE`) that the
 * canvas dash renderer multiplies into every dash pattern, on top of the live
 * zoom factor (`rendering/linetype-dash-resolver.ts`).
 *
 * Mirror of `stores/QuickStyleStore.ts`: zero React state, localStorage-persisted,
 * cross-session/user-scoped. UI status-bar control is deferred — for now the
 * value defaults to 1.0 and can be set programmatically / from DXF $LTSCALE.
 *
 * The "hidden/center lines look continuous" classic CAD bug is an LTSCALE
 * mismatch vs drawing size (ADR-510 §2.2); this knob is the fix surface.
 */

/** Default LTSCALE — AutoCAD convention. */
export const DEFAULT_LTSCALE = 1.0;

/** localStorage key — session-persisted, user-scoped. */
const LS_LTSCALE = 'dxf:ltscale';

type Listener = () => void;

function loadInitialScale(): number {
  if (typeof localStorage === 'undefined') return DEFAULT_LTSCALE;
  const raw = localStorage.getItem(LS_LTSCALE);
  if (raw === null) return DEFAULT_LTSCALE;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LTSCALE;
}

let scale: number = loadInitialScale();
const subscribers = new Set<Listener>();

function notify(): void {
  subscribers.forEach((cb) => cb());
}

function persist(next: number): void {
  if (typeof localStorage === 'undefined') return;
  if (next === DEFAULT_LTSCALE) {
    localStorage.removeItem(LS_LTSCALE);
  } else {
    localStorage.setItem(LS_LTSCALE, String(next));
  }
}

// ─── Snapshot getter (useSyncExternalStore-compatible) ───────────────────────

/** Current global LTSCALE. Always a finite positive number. */
export function getLinetypeScale(): number {
  return scale;
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

export function subscribeLinetypeScale(cb: Listener): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

// ─── Mutations ───────────────────────────────────────────────────────────────

/**
 * Set the global LTSCALE. Non-positive / non-finite values are ignored
 * (AutoCAD rejects `LTSCALE <= 0`). No-ops when the value is unchanged.
 */
export function setLinetypeScale(next: number): void {
  if (!Number.isFinite(next) || next <= 0) return;
  if (next === scale) return;
  scale = next;
  persist(scale);
  notify();
}

/** Reset to the AutoCAD default (1.0). */
export function resetLinetypeScale(): void {
  setLinetypeScale(DEFAULT_LTSCALE);
}

// ─── Test-only reset ─────────────────────────────────────────────────────────

/** @internal Reset to default + clear subscribers. Tests only. */
export function __resetLinetypeScaleForTesting(): void {
  scale = DEFAULT_LTSCALE;
  subscribers.clear();
}
