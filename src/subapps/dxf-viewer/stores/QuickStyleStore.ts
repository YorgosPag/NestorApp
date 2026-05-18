/**
 * QuickStyleStore — ADR-357 Phase 17 (Quick Style Override).
 *
 * Micro-leaf singleton (ADR-040 pattern: useSyncExternalStore-compatible).
 * Holds per-session style overrides for the *next* entity to be created.
 * Default = ByLayer/ByBlock sentinels so the render cascade inherits from the
 * active layer (ADR-358 §G7 Phase 6.5).
 *
 * Persistence: localStorage keys `dxf:quickStyle.lineweight`,
 * `dxf:quickStyle.linetype`, `dxf:quickStyle.colorMode`,
 * `dxf:quickStyle.colorAci` — cross-session, user-scoped.
 *
 * Pre-commit ratchet `quick-style-store` (added to `.ssot-registry.json`)
 * blocks direct localStorage reads/writes of the `dxf:quickStyle.*` namespace
 * outside this file.
 */

import type { LineweightMm } from '../types/entities';
import { LINEWEIGHT_SPECIAL } from '../config/lineweight-iso-catalog';

// ─── Public snapshot ─────────────────────────────────────────────────────────

export interface QuickStyleSnapshot {
  /** -2 = ByLayer (inherit from active layer), concrete mm otherwise. */
  readonly lineweightMm: LineweightMm;
  /** 'ByLayer' = inherit, ISO name otherwise (e.g. 'Dashed'). */
  readonly linetypeName: string;
  /** 'ByLayer' = inherit from active layer, 'Concrete' = use colorAci/colorTrueColor. */
  readonly colorMode: 'ByLayer' | 'Concrete';
  /** ACI 1-255 — only used when colorMode === 'Concrete'. */
  readonly colorAci: number | null;
  /** 0xRRGGBB TrueColor — only used when colorMode === 'Concrete' and colorAci === null. */
  readonly colorTrueColor: number | null;
}

// ─── localStorage keys ───────────────────────────────────────────────────────

const LS_LINEWEIGHT = 'dxf:quickStyle.lineweight';
const LS_LINETYPE   = 'dxf:quickStyle.linetype';
const LS_COLOR_MODE = 'dxf:quickStyle.colorMode';
const LS_COLOR_ACI  = 'dxf:quickStyle.colorAci';

const BYLAYER_LINETYPE = 'ByLayer';
const BYLAYER_LINEWEIGHT: LineweightMm = LINEWEIGHT_SPECIAL.BYLAYER;

// ─── Defaults ────────────────────────────────────────────────────────────────

function loadInitialSnapshot(): QuickStyleSnapshot {
  if (typeof localStorage === 'undefined') {
    return {
      lineweightMm: BYLAYER_LINEWEIGHT,
      linetypeName: BYLAYER_LINETYPE,
      colorMode: 'ByLayer',
      colorAci: null,
      colorTrueColor: null,
    };
  }
  const rawLw   = localStorage.getItem(LS_LINEWEIGHT);
  const rawLt   = localStorage.getItem(LS_LINETYPE);
  const rawCm   = localStorage.getItem(LS_COLOR_MODE);
  const rawAci  = localStorage.getItem(LS_COLOR_ACI);

  const lineweightMm: LineweightMm = rawLw !== null ? (parseFloat(rawLw) as LineweightMm) : BYLAYER_LINEWEIGHT;
  const linetypeName = rawLt ?? BYLAYER_LINETYPE;
  const colorMode: 'ByLayer' | 'Concrete' = rawCm === 'Concrete' ? 'Concrete' : 'ByLayer';
  const colorAci = rawAci !== null ? parseInt(rawAci, 10) : null;

  return Object.freeze({ lineweightMm, linetypeName, colorMode, colorAci, colorTrueColor: null });
}

// ─── Mutable state ───────────────────────────────────────────────────────────

type Listener = () => void;

let snapshot: QuickStyleSnapshot = loadInitialSnapshot();
const subscribers = new Set<Listener>();

function notify(): void {
  subscribers.forEach((cb) => cb());
}

function persist(next: QuickStyleSnapshot): void {
  if (typeof localStorage === 'undefined') return;
  if (next.lineweightMm === BYLAYER_LINEWEIGHT) {
    localStorage.removeItem(LS_LINEWEIGHT);
  } else {
    localStorage.setItem(LS_LINEWEIGHT, String(next.lineweightMm));
  }
  if (next.linetypeName === BYLAYER_LINETYPE) {
    localStorage.removeItem(LS_LINETYPE);
  } else {
    localStorage.setItem(LS_LINETYPE, next.linetypeName);
  }
  if (next.colorMode === 'ByLayer') {
    localStorage.removeItem(LS_COLOR_MODE);
    localStorage.removeItem(LS_COLOR_ACI);
  } else {
    localStorage.setItem(LS_COLOR_MODE, next.colorMode);
    if (next.colorAci !== null) {
      localStorage.setItem(LS_COLOR_ACI, String(next.colorAci));
    } else {
      localStorage.removeItem(LS_COLOR_ACI);
    }
  }
}

// ─── Snapshot getter (useSyncExternalStore-compatible) ───────────────────────

export function getQuickStyleSnapshot(): QuickStyleSnapshot {
  return snapshot;
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

export function subscribeQuickStyle(cb: Listener): () => void {
  subscribers.add(cb);
  return () => { subscribers.delete(cb); };
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function setQuickStyleLineweight(lw: LineweightMm): void {
  snapshot = Object.freeze({ ...snapshot, lineweightMm: lw });
  persist(snapshot);
  notify();
}

export function setQuickStyleLinetype(name: string): void {
  snapshot = Object.freeze({ ...snapshot, linetypeName: name });
  persist(snapshot);
  notify();
}

export function setQuickStyleColor(
  colorMode: 'ByLayer' | 'Concrete',
  colorAci: number | null,
  colorTrueColor: number | null = null,
): void {
  snapshot = Object.freeze({ ...snapshot, colorMode, colorAci, colorTrueColor });
  persist(snapshot);
  notify();
}

export function resetQuickStyle(): void {
  snapshot = Object.freeze({
    lineweightMm: BYLAYER_LINEWEIGHT,
    linetypeName: BYLAYER_LINETYPE,
    colorMode: 'ByLayer' as const,
    colorAci: null,
    colorTrueColor: null,
  });
  persist(snapshot);
  notify();
}

// ─── Convenience read ────────────────────────────────────────────────────────

/**
 * True when all overrides are at ByLayer — entity fully inherits from layer.
 * Used by `completeEntity` to skip passing options and let the 4-level
 * fallback in `CreateEntityCommand.execute()` handle everything.
 */
export function isQuickStyleAllByLayer(): boolean {
  const s = snapshot;
  return (
    s.lineweightMm === BYLAYER_LINEWEIGHT &&
    s.linetypeName === BYLAYER_LINETYPE &&
    s.colorMode === 'ByLayer'
  );
}
