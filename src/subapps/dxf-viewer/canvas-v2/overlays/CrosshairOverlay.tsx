'use client';

/**
 * 🏢 ENTERPRISE CROSSHAIR OVERLAY — 2D thin wrapper (ADR-040 / ADR-545)
 *
 * The 2D canvas crosshair. Since ADR-545 the render code (DOM + geometry + badge +
 * aperture) lives in the SHARED `CrosshairCompositor` — ONE source of truth used by
 * both the 2D canvas and the 3D BIM viewport (`BimCrosshairOverlay3D`). This wrapper
 * only wires the 2D-specific POSITION + SNAP drivers into that core:
 *
 *   - Position: `ImmediatePositionStore.registerDirectRender` — the 2D mouse handler
 *     feeds the (already snapped) SCREEN position synchronously, so the crosshair
 *     tracks the pointer 1:1 AND visually «jumps» to the active snap point.
 *   - Snap-active (ADR-515): `ImmediateSnapStore` — hide the centre square while a
 *     snap marker is visible (the marker «κουμπώνει» the centre).
 *
 * Behaviour is byte-identical to the previous monolithic v4 component; only the
 * render code moved to the shared core. The compositor handle is driven imperatively
 * (zero React re-render — ADR-040).
 *
 * @module CrosshairOverlay
 * @version 5.0.0 — Shared-core wrapper (2026-06-27, ADR-545)
 */

import React, { useRef, useEffect } from 'react';
import { CrosshairCompositor, type CrosshairCompositorHandle, type CrosshairCompositorProps } from './CrosshairCompositor';
// 🚀 PERFORMANCE: ImmediatePositionStore for zero-latency crosshair updates
import { registerDirectRender, getImmediatePosition } from '../../systems/cursor/ImmediatePositionStore';
// ADR-515 — κρύψε το κεντρικό τετράγωνο (aperture/APBOX) όταν φωτίζεται έλξη.
import { getFullSnapResult, subscribeSnapResult } from '../../systems/cursor/ImmediateSnapStore';
import { toSnapIndicatorView, isSnapMarkerVisible } from '../../snapping/extended-types';

interface CrosshairOverlayProps extends CrosshairCompositorProps {
  /**
   * AutoCAD-style selection indicator (legacy prop — accepted for call-site
   * compatibility; the badge decision is owned by the shared `resolveHoverBadge` SSoT).
   */
  isEntitySelected?: (id: string) => boolean;
}

export default function CrosshairOverlay({ isEntitySelected: _isEntitySelected, ...compositorProps }: CrosshairOverlayProps) {
  const handleRef = useRef<CrosshairCompositorHandle>(null);

  // 🚀 DIRECT RENDER: synchronous, zero-latency, compositor-only position update.
  // The 2D mouse handler feeds the (snapped) screen position → the crosshair jumps to snap.
  useEffect(() => registerDirectRender((pos) => handleRef.current?.applyTransform(pos)), []);

  // Initial position on mount (the store may already hold a position before the first move).
  useEffect(() => { handleRef.current?.applyTransform(getImmediatePosition()); }, []);

  // ADR-515 — hide/show the centre square as the active snap marker appears/disappears.
  useEffect(() => {
    const refresh = (): void => {
      handleRef.current?.setSnapActive(isSnapMarkerVisible(toSnapIndicatorView(getFullSnapResult())));
    };
    refresh(); // initial sync
    return subscribeSnapResult(refresh);
  }, []);

  return <CrosshairCompositor ref={handleRef} {...compositorProps} />;
}
