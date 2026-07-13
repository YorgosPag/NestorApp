/**
 * 🏢 ENTERPRISE: VIEWPORT STORE — Annotation Scale SSoT (ADR-344 Phase 11).
 *
 * Module-level singleton. Bypasses React state.
 *
 * Owns the **viewport-active annotation scale** (global) and the **scale list**
 * (catalog of named scales available to the user). Per-entity scale data lives
 * on `DxfTextNode.annotationScales` (entity AST); this store owns the
 * cross-cutting "which scale is currently active" decision.
 *
 * High-frequency consumers (TextRenderer, dxf-bitmap-cache) read via getters
 * at render time. React leaves subscribe via useSyncExternalStore in
 * `ViewportContext.tsx`.
 *
 * @see ImmediateTransformStore / HoverStore — same plain-singleton pattern
 * @see ADR-040 cardinal rule #3 — getter at event time, NO subscription in
 *      imperative renderers
 * @see ADR-344 §Q11 — annotative scaling decision (Path B, full)
 *
 * NOTE: ADR-344 §Q11 originally specified Zustand. We use a plain singleton to
 * stay consistent with the canvas-v2 micro-leaf catalog (ADR-040) and avoid
 * Zustand's proxy/shallow-check overhead on high-frequency reads.
 */

import type { AnnotationScale } from '../../text-engine/types';
import { buildDefaultScaleList } from './standard-scales';
import { markSystemsDirty } from '../../rendering/core/UnifiedFrameScheduler';
import { createExternalStore } from '../../stores/createExternalStore';

type ViewportListener = () => void;

// Canvas IDs that depend on viewport annotation scale (text rendering pipeline).
const VIEWPORT_DIRTY_CANVAS_IDS = ['dxf-canvas'] as const;

// ─── Internal state (createExternalStore SSoT — two independent signals) ─────

const activeScaleStore = createExternalStore<string>('1:1', { equals: Object.is });
const scaleListStore = createExternalStore<readonly AnnotationScale[]>(
  buildDefaultScaleList(),
  { equals: sameScaleList },
);

// ─── Setters (skip-if-unchanged, granular notification) ──────────────────────

/**
 * Set the viewport-active annotation scale by name.
 * Skip-if-unchanged prevents redundant notifications.
 * The name does NOT need to exist in `_scaleList` — entities may carry
 * scales the viewport list doesn't (and vice versa). Resolution happens at
 * render time.
 */
export function setActiveScale(name: string): void {
  if (name === activeScaleStore.get()) return;
  activeScaleStore.set(name);
  markSystemsDirty([...VIEWPORT_DIRTY_CANVAS_IDS]);
}

/**
 * Replace the viewport scale list. New array reference triggers list
 * subscribers; identical content is detected by length + per-name equality
 * to avoid re-render storms on no-op updates.
 */
export function setScaleList(next: readonly AnnotationScale[]): void {
  if (sameScaleList(scaleListStore.get(), next)) return;
  scaleListStore.set(next);
  markSystemsDirty([...VIEWPORT_DIRTY_CANVAS_IDS]);
}

function sameScaleList(
  a: readonly AnnotationScale[],
  b: readonly AnnotationScale[],
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x.name !== y.name || x.paperHeight !== y.paperHeight || x.modelHeight !== y.modelHeight) {
      return false;
    }
  }
  return true;
}

// ─── Getters (synchronous, zero-lag) ──────────────────────────────────────────

export function getActiveScaleName(): string {
  return activeScaleStore.get();
}

export function getScaleList(): readonly AnnotationScale[] {
  return scaleListStore.get();
}

/**
 * Resolve the active scale entry from the current list. Returns `null` if the
 * active name is not present — callers decide fallback (e.g. use first scale,
 * or skip annotative scaling).
 */
export function getActiveScale(): AnnotationScale | null {
  return scaleListStore.get().find((s) => s.name === activeScaleStore.get()) ?? null;
}

/**
 * ADR-651 Φάση Β — the active scale as a plain **paper-mm → model-units multiplier**
 * (1:50 ⇒ 50). DERIVED from the active entry (`modelHeight / paperHeight`), so the
 * factor can never drift from the scale catalog. Falls back to `1` (1:1) when no
 * active entry exists or the entry is degenerate — annotative sizing must never
 * produce a 0/NaN-scaled entity.
 */
export function getActiveScaleFactor(): number {
  const scale = getActiveScale();
  if (!scale || scale.paperHeight <= 0 || scale.modelHeight <= 0) return 1;
  return scale.modelHeight / scale.paperHeight;
}

// ─── Subscribe APIs (useSyncExternalStore-compatible) ────────────────────────

export function subscribeActiveScale(cb: ViewportListener): () => void {
  return activeScaleStore.subscribe(cb);
}

export function subscribeScaleList(cb: ViewportListener): () => void {
  return scaleListStore.subscribe(cb);
}

// ─── Canonical facade ─────────────────────────────────────────────────────────

/**
 * Canonical SSoT facade. New code should import `ViewportStore` rather than
 * the individual functions.
 */
export const ViewportStore = {
  getActiveScaleName,
  getScaleList,
  getActiveScale,
  getActiveScaleFactor,
  setActiveScale,
  setScaleList,
  subscribeActiveScale,
  subscribeScaleList,
} as const;

// ─── Test-only reset (NOT exported through index.ts) ─────────────────────────

/**
 * Reset internal state to defaults. ONLY for unit tests; do NOT call from app
 * code. Intentionally exported separately to avoid accidental usage.
 */
export function __resetViewportStoreForTests(): void {
  activeScaleStore.reset('1:1');
  scaleListStore.reset(buildDefaultScaleList());
}
