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
// 🏢 SSoT overlay frame — DPR-aware sizing + πύλη + clear + paint σε ΕΝΑ primitive (ADR-726 Φ2).
import {
  paintOverlayDispatchFrame,
  type OverlayDispatchPainter,
} from '../components/dxf-layout/overlay-dispatch/overlay-dispatch-frame';

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
  //
  // 🏢 SSoT sizing (ADR-040) — DPR-aware backing store from the authoritative viewport via the ONE
  // core (was JSX `width={viewport.width}` attrs, NO dpr → blurry + buffer desync with siblings).
  // Το κάνει πλέον το `paintOverlayDispatchFrame`, πριν την πύλη.
  //
  // ADR-726 Φ2 — **αυτός ήταν ο «unnamed z18/#10»** των 9 καμβάδων του §4.Γ. Χωρίς εστιασμένη
  // οντότητα (η συνήθης κατάσταση: η εστίαση πληκτρολογίου είναι σπάνια) το overlay καθάριζε
  // άνευ όρων σε **κάθε αλλαγή transform**, δηλαδή σε κάθε pan/zoom — ακυρώνοντας ολόκληρο
  // compositor layer για μηδέν pixel. Τώρα δηλώνει «painter ή null» και η πύλη το σιωπά.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const data = active && focusedId ? findFocusedEntityData2D(scene, focusedId) : null;
    const painter: OverlayDispatchPainter | null = data
      ? (_ctx, t, vp) => paintFocus2DOutline(canvas, data.bbox, t, vp)
      : null;
    paintOverlayDispatchFrame(canvas, [painter], transform, viewport);
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
        className={className ?? 'pointer-events-none absolute inset-0 w-full h-full z-[18]'}
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
