'use client';

/**
 * useGanttDependencyArrows — Computes SVG bezier paths for Gantt dependency arrows.
 *
 * Reads task bar DOM positions from react-modern-gantt rendered elements
 * (`[data-task-id]` + `style.left`/`style.width`) and emits SVG path strings.
 * Re-schedules via RAF-throttled ResizeObserver + scroll + MutationObserver.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-034-gantt-chart-construction-tracking.md §4.8
 */

import { useState, useEffect, type RefObject } from 'react';
import type { TaskGroup } from 'react-modern-gantt';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface DependencyArrow {
  key: string;
  path: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

export const GANTT_SCROLL_CONTAINER_SEL = '.rmg-timeline-container';
const BEZIER_CTRL_MIN = 40;

// ─── Helpers ───────────────────────────────────────────────────────────────

interface BarCoords {
  x1: number;
  x2: number;
  cy: number;
}

function getBarCoords(scrollEl: HTMLElement, taskId: string): BarCoords | null {
  const escaped = taskId.replace(/[^\w-]/g, '\\$&');
  const el = scrollEl.querySelector(`[data-task-id="${escaped}"]`) as HTMLElement | null;
  if (!el) return null;
  const left = parseFloat(el.style.left || '0');
  const width = parseFloat(el.style.width || '0');
  if (width <= 0) return null;
  const elRect = el.getBoundingClientRect();
  const containerRect = scrollEl.getBoundingClientRect();
  const cy = elRect.top - containerRect.top + scrollEl.scrollTop + elRect.height / 2;
  return { x1: left, x2: left + width, cy };
}

function bezierPath(ax: number, ay: number, bx: number, by: number): string {
  const cp = Math.max(BEZIER_CTRL_MIN, Math.abs(bx - ax) * 0.4);
  return `M ${ax} ${ay} C ${ax + cp} ${ay} ${bx - cp} ${by} ${bx} ${by}`;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useGanttDependencyArrows(
  containerRef: RefObject<HTMLDivElement | null>,
  taskGroups: TaskGroup[],
): DependencyArrow[] {
  const [arrows, setArrows] = useState<DependencyArrow[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    const scrollEl = container?.querySelector(
      GANTT_SCROLL_CONTAINER_SEL,
    ) as HTMLElement | null;
    if (!scrollEl) return;

    let rafId: number | null = null;

    const compute = () => {
      const next: DependencyArrow[] = [];
      for (const group of taskGroups) {
        for (const task of group.tasks) {
          if (!task.dependencies?.length) continue;
          const toCoords = getBarCoords(scrollEl, task.id);
          if (!toCoords) continue;
          for (const depId of task.dependencies) {
            const fromCoords = getBarCoords(scrollEl, depId);
            if (!fromCoords) continue;
            next.push({
              key: `${depId}->${task.id}`,
              path: bezierPath(fromCoords.x2, fromCoords.cy, toCoords.x1, toCoords.cy),
            });
          }
        }
      }
      setArrows(next);
    };

    const schedule = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        compute();
      });
    };

    const ro = new ResizeObserver(schedule);
    ro.observe(scrollEl);

    scrollEl.addEventListener('scroll', schedule, { passive: true });

    // Track bar position/size changes during drag and resize
    const mo = new MutationObserver(schedule);
    mo.observe(scrollEl, { attributes: true, attributeFilter: ['style'], subtree: true });

    compute();

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      ro.disconnect();
      mo.disconnect();
      scrollEl.removeEventListener('scroll', schedule);
    };
  }, [containerRef, taskGroups]);

  return arrows;
}
