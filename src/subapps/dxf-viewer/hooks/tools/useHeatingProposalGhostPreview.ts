/**
 * ⚠️  ADR-040 preview-performance contract — READ BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-428 Slice 2 — heating (hydronic) **proposal ghost** preview hook.
 *
 * Micro-leaf consumer (ADR-040) that subscribes to the LOW-FREQUENCY
 * `useHeatingProposal()` store and paints every proposed hydronic run onto the
 * preview canvas while a network is under review (Revit "Generate → review →
 * accept"). Unlike `useMepSegmentGhostPreview` this hook does NOT subscribe to the
 * 60 fps cursor — the proposal changes only on Generate / Accept / Reject, so a
 * repaint is scheduled solely on proposal change + pan/zoom (`transform`).
 *
 * Each run reuses the shared `MepSegmentGhostRenderer` (one render per segment).
 * Heating is a TWO-pipe loop carrying TWO classifications, so unlike the
 * single-colour drainage ghost the colour is resolved PER SEGMENT from the SSoT
 * `resolveSegmentClassificationColor(seg.classification)` (supply `hydronic-supply`
 * → red, return `hydronic-return` → blue, the same convention the live
 * `MepSegmentRenderer` uses), NOT a literal hex. The translucent fill is the SSoT
 * `hexToRgba` of that stroke. The outline half-width tracks the sized DN (mm →
 * scene units), so the growing trunk diameters read at a glance.
 *
 * @see ../../bim/mep-segments/MepSegmentGhostRenderer.ts — shared pure renderer
 * @see ../../bim/mep-systems/mep-system-color.ts — classification colour SSoT
 * @see ../../systems/mep-design/heating/heating-proposal-store.ts — low-freq source
 * @see ./useDrainageProposalGhostPreview.ts — single-classification counterpart
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ViewTransform } from '../../rendering/types/Types';
import { MepSegmentGhostRenderer } from '../../bim/mep-segments/MepSegmentGhostRenderer';
import {
  resolveSegmentClassificationColor,
  hexToRgba,
} from '../../bim/mep-systems/mep-system-color';
import type { PlumbingSystemClassification } from '../../bim/types/mep-connector-types';
import { useHeatingProposal } from '../../systems/mep-design/heating/heating-proposal-store';
import { mmToSceneUnits } from '../../utils/scene-units';

/** Neutral fallback if the SSoT ever returns null for the classification (defensive). */
const NEUTRAL_STROKE = '#6b7280';
const GHOST_FILL_ALPHA = 0.22;

interface GhostPaint {
  readonly stroke: string;
  readonly fill: string;
}

/** SSoT stroke + translucent fill for a classification (memoised per classification). */
function ghostPaintFor(
  classification: PlumbingSystemClassification,
  cache: Map<PlumbingSystemClassification, GhostPaint>,
): GhostPaint {
  const hit = cache.get(classification);
  if (hit) return hit;
  const stroke = resolveSegmentClassificationColor(classification) ?? NEUTRAL_STROKE;
  const paint: GhostPaint = { stroke, fill: hexToRgba(stroke, GHOST_FILL_ALPHA) };
  cache.set(classification, paint);
  return paint;
}

export interface UseHeatingProposalGhostPreviewProps {
  readonly transform: ViewTransform;
  getCanvas(): HTMLCanvasElement | null;
  getViewportElement?(): HTMLElement | null;
}

export function useHeatingProposalGhostPreview(
  props: Readonly<UseHeatingProposalGhostPreviewProps>,
): void {
  const { transform, getCanvas, getViewportElement } = props;
  const review = useHeatingProposal();
  const rafRef = useRef<number>(0);
  const prevActiveRef = useRef<boolean>(false);
  const active = review !== null;

  // Two classifications → resolve once each, straight from the SSoT, and reuse.
  const paintCache = useMemo(() => new Map<PlumbingSystemClassification, GhostPaint>(), []);

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
        const paint = ghostPaintFor(seg.classification, paintCache);
        renderer.render({
          startPoint: seg.start,
          cursor: seg.end,
          sectionWidthCanvas: seg.diameterMm * mmScale,
          domain: 'pipe',
          strokeOverride: paint.stroke,
          fillOverride: paint.fill,
          transform,
          viewport,
        });
      }
    }
  }, [review, transform, getCanvas, getViewportElement, paintCache]);

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
