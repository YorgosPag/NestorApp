'use client';
/**
 * ADR-920 Β4.8 Β3.5 — the breakline list's legend glyph: a short sample of the line EXACTLY as the plan draws it
 * (same `TopoBreaklineStroke` painter, same `committedBreaklinePaint` specs, same vertex discs). The pattern tells the
 * z-source (solid / dashed / dotted — WCAG 1.4.1, never colour alone); the row also SAYS it in words.
 */

import * as React from 'react';
import type { BreaklineElevationSource } from '../../../systems/topography/topo-types';
import { TopoBreaklineStroke } from '../../../components/dxf-layout/topo-breakline-paint/TopoBreaklineStroke';
import {
  committedBreaklinePaint, COMMITTED_BREAKLINE_DOTS,
} from '../../../components/dxf-layout/topo-breakline-paint/committed-breakline-paint';
import styles from './TopographyPanel.module.css';

/** Swatch viewport (CSS px): long enough for two periods of the 8+4 dash, tall enough for the casing. */
const SWATCH = { width: 40, height: 14, inset: 5 } as const;
const MID_Y = SWATCH.height / 2;
const ENDS = [{ x: SWATCH.inset, y: MID_Y }, { x: SWATCH.width - SWATCH.inset, y: MID_Y }] as const;
const PATH_D = `M${ENDS[0].x} ${MID_Y} H${ENDS[1].x}`;

interface Props {
  readonly source: BreaklineElevationSource | undefined;
}

export function TopoBreaklinePatternSwatch({ source }: Props): React.JSX.Element {
  const paint = committedBreaklinePaint(source, false);
  return (
    <svg
      className={styles.bkSwatch}
      width={SWATCH.width}
      height={SWATCH.height}
      viewBox={`0 0 ${SWATCH.width} ${SWATCH.height}`}
      aria-hidden="true"
      focusable="false"
    >
      <TopoBreaklineStroke
        d={PATH_D}
        vertices={ENDS}
        under={paint.under}
        stroke={paint.stroke}
        dots={COMMITTED_BREAKLINE_DOTS}
      />
    </svg>
  );
}
