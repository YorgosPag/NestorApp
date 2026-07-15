/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-656 M12 — NorthArrowLeaf: the live North-arrow HUD (screen consumer).
 *
 * A screen-anchored SVG symbol at the top-right corner (like a title-block north arrow), NOT a
 * transform-dependent overlay: the viewer has no view rotation, so North stays put on pan/zoom —
 * the arrow only re-orients when the mode (Grid/True), the geo-reference, or the survey change.
 *
 * ADR-040: a thin micro-leaf that self-subscribes ONLY to low-freq stores (north-arrow options,
 * geo-reference, topo) via `useSyncExternalStore` — never in the CanvasSection/CanvasLayerStack
 * Shell (CHECK 6C). The angle math is the ONE `north-arrow-model`; the outline is the ONE config.
 */

'use client';

import { useSyncExternalStore } from 'react';
import { getTopoPoints, getTopoState, subscribeTopo } from '../../systems/topography/TopoPointStore';
import { getGeoReference, subscribeGeoReference } from '../../systems/geo-referencing/geo-reference-store';
import { northAngleDeg, surveyCentroidEN, svgRotationDeg } from '../../systems/topography/north-arrow-model';
import { getNorthArrowOptions, subscribeNorthArrow } from '../../systems/topography/north-arrow-store';
import {
  NORTH_ARROW_UNIT_OUTLINE, TOPO_NORTH_COLOR, TOPO_NORTH_GLYPH,
  TOPO_NORTH_SCREEN_BOX_PX, TOPO_NORTH_SVG_VIEWBOX, TOPO_NORTH_SVG_ARROW_SIZE, TOPO_NORTH_SVG_GLYPH_SIZE,
} from '../../systems/topography/north-arrow-config';

const CENTER = TOPO_NORTH_SVG_VIEWBOX / 2;

/** The arrowhead path in viewBox units (tip up), derived from the ONE config outline (Y-up → SVG Y-down). */
const ARROW_PATH = `${NORTH_ARROW_UNIT_OUTLINE
  .map((u, i) =>
    `${i === 0 ? 'M' : 'L'} ${CENTER + u.x * TOPO_NORTH_SVG_ARROW_SIZE} ${CENTER - u.y * TOPO_NORTH_SVG_ARROW_SIZE}`)
  .join(' ')} Z`;

export interface NorthArrowLeafProps {
  /** Positioning classes from the Shell (absolute corner, z-index, pointer-events-none). */
  className?: string;
}

export function NorthArrowLeaf({ className }: NorthArrowLeafProps) {
  const opts = useSyncExternalStore(subscribeNorthArrow, getNorthArrowOptions, getNorthArrowOptions);
  const geo = useSyncExternalStore(subscribeGeoReference, getGeoReference, getGeoReference);
  // Re-render when the survey changes (points load) — the centroid drives the True-North γ.
  useSyncExternalStore(subscribeTopo, getTopoState, getTopoState);

  if (!opts.visible) return null;

  const angle = northAngleDeg(opts.mode, geo, surveyCentroidEN(getTopoPoints()));
  const rotate = svgRotationDeg(angle);

  return (
    <div className={className}>
      <svg
        width={TOPO_NORTH_SCREEN_BOX_PX}
        height={TOPO_NORTH_SCREEN_BOX_PX}
        viewBox={`0 0 ${TOPO_NORTH_SVG_VIEWBOX} ${TOPO_NORTH_SVG_VIEWBOX}`}
        aria-hidden
      >
        <g transform={`rotate(${rotate} ${CENTER} ${CENTER})`}>
          <path d={ARROW_PATH} fill={TOPO_NORTH_COLOR} />
          <text
            x={CENTER} y={TOPO_NORTH_SVG_GLYPH_SIZE * 0.6}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={TOPO_NORTH_SVG_GLYPH_SIZE} fontFamily="sans-serif" fontWeight="bold"
            fill={TOPO_NORTH_COLOR}
          >
            {TOPO_NORTH_GLYPH}
          </text>
        </g>
      </svg>
    </div>
  );
}
