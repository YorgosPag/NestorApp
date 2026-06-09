/**
 * ⚠️  ADR-040 preview-performance contract — READ BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-430 Slice 2 — Electrical-strong **proposal ghost** preview hook.
 *
 * Micro-leaf consumer (ADR-040) that subscribes to the LOW-FREQUENCY
 * `useElectricalProposal()` store and paints the proposed circuits' home-run wires onto
 * the preview canvas while a proposal is under review (Revit "Generate → review → accept").
 * Unlike the pipe ghosts there are no segments — the bridge pre-routes each circuit's wire
 * (`computeCircuitWirePaths`) at Generate and stores the polylines, so this hook just
 * strokes them via the SSoT `drawCircuitWires` (colour-by-system ON → each path uses its
 * circuit colour: lighting amber, sockets blue). No 60 fps cursor subscription — a repaint
 * is scheduled solely on proposal change + pan/zoom (`transform`).
 *
 * @see ../../bim/renderers/MepWireRenderer.ts — drawCircuitWires (shared wire draw)
 * @see ../../systems/mep-design/electrical/electrical-proposal-store.ts — low-freq source
 * @see ./useHeatingProposalGhostPreview.ts — the pipe-segment counterpart
 */

import { useCallback, useEffect, useRef } from 'react';
import type { ViewTransform } from '../../rendering/types/Types';
import { drawCircuitWires } from '../../bim/renderers/MepWireRenderer';
import { useElectricalProposal } from '../../systems/mep-design/electrical/electrical-proposal-store';

export interface UseElectricalProposalGhostPreviewProps {
  readonly transform: ViewTransform;
  getCanvas(): HTMLCanvasElement | null;
  getViewportElement?(): HTMLElement | null;
}

export function useElectricalProposalGhostPreview(
  props: Readonly<UseElectricalProposalGhostPreviewProps>,
): void {
  const { transform, getCanvas, getViewportElement } = props;
  const review = useElectricalProposal();
  const rafRef = useRef<number>(0);
  const prevActiveRef = useRef<boolean>(false);
  const active = review !== null;

  const clearCanvas = useCallback(() => {
    const canvas = getCanvas();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, [getCanvas]);

  const drawFrame = useCallback(() => {
    const canvas = getCanvas();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!review || review.wirePaths.length === 0) return;

    const viewportElement = getViewportElement?.() ?? canvas;
    const rect = viewportElement.getBoundingClientRect();
    const viewport = { width: rect.width, height: rect.height };
    if (viewport.width <= 0 || viewport.height <= 0) return;

    // Reuse the SSoT wire draw with colour-by-system ON (each path carries its circuit
    // colour); no hovered circuit during a proposal review.
    drawCircuitWires(ctx, review.wirePaths, transform, viewport, null, true);
  }, [review, transform, getCanvas, getViewportElement]);

  // Clear the ghost once when the review ends (accept / reject).
  useEffect(() => {
    const wasActive = prevActiveRef.current;
    if (wasActive && !active) clearCanvas();
    prevActiveRef.current = active;
  }, [active, clearCanvas]);

  // Repaint on proposal change + pan/zoom while a review is active.
  useEffect(() => {
    if (!active) return;
    rafRef.current = requestAnimationFrame(drawFrame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, drawFrame]);
}
