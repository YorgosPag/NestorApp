/**
 * ⚠️  ADR-040 preview-performance contract — READ BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-434 Slice 2 — Gas (φυσικό αέριο) **proposal ghost** preview hook.
 *
 * Micro-leaf consumer (ADR-040) that subscribes to the LOW-FREQUENCY `useGasProposal()` store
 * and paints every proposed fuel-gas run onto the preview canvas while a network is under
 * review (Revit "Generate → review → accept"). Unlike `useMepSegmentGhostPreview` this hook
 * does NOT subscribe to the 60 fps cursor — the proposal changes only on Generate / Accept /
 * Reject, so a repaint is scheduled solely on proposal change + pan/zoom (`transform`).
 *
 * Each run reuses the shared `MepSegmentGhostRenderer` (one render per segment) in the **fuel**
 * domain, stroked + filled with the SSoT classification colour (`resolveSegmentClassificationColor`
 * → `#eab308` fuel-gas yellow) — zero hardcoded palette. The outline half-width tracks the sized
 * fuel-pipe Ø (mm → scene units), so the diminishing trunk→branch diameters read at a glance.
 *
 * @see ../../bim/mep-segments/MepSegmentGhostRenderer.ts — shared pure renderer
 * @see ../../systems/mep-design/gas/gas-proposal-store.ts — low-freq source
 * @see ./useHvacProposalGhostPreview.ts — the new-system-family template
 */

import { useCallback, useEffect, useRef } from 'react';
import type { ViewTransform } from '../../rendering/types/Types';
import { MepSegmentGhostRenderer } from '../../bim/mep-segments/MepSegmentGhostRenderer';
import {
  resolveSegmentClassificationColor,
  hexToRgba,
} from '../../bim/mep-systems/mep-system-color';
import { useGasProposal } from '../../systems/mep-design/gas/gas-proposal-store';
import { mmToSceneUnits } from '../../utils/scene-units';

/** Translucent fill alpha for the proposal ghost outline (matches the segment ghost). */
const GAS_GHOST_FILL_ALPHA = 0.25;

export interface UseGasProposalGhostPreviewProps {
  readonly transform: ViewTransform;
  getCanvas(): HTMLCanvasElement | null;
  getViewportElement?(): HTMLElement | null;
}

export function useGasProposalGhostPreview(
  props: Readonly<UseGasProposalGhostPreviewProps>,
): void {
  const { transform, getCanvas, getViewportElement } = props;
  const review = useGasProposal();
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

    if (!review) return;

    const viewportElement = getViewportElement?.() ?? canvas;
    const rect = viewportElement.getBoundingClientRect();
    const viewport = { width: rect.width, height: rect.height };
    const mmScale = mmToSceneUnits(review.sceneUnits);
    const renderer = new MepSegmentGhostRenderer(ctx);

    for (const network of review.proposal.networks) {
      // SSoT classification colour (fuel-gas = yellow). `undefined` ⇒ let the renderer fall
      // back to its domain default — never a hardcoded value here.
      const colour = resolveSegmentClassificationColor(network.classification);
      const strokeOverride = colour ?? undefined;
      const fillOverride = colour ? hexToRgba(colour, GAS_GHOST_FILL_ALPHA) : undefined;
      for (const seg of network.segments) {
        renderer.render({
          startPoint: seg.start,
          cursor: seg.end,
          sectionWidthCanvas: seg.diameterMm * mmScale,
          domain: 'fuel',
          strokeOverride,
          fillOverride,
          transform,
          viewport,
        });
      }
    }
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
