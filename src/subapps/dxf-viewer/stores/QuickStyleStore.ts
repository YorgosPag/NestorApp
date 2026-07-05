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
 * `dxf:quickStyle.colorAci`, `dxf:quickStyle.ltscale` — cross-session, user-scoped.
 *
 * Pre-commit ratchet `quick-style-store` (added to `.ssot-registry.json`)
 * blocks direct localStorage reads/writes of the `dxf:quickStyle.*` namespace
 * outside this file.
 */

import type { LineweightMm } from '../types/entities';
import { LINEWEIGHT_SPECIAL } from '../config/lineweight-iso-catalog';
import { createExternalStore } from './createExternalStore';

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
  /** ADR-510 Φ2E #2 — per-object linetype scale (CELTSCALE). Default 1 (no scaling). */
  readonly ltscale: number;
}

// ─── localStorage keys ───────────────────────────────────────────────────────

const LS_LINEWEIGHT = 'dxf:quickStyle.lineweight';
const LS_LINETYPE   = 'dxf:quickStyle.linetype';
const LS_COLOR_MODE = 'dxf:quickStyle.colorMode';
const LS_COLOR_ACI  = 'dxf:quickStyle.colorAci';
const LS_LTSCALE    = 'dxf:quickStyle.ltscale';

const BYLAYER_LINETYPE = 'ByLayer';
const BYLAYER_LINEWEIGHT: LineweightMm = LINEWEIGHT_SPECIAL.BYLAYER;
/** AutoCAD CELTSCALE default — 1.0 (no per-object scaling). */
const DEFAULT_LTSCALE = 1;

// ─── Defaults ────────────────────────────────────────────────────────────────

function loadInitialSnapshot(): QuickStyleSnapshot {
  if (typeof localStorage === 'undefined') {
    return {
      lineweightMm: BYLAYER_LINEWEIGHT,
      linetypeName: BYLAYER_LINETYPE,
      colorMode: 'ByLayer',
      colorAci: null,
      colorTrueColor: null,
      ltscale: DEFAULT_LTSCALE,
    };
  }
  const rawLw   = localStorage.getItem(LS_LINEWEIGHT);
  const rawLt   = localStorage.getItem(LS_LINETYPE);
  const rawCm   = localStorage.getItem(LS_COLOR_MODE);
  const rawAci  = localStorage.getItem(LS_COLOR_ACI);
  const rawLts  = localStorage.getItem(LS_LTSCALE);

  const lineweightMm: LineweightMm = rawLw !== null ? (parseFloat(rawLw) as LineweightMm) : BYLAYER_LINEWEIGHT;
  const linetypeName = rawLt ?? BYLAYER_LINETYPE;
  const colorMode: 'ByLayer' | 'Concrete' = rawCm === 'Concrete' ? 'Concrete' : 'ByLayer';
  const colorAci = rawAci !== null ? parseInt(rawAci, 10) : null;
  const parsedLts = rawLts !== null ? parseFloat(rawLts) : DEFAULT_LTSCALE;
  const ltscale = Number.isFinite(parsedLts) && parsedLts > 0 ? parsedLts : DEFAULT_LTSCALE;

  return Object.freeze({ lineweightMm, linetypeName, colorMode, colorAci, colorTrueColor: null, ltscale });
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
  if (next.ltscale === DEFAULT_LTSCALE) {
    localStorage.removeItem(LS_LTSCALE);
  } else {
    localStorage.setItem(LS_LTSCALE, String(next.ltscale));
  }
}

// SSoT pub/sub plumbing via createExternalStore (WAVE 2.6). Each mutator builds a
// fresh frozen snapshot on write (no shared identity to compare) — factory used
// WITHOUT `equals`; the per-field unchanged-value guard (`setQuickStyleLtscale`)
// stays in the mutator, byte-identical to the hand-rolled store.
const store = createExternalStore<QuickStyleSnapshot>(loadInitialSnapshot());

// ─── Snapshot getter (useSyncExternalStore-compatible) ───────────────────────

export function getQuickStyleSnapshot(): QuickStyleSnapshot {
  return store.get();
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

export function subscribeQuickStyle(cb: () => void): () => void {
  return store.subscribe(cb);
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function setQuickStyleLineweight(lw: LineweightMm): void {
  const next = Object.freeze({ ...store.get(), lineweightMm: lw });
  persist(next);
  store.set(next);
}

export function setQuickStyleLinetype(name: string): void {
  const next = Object.freeze({ ...store.get(), linetypeName: name });
  persist(next);
  store.set(next);
}

export function setQuickStyleColor(
  colorMode: 'ByLayer' | 'Concrete',
  colorAci: number | null,
  colorTrueColor: number | null = null,
): void {
  const next = Object.freeze({ ...store.get(), colorMode, colorAci, colorTrueColor });
  persist(next);
  store.set(next);
}

/**
 * Set the per-object linetype scale (CELTSCALE) draw-default. Non-positive /
 * non-finite values are ignored (AutoCAD rejects CELTSCALE <= 0). No-op when
 * unchanged.
 */
export function setQuickStyleLtscale(ltscale: number): void {
  if (!Number.isFinite(ltscale) || ltscale <= 0) return;
  if (ltscale === store.get().ltscale) return;
  const next = Object.freeze({ ...store.get(), ltscale });
  persist(next);
  store.set(next);
}

export function resetQuickStyle(): void {
  const next = Object.freeze({
    lineweightMm: BYLAYER_LINEWEIGHT,
    linetypeName: BYLAYER_LINETYPE,
    colorMode: 'ByLayer' as const,
    colorAci: null,
    colorTrueColor: null,
    ltscale: DEFAULT_LTSCALE,
  });
  persist(next);
  store.set(next);
}

// ─── Convenience read ────────────────────────────────────────────────────────

/**
 * True when all overrides are at ByLayer — entity fully inherits from layer.
 * Used by `completeEntity` to skip passing options and let the 4-level
 * fallback in `CreateEntityCommand.execute()` handle everything.
 */
export function isQuickStyleAllByLayer(): boolean {
  const s = store.get();
  return (
    s.lineweightMm === BYLAYER_LINEWEIGHT &&
    s.linetypeName === BYLAYER_LINETYPE &&
    s.colorMode === 'ByLayer' &&
    s.ltscale === DEFAULT_LTSCALE
  );
}
