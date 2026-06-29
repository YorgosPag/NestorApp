'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 + ADR-552 + ADR-554 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 * docs/centralized-systems/reference/adrs/ADR-554-proposal-dispatch-canvas.md
 *
 * ADR-554 — MEP proposal-ghost dispatch canvas (7 → 1).
 *
 * ONE read-only, pointer-events-none canvas that replaces the 7 separate `ProposalGhostOverlay`
 * canvases (water/drainage/heating/electrical/HVAC/fire/gas — ADR-426–434 Slice 2; ADR-551 §5.2 #2).
 * Calls the 7 painter hooks (each self-subscribes + self-gates on its own low-freq proposal store)
 * and paints in z-order in ONE frame: size+clear ONCE, then each active painter.
 *
 * **Zero-lag** (unlike the analytical dispatch, which is React-`useEffect`-driven): proposals must
 * track pan/zoom frame-for-frame, so this reprojects in a LOW-priority `UnifiedFrameScheduler` frame
 * reading `getImmediateTransform()` at draw time — the exact mechanism the former `ProposalGhostOverlay`
 * used, now ONE subscription for all 7 disciplines instead of one per active discipline.
 *
 * ADR-040: leaf component (child of the 2D preview-mounts group) — the shell `CanvasLayerStack` gains
 * no new `useSyncExternalStore` (CHECK 6C safe). Aggregates the SAME low-freq subscriptions the 7 old
 * overlays had, in ONE component; all low-freq (proposal under review), never 60fps.
 */

import { useCallback, useEffect, useRef } from 'react';
import { paintOverlayDispatchFrame } from '../overlay-dispatch/overlay-dispatch-frame';
import type { OverlayDispatchPainter } from '../overlay-dispatch/overlay-dispatch-frame';
import { getImmediateTransform } from '../../../systems/cursor/ImmediateTransformStore';
import { subscribeImmediateTransformFrame } from '../../../rendering/core/immediate-transform-frame';
import type { Viewport } from '../../../rendering/types/Types';
import { useWaterProposalPainter } from './use-water-proposal-painter';
import { useDrainageProposalPainter } from './use-drainage-proposal-painter';
import { useHeatingProposalPainter } from './use-heating-proposal-painter';
import { useElectricalProposalPainter } from './use-electrical-proposal-painter';
import { useHvacProposalPainter } from './use-hvac-proposal-painter';
import { useFireProposalPainter } from './use-fire-proposal-painter';
import { useGasProposalPainter } from './use-gas-proposal-painter';

export interface ProposalDispatchCanvasProps {
  readonly viewport: Viewport;
}

export function ProposalDispatchCanvas({ viewport }: ProposalDispatchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // z-order (matches the former DOM mount order): water → drainage → heating → electrical →
  // hvac → fire → gas (topmost). Proposals are practically mutually exclusive, so overlap is
  // theoretical; if two were ever active, later painters draw on top — same as the old stacking.
  const water = useWaterProposalPainter();
  const drainage = useDrainageProposalPainter();
  const heating = useHeatingProposalPainter();
  const electrical = useElectricalProposalPainter();
  const hvac = useHvacProposalPainter();
  const fire = useFireProposalPainter();
  const gas = useGasProposalPainter();

  // Refs read at frame time so the scheduler callback never re-registers on data/resize change.
  const paintersRef = useRef<ReadonlyArray<OverlayDispatchPainter | null>>([]);
  paintersRef.current = [water, drainage, heating, electrical, hvac, fire, gas];
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  // Clear (dpr-scaled) + paint with the IMMEDIATE transform — read at draw time, never the prop.
  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const vp = viewportRef.current;
    if (vp.width <= 0 || vp.height <= 0) return;
    paintOverlayDispatchFrame(canvas, paintersRef.current, getImmediateTransform(), vp);
  }, []);

  // Zero-lag pan/zoom: reproject in the LOW-priority scheduler frame (after the 2D canvases),
  // gated on the immediate transform changing. ONE subscription for all 7 disciplines.
  useEffect(() => subscribeImmediateTransformFrame('proposal-dispatch', 'Proposal Dispatch', repaint), [repaint]);

  // Repaint on proposal change / resize (transform unchanged ⇒ the scheduler would not fire).
  useEffect(() => {
    repaint();
  }, [water, drainage, heating, electrical, hvac, fire, gas, viewport, repaint]);

  return (
    <canvas
      ref={canvasRef}
      data-dxf-overlay="proposal-dispatch"
      className="pointer-events-none absolute inset-0 w-full h-full z-[14]"
      aria-hidden="true"
    />
  );
}
