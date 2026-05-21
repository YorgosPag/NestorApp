'use client';

/**
 * GanttDependencyArrows — SVG overlay rendering Finish-to-Start dependency arrows.
 *
 * Portaled into `.rmg-timeline-container` so arrows scroll with the timeline content.
 * Only renders when tasks have `dependencies[]` populated.
 * Uses semantic color token `--muted-foreground` for theme-aware rendering (light + dark).
 * Zero pointer-events — does not block Gantt interactions.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-034-gantt-chart-construction-tracking.md §4.8
 */

import React, { useRef, useState, useEffect, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { TaskGroup } from 'react-modern-gantt';
import {
  useGanttDependencyArrows,
  GANTT_SCROLL_CONTAINER_SEL,
} from './hooks/useGanttDependencyArrows';

// ─── Types ─────────────────────────────────────────────────────────────────

interface GanttDependencyArrowsProps {
  containerRef: RefObject<HTMLDivElement | null>;
  taskGroups: TaskGroup[];
}

interface ScrollDims {
  w: number;
  h: number;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function GanttDependencyArrows({ containerRef, taskGroups }: GanttDependencyArrowsProps) {
  const arrows = useGanttDependencyArrows(containerRef, taskGroups);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const [dims, setDims] = useState<ScrollDims>({ w: 0, h: 0 });

  const markerId = useRef(
    `gda-${Math.random().toString(36).slice(2, 8)}`,
  ).current;

  // Find scroll container after Gantt mounts (taskGroups.length change = re-mount)
  useEffect(() => {
    const el = containerRef.current?.querySelector(
      GANTT_SCROLL_CONTAINER_SEL,
    ) as HTMLElement | null;
    if (el) setScrollEl(el);
  }, [containerRef, taskGroups.length]);

  // Track scroll container resize to keep SVG sized correctly
  useEffect(() => {
    if (!scrollEl) return;
    const updateDims = () => setDims({ w: scrollEl.scrollWidth, h: scrollEl.scrollHeight });
    const ro = new ResizeObserver(updateDims);
    ro.observe(scrollEl);
    updateDims();
    return () => ro.disconnect();
  }, [scrollEl]);

  if (!scrollEl || arrows.length === 0 || dims.w === 0) return null;

  return createPortal(
    <svg
      aria-hidden
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: dims.w,
        height: dims.h,
        pointerEvents: 'none',
        overflow: 'visible',
        zIndex: 0,
        color: 'hsl(var(--muted-foreground))',
      }}
    >
      <defs>
        <marker
          id={markerId}
          markerWidth="8"
          markerHeight="6"
          refX="8"
          refY="3"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0,0 L0,6 L8,3 z" style={{ fill: 'currentColor', opacity: 0.55 }} />
        </marker>
      </defs>
      {arrows.map((a) => (
        <path
          key={a.key}
          d={a.path}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeOpacity="0.55"
          strokeDasharray="5 3"
          markerEnd={`url(#${markerId})`}
        />
      ))}
    </svg>,
    scrollEl,
  );
}
