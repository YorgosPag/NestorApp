'use client';

import { useEffect, useRef, type RefObject } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────

export interface TaskMutationEvent {
  taskElement: HTMLElement;
  taskLeft: number;
  taskWidth: number;
  newStartDate: Date;
  newEndDate: Date;
  durationDays: number;
}

interface UseGanttDragObserverOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  timelineBounds: { startDate: Date; endDate: Date };
  isDraggingRef: RefObject<boolean>;
  onProgressMutation: (progressPct: number) => void;
  onTaskPositionMutation: (event: TaskMutationEvent) => void;
  shouldSkipMutation?: () => boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;

// ─── Hook ─────────────────────────────────────────────────────────────────

/**
 * useGanttDragObserver — Shared MutationObserver for Gantt drag interactions.
 *
 * Single observer, pluggable callbacks via stable refs (no stale closures).
 * Computes dates/position once and distributes to all consumers (SSoT).
 *
 * Responsibilities:
 * 1. Progress fill % changes → onProgressMutation
 * 2. Task bar left/width changes during drag → onTaskPositionMutation
 *
 * @see useGanttCascadeDrag — consumes onTaskPositionMutation for cascade logic
 */
export function useGanttDragObserver({
  containerRef,
  timelineBounds,
  isDraggingRef,
  onProgressMutation,
  onTaskPositionMutation,
  shouldSkipMutation,
}: UseGanttDragObserverOptions): void {
  // 🏢 GOOGLE PATTERN: Callback refs — always point to latest closure,
  // so the MutationObserver never holds stale references.
  const onProgressRef = useRef(onProgressMutation);
  const onPositionRef = useRef(onTaskPositionMutation);
  const shouldSkipRef = useRef(shouldSkipMutation);

  onProgressRef.current = onProgressMutation;
  onPositionRef.current = onTaskPositionMutation;
  shouldSkipRef.current = shouldSkipMutation;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new MutationObserver((mutations) => {
      // Guard: skip mutations caused by cascade transforms (infinite loop prevention)
      if (shouldSkipRef.current?.()) return;

      for (const mutation of mutations) {
        const target = mutation.target as HTMLElement;

        // Case 1: Progress fill width changed → update progress %
        if (target.classList?.contains('rmg-progress-fill')) {
          const widthStr = target.style.width;
          if (!widthStr) continue;
          onProgressRef.current(Math.round(parseFloat(widthStr)));
          continue;
        }

        // Case 2: Task item left/width changed (resize/move drag) → recalculate dates
        const taskEl = target.classList?.contains('rmg-task-item')
          ? target
          : target.closest('.rmg-task-item') as HTMLElement | null;

        if (taskEl && isDraggingRef.current) {
          const scrollContainer = container.querySelector(
            '.rmg-timeline-container'
          ) as HTMLElement | null;
          if (!scrollContainer) continue;

          const totalWidth = scrollContainer.scrollWidth;
          if (totalWidth <= 0) continue;

          const taskLeft = parseFloat(taskEl.style.left || '0');
          const taskWidth = parseFloat(taskEl.style.width || '0');
          if (taskWidth <= 0) continue;

          const boundsStart = timelineBounds.startDate.getTime();
          const boundsEnd = timelineBounds.endDate.getTime();
          const totalMs = boundsEnd - boundsStart;

          const newStartMs = boundsStart + (taskLeft / totalWidth) * totalMs;
          const newEndMs =
            boundsStart + ((taskLeft + taskWidth) / totalWidth) * totalMs;

          onPositionRef.current({
            taskElement: taskEl,
            taskLeft,
            taskWidth,
            newStartDate: new Date(newStartMs),
            newEndDate: new Date(newEndMs),
            durationDays: Math.max(
              1,
              Math.ceil((newEndMs - newStartMs) / MS_PER_DAY)
            ),
          });
          continue;
        }
      }
    });

    observer.observe(container, {
      attributes: true,
      attributeFilter: ['style'],
      subtree: true,
    });

    return () => observer.disconnect();
  }, [timelineBounds, containerRef, isDraggingRef]);
}
