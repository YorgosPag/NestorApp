/**
 * ⚠️  ADR-040 preview-performance contract — READ BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-433 Slice 2 — Fire-protection (sprinkler) **proposal ghost** preview hook.
 *
 * Micro-leaf consumer (ADR-040) that subscribes to the LOW-FREQUENCY `useFireProposal()`
 * store and paints every proposed wet-pipe run onto the preview canvas while a network is
 * under review (Revit "Generate → review → accept"). Unlike `useMepSegmentGhostPreview`
 * this hook does NOT subscribe to the 60 fps cursor — the proposal changes only on
 * Generate / Accept / Reject, so a repaint is scheduled solely on proposal change +
 * pan/zoom (`transform`).
 *
 * Each run reuses the shared `MepSegmentGhostRenderer` (one render per segment) in the
 * **pipe** domain, stroked with the SSoT classification colour
 * (`resolveSegmentClassificationColor` → `#b91c1c` fire-red) — zero hardcoded palette. The
 * outline half-width tracks the sized pipe DN (mm → scene units), so the diminishing
 * trunk→branch diameters read at a glance.
 *
 * @see ../../bim/mep-segments/MepSegmentGhostRenderer.ts — shared pure renderer
 * @see ../../systems/mep-design/fire/fire-proposal-store.ts — low-freq source
 * @see ./useHvacProposalGhostPreview.ts — the duct counterpart / template
 */

import { useCallback, useEffect, useRef } from 'react';
import type { ViewTransform } from '../../rendering/types/Types';
import { MepSegmentGhostRenderer } from '../../bim/mep-segments/MepSegmentGhostRenderer';
import { resolveSegmentClassificationColor } from '../../bim/mep-systems/mep-system-color';
import { useFireProposal } from '../../systems/mep-design/fire/fire-proposal-store';
import { mmToSceneUnits } from '../../utils/scene-units';

export interface UseFireProposalGhostPreviewProps {
  readonly transform: ViewTransform;
  getCanvas(): HTMLCanvasElement | null;
  getViewportElement?(): HTMLElement | null;
}

export function useFireProposalGhostPreview(
  props: Readonly<UseFireProposalGhostPreviewProps>,
): void {
  const { transform, getCanvas, getViewportElement } = props;
  const review = useFireProposal();
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
      // SSoT classification colour (fire-sprinkler = fire-red). `undefined` ⇒ let the
      // renderer fall back to its pipe-domain default — never a hardcoded value here.
      const strokeOverride =
        resolveSegmentClassificationColor(network.classification) ?? undefined;
      for (const seg of network.segments) {
        renderer.render({
          startPoint: seg.start,
          cursor: seg.end,
          sectionWidthCanvas: seg.diameterMm * mmScale,
          domain: 'pipe',
          strokeOverride,
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
