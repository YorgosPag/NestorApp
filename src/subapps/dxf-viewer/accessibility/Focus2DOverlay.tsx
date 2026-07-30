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

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { getKeyboardFocus2DManager } from './keyboard-focus-2d-manager';
import { paintFocus2DOutline } from './focus-2d-outline-painter';
import { findFocusedEntityData2D } from './focus-2d-order';
import { entityTypeLabel } from '../bim-3d/accessibility/status-bar-text-generator';
import type { DxfScene } from '../canvas-v2/dxf-canvas/dxf-types';
import type { Viewport } from '../rendering/types/Types';
// 🏢 SSoT overlay frame — DPR-aware sizing + πύλη + clear + paint σε ΕΝΑ primitive (ADR-726 Φ2).
import {
  paintOverlayDispatchFrame,
  type OverlayDispatchPainter,
} from '../components/dxf-layout/overlay-dispatch/overlay-dispatch-frame';
// ADR-040 Phase XXII.B — zero-lag: transform από το SSoT στο draw time + scheduler frame
// αντί για React prop (ιδίωμα HomeRunWiresOverlay).
import { getImmediateTransform } from '../systems/cursor/ImmediateTransformStore';
import { subscribeImmediateTransformFrame } from '../rendering/core/immediate-transform-frame';

export interface Focus2DOverlayProps {
  readonly scene: DxfScene | null;
  readonly viewport: Viewport;
  /** Hide the overlay outright while in 3D mode — caller gates via ViewMode3DStore. */
  readonly active: boolean;
  readonly className?: string;
}

/**
 * Outer gate (ADR-732 Batch 3 — mount-on-demand): κατέχει ΜΟΝΟ τα low-freq subscriptions.
 * Χωρίς keyboard focus (η συνήθης κατάσταση — η εστίαση πληκτρολογίου είναι σπάνια) ΔΕΝ
 * υπάρχει καν canvas element στο DOM ⇒ μηδέν compositor layer. Το unmount είναι η
 * ισχυρότερη μορφή της Φ2 πύλης (ADR-726 §4.Γ — αυτός ήταν ο «unnamed z18/#10»).
 */
export function Focus2DOverlay({
  scene,
  viewport,
  active,
  className,
}: Focus2DOverlayProps) {
  const focusManager = getKeyboardFocus2DManager();

  const focusedId = useSyncExternalStore(
    (listener) => focusManager.subscribe(listener),
    () => focusManager.getFocused(),
    () => null,
  );

  // Active = false (mode flip to 3D) → clear focus state so re-entering 2D starts fresh.
  // (Το stale-outline πρόβλημα δεν υπάρχει πια: το inner canvas κάνει unmount μαζί με το focus.)
  useEffect(() => {
    if (!active) focusManager.clear();
  }, [active, focusManager]);

  if (!active || !focusedId) return null;
  return (
    <Focus2DOverlayCanvas
      scene={scene}
      viewport={viewport}
      focusedId={focusedId}
      className={className}
    />
  );
}

/** Inner canvas — mounted ΜΟΝΟ όσο υπάρχει εστιασμένη οντότητα. */
function Focus2DOverlayCanvas({
  scene,
  viewport,
  focusedId,
  className,
}: {
  readonly scene: Focus2DOverlayProps['scene'];
  readonly viewport: Focus2DOverlayProps['viewport'];
  readonly focusedId: string;
  readonly className?: string;
}) {
  const { t } = useTranslation('bim3d');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Paint on focus/transform/scene change. Outline anchors to the entity's
  // world bbox, so pan/zoom requires a repaint at the new screen position.
  //
  // 🏢 SSoT sizing (ADR-040) — DPR-aware backing store from the authoritative viewport via the ONE
  // core (was JSX `width={viewport.width}` attrs, NO dpr → blurry + buffer desync with siblings).
  // Το κάνει πλέον το `paintOverlayDispatchFrame`, πριν την πύλη.
  // Volatile low-freq inputs μέσω ref (ιδίωμα HomeRunWires: ref bundle + 2 effects).
  const drawStateRef = useRef({ focusedId, scene, viewport });
  drawStateRef.current = { focusedId, scene, viewport };

  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = drawStateRef.current;
    const data = findFocusedEntityData2D(s.scene, s.focusedId);
    const painter: OverlayDispatchPainter | null = data
      ? (_ctx, t, vp) => paintFocus2DOutline(canvas, data.bbox, t, vp)
      : null;
    paintOverlayDispatchFrame(canvas, [painter], getImmediateTransform(), s.viewport);
  }, []);

  // (α) Repaint σε content change (focus/scene/viewport) με ΑΚΙΝΗΤΟ transform.
  useEffect(() => {
    repaint();
  }, [focusedId, scene, viewport, repaint]);

  // (β) Zero-lag pan/zoom — scheduler frame gated στο immediate transform (XXII.B).
  useEffect(() => {
    return subscribeImmediateTransformFrame('focus-2d-overlay', 'Focus 2D Overlay', repaint);
  }, [repaint]);

  const data = findFocusedEntityData2D(scene, focusedId);
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
