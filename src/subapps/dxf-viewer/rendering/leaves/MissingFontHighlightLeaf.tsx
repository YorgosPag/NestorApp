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
import type { ViewTransform } from '../types/Types';

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

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!highlightActive || !report || report.affectedEntityIds.length === 0) return;

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
    }, [report, highlightActive, entityBounds]);

    return (
      <canvas
        ref={canvasRef}
        width={viewport.width}
        height={viewport.height}
        className={`pointer-events-none absolute inset-0 ${className ?? ''}`}
        aria-hidden="true"
      />
    );
  },
);
