"use client";

// ============================================================================
// ♿ FOCUS INDICATOR 3D — React floating label (ADR-366 Phase 4.5 / A.7.Q1)
// ============================================================================
//
// React companion to FocusOutlineRenderer. Subscribes to the KeyboardFocusManager
// (low-freq — Tab keypress only) and renders a small floating HTML label above
// the focused entity. Position updates run from a self-owned RAF loop that only
// spins while focus is active, so this component never causes 60fps React
// re-renders (ADR-040 micro-leaf compliance).
//
// Lifecycle:
//   - Focus change → re-render (text/className updates).
//   - Per-frame position → imperative `transform` write on the label DOM ref.
//   - Focus clear → RAF cancels itself, label hides.
// ============================================================================

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import type { KeyboardFocusManagerApi } from './KeyboardFocusManager';
import { entityTypeLabel } from './status-bar-text-generator';

export interface FocusEntityLabelData {
  readonly bimType: string;
  readonly entityName: string;
  readonly worldCenter: THREE.Vector3;
}

export interface FocusIndicator3DProps {
  readonly focusManager: KeyboardFocusManagerApi;
  /** Resolve label data per focused id. null = entity not in scene (clear UI). */
  readonly getEntityData: (bimId: string) => FocusEntityLabelData | null;
  readonly getCamera: () => THREE.Camera | null;
  readonly getCanvas: () => HTMLCanvasElement | null;
}

const LABEL_OFFSET_PX_Y = -28;
const HIDDEN_TRANSFORM = 'translate3d(-9999px, -9999px, 0)';

export function FocusIndicator3D({
  focusManager,
  getEntityData,
  getCamera,
  getCanvas,
}: FocusIndicator3DProps) {
  const { t } = useTranslation('bim3d');
  const labelRef = useRef<HTMLDivElement>(null);

  const focusedId = useSyncExternalStore(
    (listener) => focusManager.subscribe(listener),
    () => focusManager.getFocused(),
    () => null,
  );

  // RAF positioning — only active while focused. Re-spins on focus change.
  useEffect(() => {
    if (!focusedId) {
      if (labelRef.current) labelRef.current.style.transform = HIDDEN_TRANSFORM;
      return;
    }
    let rafHandle: number | null = null;
    const projected = new THREE.Vector3();

    const tick = () => {
      rafHandle = requestAnimationFrame(tick);
      const labelEl = labelRef.current;
      if (!labelEl) return;
      const data = getEntityData(focusedId);
      const camera = getCamera();
      const canvas = getCanvas();
      if (!data || !camera || !canvas) {
        labelEl.style.transform = HIDDEN_TRANSFORM;
        return;
      }
      projected.copy(data.worldCenter).project(camera);
      // Behind-camera or off-screen check — clip-space z > 1 means behind near plane.
      if (projected.z > 1) {
        labelEl.style.transform = HIDDEN_TRANSFORM;
        return;
      }
      const xPx = (projected.x * 0.5 + 0.5) * canvas.clientWidth;
      const yPx = (-projected.y * 0.5 + 0.5) * canvas.clientHeight + LABEL_OFFSET_PX_Y;
      labelEl.style.transform = `translate3d(${xPx}px, ${yPx}px, 0)`;
    };
    rafHandle = requestAnimationFrame(tick);
    return () => {
      if (rafHandle !== null) cancelAnimationFrame(rafHandle);
    };
  }, [focusedId, getEntityData, getCamera, getCanvas]);

  if (!focusedId) return null;
  const data = getEntityData(focusedId);
  if (!data) return null;
  const typeLabel = entityTypeLabel(data.bimType, t);
  const display = typeLabel
    ? `${typeLabel} ${data.entityName}`
    : data.entityName;

  return (
    <div
      ref={labelRef}
      className="pointer-events-none absolute left-0 top-0 z-[80] -translate-x-1/2 select-none rounded-md border border-ring/60 bg-black/75 px-2 py-1 text-xs font-medium text-foreground shadow-lg backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      {display}
    </div>
  );
}
