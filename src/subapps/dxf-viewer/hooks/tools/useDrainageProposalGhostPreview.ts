/**
 * ⚠️  ADR-040 preview-performance contract — READ BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-427 Slice 2 — sanitary-drainage **proposal ghost** preview hook.
 *
 * Micro-leaf consumer (ADR-040) that subscribes to the LOW-FREQUENCY
 * `useDrainageProposal()` store and paints every proposed gravity drain run onto the
 * preview canvas while a network is under review (Revit "Generate → review →
 * accept"). Unlike `useMepSegmentGhostPreview` this hook does NOT subscribe to the
 * 60 fps cursor — the proposal changes only on Generate / Accept / Reject, so a
 * repaint is scheduled solely on proposal change + pan/zoom (`transform`).
 *
 * Each run reuses the shared `MepSegmentGhostRenderer` (one render per segment).
 * Drainage is a SINGLE classification, so the whole network shares one colour —
 * resolved from the SSoT `resolveSegmentClassificationColor('sanitary-drainage')`
 * (brown, the same convention the live `MepSegmentRenderer` uses), NOT a literal
 * hex. The translucent fill is the SSoT `hexToRgba` of that stroke. The outline
 * half-width tracks the sized DN (mm → scene units), so the growing trunk diameters
 * read at a glance.
 *
 * @see ../../bim/mep-segments/MepSegmentGhostRenderer.ts — shared pure renderer
 * @see ../../bim/mep-systems/mep-system-color.ts — classification colour SSoT
 * @see ../../systems/mep-design/drainage/drainage-proposal-store.ts — low-freq source
 * @see ./useWaterProposalGhostPreview.ts — pressurised counterpart
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ViewTransform } from '../../rendering/types/Types';
import { MepSegmentGhostRenderer } from '../../bim/mep-segments/MepSegmentGhostRenderer';
import {
  resolveSegmentClassificationColor,
  hexToRgba,
} from '../../bim/mep-systems/mep-system-color';
import { useDrainageProposal } from '../../systems/mep-design/drainage/drainage-proposal-store';
import { DRAINAGE_CLASSIFICATION } from '../../systems/mep-design/drainage/drainage-design-types';
import { mmToSceneUnits } from '../../utils/scene-units';

/** Neutral fallback if the SSoT ever returns null for the classification (defensive). */
const NEUTRAL_STROKE = '#6b7280';
const GHOST_FILL_ALPHA = 0.22;

export interface UseDrainageProposalGhostPreviewProps {
  readonly transform: ViewTransform;
  getCanvas(): HTMLCanvasElement | null;
  getViewportElement?(): HTMLElement | null;
}

export function useDrainageProposalGhostPreview(
  props: Readonly<UseDrainageProposalGhostPreviewProps>,
): void {
  const { transform, getCanvas, getViewportElement } = props;
  const review = useDrainageProposal();
  const rafRef = useRef<number>(0);
  const prevActiveRef = useRef<boolean>(false);
  const active = review !== null;

  // Single classification → one colour for the whole proposal, straight from the SSoT.
  const palette = useMemo(() => {
    const stroke = resolveSegmentClassificationColor(DRAINAGE_CLASSIFICATION) ?? NEUTRAL_STROKE;
    return { stroke, fill: hexToRgba(stroke, GHOST_FILL_ALPHA) };
  }, []);

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
      for (const seg of network.segments) {
        renderer.render({
          startPoint: seg.start,
          cursor: seg.end,
          sectionWidthCanvas: seg.diameterMm * mmScale,
          domain: 'pipe',
          strokeOverride: palette.stroke,
          fillOverride: palette.fill,
          transform,
          viewport,
        });
      }
    }
  }, [review, transform, getCanvas, getViewportElement, palette]);

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
