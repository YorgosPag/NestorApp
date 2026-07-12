/**
 * GroupSelectionOverlay — ADR-575 / ADR-640 container-selection affordance (2D).
 *
 * When one or more composite CONTAINERS are selected, draws — per container — ONE dashed
 * bounding box hugging all members + a pill, so the user reads the selection as a single
 * container of N (Figma / Revit / Cinema 4D parity) instead of ambiguous single-member
 * handles. Container-agnostic: a GROUP passes «Ομάδα · N» (ADR-575), a BLOCK passes «Μπλοκ
 * «name» · N» (ADR-640) — the label is pre-computed by each subscriber (with its own `t`)
 * and carried per box, so this ONE presentational component serves both (zero clone).
 *
 * Presentational only: it receives already-computed world-space {@link LabeledSelectionBounds}
 * (SSoT: `computeGroupSelectionBounds` / `computeBlockSelectionBounds`) and projects each box
 * corner world → screen via `CoordinateTransforms.worldToScreen` (the SAME pipeline as entity
 * rendering: Y-inversion + margins), mirroring `SnapIndicatorOverlay`. Pointer-events: none.
 *
 * @see components/dxf-layout/GroupSelectionOverlaySubscriber.tsx — the ADR-040 GROUP leaf.
 * @see components/dxf-layout/BlockSelectionOverlaySubscriber.tsx — the ADR-040 BLOCK leaf.
 */
'use client';

import React from 'react';
import type { ViewTransform } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { UI_COLORS_BASE } from '../../config/color-config';
import type { GroupSelectionBounds } from '../../systems/group/group-selection-bounds';

/** Screen-space padding around the member extents (Figma-style breathing room). */
const BOX_PADDING_PX = 4;
/** Dashed-box dash pattern (px). */
const BOX_DASH = '5 4';

/** A container's bounds + its pre-resolved pill label (group or block, ADR-640). */
export interface LabeledSelectionBounds extends GroupSelectionBounds {
  readonly label: string;
}

interface GroupSelectionOverlayProps {
  readonly groups: readonly LabeledSelectionBounds[];
  readonly viewport: { width: number; height: number };
  readonly transform: ViewTransform;
  readonly className?: string;
}

export default function GroupSelectionOverlay({
  groups,
  viewport,
  transform,
  className = '',
}: GroupSelectionOverlayProps) {
  if (groups.length === 0) return null;

  const t2 = transform as { scale: number; offsetX: number; offsetY: number };

  return (
    <svg
      className={className}
      width={viewport.width}
      height={viewport.height}
      aria-hidden="true"
    >
      {groups.map((g, i) => {
        // Project both AABB corners; Y-inversion means world-min maps below world-max.
        const a = CoordinateTransforms.worldToScreen(g.min, t2, viewport);
        const b = CoordinateTransforms.worldToScreen(g.max, t2, viewport);
        const x = Math.min(a.x, b.x) - BOX_PADDING_PX;
        const y = Math.min(a.y, b.y) - BOX_PADDING_PX;
        const w = Math.abs(b.x - a.x) + BOX_PADDING_PX * 2;
        const h = Math.abs(b.y - a.y) + BOX_PADDING_PX * 2;
        const label = g.label;

        return (
          <g key={`group-sel-${i}`}>
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              fill="none"
              stroke={UI_COLORS_BASE.SELECTION_MARQUEE}
              strokeWidth={1.5}
              strokeDasharray={BOX_DASH}
              rx={2}
            />
            {/* Container pill anchored to the top-left corner, above the box. */}
            <g transform={`translate(${x}, ${y - 20})`}>
              <rect
                x={0}
                y={0}
                width={label.length * 6.5 + 12}
                height={16}
                rx={3}
                fill={UI_COLORS_BASE.SELECTION_MARQUEE}
              />
              <text
                x={6}
                y={12}
                fontSize={11}
                fontFamily="system-ui, sans-serif"
                fill="#ffffff"
              >
                {label}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
