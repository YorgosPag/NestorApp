'use client';

// ============================================================================
// ♿ FOCUS 2D OVERLAY — micro-leaf canvas (ADR-366 Phase 4.6 / A.7.Q1)
// ============================================================================
//
// Mirror of `bim-3d/accessibility/FocusIndicator3D.tsx` for the 2D viewport.
// Subscribes to the cross-mode `KeyboardFocusManager` (low-freq — Tab keypress)
// via `useSyncExternalStore`, then paints the dashed cyan outline on its own
// canvas via `paintFocus2DOutline`. ADR-040 compliant — single subscription,
// single canvas element, no orchestrator subscriptions.
//
// Self-owned RAF only ticks while focus is active AND the transform/scene
// reference identity changes — re-paints on transform change (pan/zoom keep the
// outline anchored to the entity).
// ============================================================================

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { getKeyboardFocus2DManager } from './keyboard-focus-2d-manager';
import { paintFocus2DOutline, clearFocus2DOverlay } from './focus-2d-outline-painter';
import { findFocusedEntityData2D } from './focus-2d-order';
import { entityTypeLabel } from '../bim-3d/accessibility/status-bar-text-generator';
import type { DxfScene } from '../canvas-v2/dxf-canvas/dxf-types';
import type { ViewTransform, Viewport } from '../rendering/types/Types';

export interface Focus2DOverlayProps {
  readonly scene: DxfScene | null;
  readonly transform: ViewTransform;
  readonly viewport: Viewport;
  /** Hide the overlay outright while in 3D mode — caller gates via ViewMode3DStore. */
  readonly active: boolean;
  readonly className?: string;
}

export function Focus2DOverlay({
  scene,
  transform,
  viewport,
  active,
  className,
}: Focus2DOverlayProps) {
  const { t } = useTranslation('bim3d');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const focusManager = getKeyboardFocus2DManager();

  const focusedId = useSyncExternalStore(
    (listener) => focusManager.subscribe(listener),
    () => focusManager.getFocused(),
    () => null,
  );

  // Paint on focus/transform/scene change. Outline anchors to the entity's
  // world bbox, so pan/zoom requires a repaint at the new screen position.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!active || !focusedId) {
      clearFocus2DOverlay(canvas);
      return;
    }
    const data = findFocusedEntityData2D(scene, focusedId);
    if (!data) {
      clearFocus2DOverlay(canvas);
      return;
    }
    paintFocus2DOutline(canvas, data.bbox, transform, viewport);
  }, [active, focusedId, scene, transform, viewport]);

  // Clear when going inactive (mode flip to 3D) so stale outline never lingers.
  useEffect(() => {
    if (active) return;
    const canvas = canvasRef.current;
    if (canvas) clearFocus2DOverlay(canvas);
    // Active = false → also clear focus state so re-entering 2D starts fresh.
    focusManager.clear();
  }, [active, focusManager]);

  if (!active) return null;

  const data = focusedId ? findFocusedEntityData2D(scene, focusedId) : null;
  const typeLabel = data ? entityTypeLabel(data.bimType, t) : '';
  const display = data ? (typeLabel ? `${typeLabel} ${data.entityName}` : data.entityName) : '';

  return (
    <>
      <canvas
        ref={canvasRef}
        width={viewport.width}
        height={viewport.height}
        className={className ?? 'pointer-events-none absolute inset-0 z-[18]'}
        aria-hidden="true"
      />
      {data && (
        <output
          className="pointer-events-none absolute left-1/2 top-3 z-[19] -translate-x-1/2 select-none rounded-md border border-ring/60 bg-black/75 px-2 py-1 text-xs font-medium text-foreground shadow-lg backdrop-blur-sm"
          aria-live="polite"
        >
          {display}
        </output>
      )}
    </>
  );
}
