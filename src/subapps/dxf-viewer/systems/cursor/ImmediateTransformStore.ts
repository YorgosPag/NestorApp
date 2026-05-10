/**
 * 🏢 ENTERPRISE: IMMEDIATE TRANSFORM STORE — Transform SSoT (ADR-040 Phase XIII)
 *
 * Module-level singleton. Bypassa React state.
 *
 * Phase I: zero-lag canvas read (synchronous transform for RAF callbacks).
 * Phase XIII: SSoT esteso — sostituisce useState in `useCanvasTransformState`.
 *   Subscribers granulari (full / scale-only / offset-only) per evitare
 *   cascade orchestrator. React leaf consumers usano useSyncExternalStore.
 *
 * @see ImmediatePositionStore / HoverStore / SelectionStore — stesso pattern
 * @see ADR-040 — Canvas Performance
 */

import { useSyncExternalStore } from 'react';
import type { ViewTransform } from '../../rendering/types/Types';
import { markSystemsDirty } from '../../rendering/core/UnifiedFrameScheduler';

const TRANSFORM_CANVAS_IDS = ['dxf-canvas', 'layer-canvas'] as const;

let _transform: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
const fullListeners = new Set<() => void>();
const scaleListeners = new Set<() => void>();
const offsetListeners = new Set<() => void>();

/**
 * Aggiorna il transform sincrono e marca dirty i canvas di rendering.
 * Notifica anche i React leaf subscribers (granular).
 */
export function updateImmediateTransform(t: ViewTransform): void {
  const prev = _transform;
  _transform = t;
  markSystemsDirty([...TRANSFORM_CANVAS_IDS]);

  const scaleChanged = prev.scale !== t.scale;
  const offsetChanged = prev.offsetX !== t.offsetX || prev.offsetY !== t.offsetY;
  if (!scaleChanged && !offsetChanged) return;

  fullListeners.forEach((l) => l());
  if (scaleChanged) scaleListeners.forEach((l) => l());
  if (offsetChanged) offsetListeners.forEach((l) => l());
}

/** Synchronous read — zero lag, used in RAF callbacks and event handlers. */
export function getImmediateTransform(): ViewTransform {
  return _transform;
}

// ─── Subscribe APIs (useSyncExternalStore-compatible) ────────────────────────

export function subscribeTransform(cb: () => void): () => void {
  fullListeners.add(cb);
  return () => { fullListeners.delete(cb); };
}

export function subscribeTransformScale(cb: () => void): () => void {
  scaleListeners.add(cb);
  return () => { scaleListeners.delete(cb); };
}

export function subscribeTransformOffset(cb: () => void): () => void {
  offsetListeners.add(cb);
  return () => { offsetListeners.delete(cb); };
}

// ─── React hooks (selective subscription) ────────────────────────────────────

/** Full transform — re-renders on any change. Use only when needed. */
export function useTransformValue(): ViewTransform {
  return useSyncExternalStore(subscribeTransform, getImmediateTransform, getImmediateTransform);
}

/** Scale-only — re-renders only when scale changes. Toolbars/ZoomControls. */
export function useTransformScale(): number {
  return useSyncExternalStore(
    subscribeTransformScale,
    () => _transform.scale,
    () => _transform.scale,
  );
}

// ─── Canonical aliases (Phase XIII) ──────────────────────────────────────────
/**
 * TransformStore — canonical SSoT facade. New code should import this.
 * The legacy `updateImmediateTransform` / `getImmediateTransform` remain for
 * existing call sites and are kept identical.
 */
export const TransformStore = {
  get: getImmediateTransform,
  set: updateImmediateTransform,
  subscribe: subscribeTransform,
  subscribeScale: subscribeTransformScale,
  subscribeOffset: subscribeTransformOffset,
} as const;
