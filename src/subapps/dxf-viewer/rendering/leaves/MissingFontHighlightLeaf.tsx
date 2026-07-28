'use client';

/**
 * MissingFontHighlightLeaf — ADR-040 micro-leaf: dashed orange outline overlay
 * for text entities whose font was substituted (ADR-344 Phase 2, Q20).
 *
 * Architecture (ADR-040 Standard 3):
 * - Subscribes ONLY to missing-font-store via useSyncExternalStore.
 * - CanvasSection / CanvasLayerStack MUST NOT subscribe to this store.
 * - Renders a single <canvas> overlay element (≤1 canvas per leaf rule).
 * - entityBounds prop is provided by Phase 3 layout engine once bounding boxes
 *   are available; until then the overlay renders nothing (graceful no-op).
 *
 * @module rendering/leaves/MissingFontHighlightLeaf
 */

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import {
  subscribeMissingFontReport,
  getMissingFontReport,
} from '../../text-engine/fonts/missing-font-store';
// 🏢 SSoT overlay frame — DPR-aware sizing + πύλη + clear + paint σε ΕΝΑ primitive (ADR-726 Φ2).
import {
  paintOverlayDispatchFrame,
  type OverlayDispatchPainter,
} from '../../components/dxf-layout/overlay-dispatch/overlay-dispatch-frame';
// 🏢 ADR-118 SSoT — ο ουδέτερος μετασχηματισμός· αυτό το overlay ζωγραφίζει ήδη σε screen-space.
import { IDENTITY_VIEW_TRANSFORM } from '../../config/geometry-constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EntityScreenBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MissingFontHighlightLeafProps {
  /** Whether the user clicked "View affected" — controls visibility. */
  highlightActive: boolean;
  /** Screen-space bounds per entity ID, provided by the layout engine (Phase 3). */
  entityBounds: Map<string, EntityScreenBounds>;
  viewport: { width: number; height: number };
  className?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HIGHLIGHT_COLOR = '#f97316'; // Tailwind orange-500
const DASH_PATTERN = [6, 4] as const;
const LINE_WIDTH = 1.5;
const PADDING = 3;

// ─── Leaf component ───────────────────────────────────────────────────────────

export const MissingFontHighlightLeaf = React.memo(
  function MissingFontHighlightLeaf({
    highlightActive,
    entityBounds,
    viewport,
    className,
  }: MissingFontHighlightLeafProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // ADR-040: subscribe ONLY to missing-font-store (module-level stable refs)
    const report = useSyncExternalStore(
      subscribeMissingFontReport,
      getMissingFontReport,
      getMissingFontReport,
    );

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // 🏢 SSoT sizing (ADR-040) — DPR-aware backing store from the authoritative viewport via the
      // ONE core (was JSX `width={viewport.width}` attrs, NO dpr → blurry + buffer desync). The ctx
      // is DPR-scaled → the screen-space `entityBounds` strokeRects stay in CSS coords, unchanged.
      //
      // ADR-726 Φ2 — το highlight είναι σπάνιο (μόνο μετά από «Προβολή επηρεαζόμενων»): χωρίς
      // αναφορά ο καμβάς μένει ανέγγιχτος αντί να ακυρώνει compositor layer σε κάθε repaint.
      const active = highlightActive && !!report && report.affectedEntityIds.length > 0;
      const painter: OverlayDispatchPainter | null = active
        ? (ctx) => {
            ctx.save();
            ctx.strokeStyle = HIGHLIGHT_COLOR;
            ctx.lineWidth = LINE_WIDTH;
            ctx.setLineDash(DASH_PATTERN as unknown as number[]);

            for (const entityId of report.affectedEntityIds) {
              const bounds = entityBounds.get(entityId);
              if (!bounds) continue;

              ctx.strokeRect(
                bounds.x - PADDING,
                bounds.y - PADDING,
                bounds.width + PADDING * 2,
                bounds.height + PADDING * 2,
              );
            }

            ctx.restore();
          }
        : null;

      // Το overlay ζωγραφίζει σε screen-space bounds — δεν χρειάζεται world transform.
      paintOverlayDispatchFrame(canvas, [painter], IDENTITY_VIEW_TRANSFORM, viewport);
    }, [report, highlightActive, entityBounds, viewport.width, viewport.height]);

    return (
      <canvas
        ref={canvasRef}
        className={`pointer-events-none absolute inset-0 w-full h-full ${className ?? ''}`}
        aria-hidden="true"
      />
    );
  },
);
