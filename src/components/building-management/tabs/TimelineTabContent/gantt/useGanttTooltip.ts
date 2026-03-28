/**
 * useGanttTooltip — Custom hover tooltip logic for GanttView (ADR-034)
 *
 * Extracted from GanttView.tsx for SRP compliance (Google file-size standards).
 * Manages portal-based hover tooltip state, position computation,
 * pointer move/leave handlers, tooltip refresh on data changes, and drag-end effects.
 *
 * The library tooltip renders INSIDE .rmg-timeline-container (overflow-x: auto)
 * which clips it behind the header. This custom tooltip uses createPortal to
 * document.body, escaping all overflow containers.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-034-gantt-chart-construction-tracking.md
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDateShort } from '@/lib/intl-utils';
import type { Task, TaskGroup } from 'react-modern-gantt';
import type { HoverTooltipData } from './gantt-view-config';
import type { useGanttCascadeDrag } from './hooks/useGanttCascadeDrag';

/** Return type of useGanttCascadeDrag hook */
type GanttCascadeDragReturn = ReturnType<typeof useGanttCascadeDrag>;

// ─── Hook Input ───────────────────────────────────────────────────────────

interface UseGanttTooltipParams {
  taskGroups: TaskGroup[];
  cascadeDrag: GanttCascadeDragReturn;
}

// ─── Hook Output ──────────────────────────────────────────────────────────

export interface UseGanttTooltipReturn {
  tooltipData: HoverTooltipData | null;
  tooltipElRef: React.RefObject<HTMLDivElement | null>;
  isDraggingRef: React.RefObject<boolean>;
  setTooltipData: React.Dispatch<React.SetStateAction<HoverTooltipData | null>>;
  computeTooltipPosition: (clientX: number, clientY: number) => { x: number; y: number };
  handleGanttPointerMove: (e: React.PointerEvent) => void;
  handleGanttPointerLeave: () => void;
  handleGanttMouseDown: (e: React.MouseEvent) => void;
}

// ─── Hook Implementation ─────────────────────────────────────────────────

export function useGanttTooltip({
  taskGroups,
  cascadeDrag,
}: UseGanttTooltipParams): UseGanttTooltipReturn {
  const [tooltipData, setTooltipData] = useState<HoverTooltipData | null>(null);
  const tooltipElRef = useRef<HTMLDivElement>(null);
  const hoveredTaskRef = useRef('');
  const isDraggingRef = useRef(false);

  // Compute tooltip coordinates clamped to viewport
  const computeTooltipPosition = useCallback((clientX: number, clientY: number) => {
    const tooltipWidth = 220;
    const tooltipHeight = 120;
    return {
      x: Math.min(clientX + 16, window.innerWidth - tooltipWidth - 8),
      y: Math.max(8, Math.min(clientY - tooltipHeight, window.innerHeight - tooltipHeight - 8)),
    };
  }, []);

  // Reset drag state on mouse/pointer up (window-level)
  // Small delay on reset to prevent tooltip flicker at drag end
  useEffect(() => {
    const handleMouseUp = () => {
      cascadeDrag.onDragEnd();
      setTimeout(() => { isDraggingRef.current = false; }, 300);
    };
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('pointerup', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('pointerup', handleMouseUp);
    };
  }, [cascadeDrag]);

  // Prevent right-click drag + track drag state for tooltip stability
  const handleGanttMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) {
      e.stopPropagation();
      return;
    }
    const target = e.target as HTMLElement;
    const taskItem = target.closest('.rmg-task-item') as HTMLElement | null;
    if (taskItem) {
      isDraggingRef.current = true;
      cascadeDrag.onDragStart(taskItem, taskItem.getAttribute('data-task-id') ?? '');
    }
  }, [cascadeDrag]);

  const handleGanttPointerMove = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    const taskItem = target.closest('.rmg-task-item') as HTMLElement | null;

    // Update position via ref (no re-render needed for same-task moves)
    if (tooltipElRef.current && taskItem) {
      const pos = computeTooltipPosition(e.clientX, e.clientY);
      tooltipElRef.current.style.left = `${pos.x}px`;
      tooltipElRef.current.style.top = `${pos.y}px`;
    }

    if (!taskItem) {
      // During drag, do NOT hide tooltip — pointer may momentarily leave the task element
      if (isDraggingRef.current) return;
      if (hoveredTaskRef.current) {
        hoveredTaskRef.current = '';
        setTooltipData(null);
      }
      return;
    }

    // Match by task name — only update state when task changes
    const taskNameEl = taskItem.querySelector('.rmg-task-item-name');
    const taskName = taskNameEl?.textContent?.trim() ?? '';

    if (taskName === hoveredTaskRef.current) return;
    hoveredTaskRef.current = taskName;

    // Calculate initial position for correct first-frame render
    const initialPos = computeTooltipPosition(e.clientX, e.clientY);

    for (const group of taskGroups) {
      const matched = group.tasks.find((tsk) => tsk.name === taskName);
      if (matched) {
        const start = matched.startDate instanceof Date
          ? matched.startDate : new Date(matched.startDate);
        const end = matched.endDate instanceof Date
          ? matched.endDate : new Date(matched.endDate);
        const durationDays = Math.ceil(
          (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
        );
        const taskProgress = (matched as Task & { progress?: number }).progress ?? 0;

        setTooltipData({
          name: matched.name,
          startDate: formatDateShort(start),
          endDate: formatDateShort(end),
          duration: durationDays,
          progress: taskProgress,
          x: initialPos.x,
          y: initialPos.y,
        });
        return;
      }
    }

    hoveredTaskRef.current = '';
    setTooltipData(null);
  }, [taskGroups, computeTooltipPosition]);

  const handleGanttPointerLeave = useCallback(() => {
    // During drag, keep tooltip visible — pointer may leave container momentarily
    if (isDraggingRef.current) return;
    hoveredTaskRef.current = '';
    setTooltipData(null);
  }, []);

  // Refresh tooltip data when taskGroups change (after drag/resize/progress edit)
  useEffect(() => {
    const taskName = hoveredTaskRef.current;
    if (!taskName || !tooltipData) return;

    for (const group of taskGroups) {
      const matched = group.tasks.find((tsk) => tsk.name === taskName);
      if (matched) {
        const start = matched.startDate instanceof Date
          ? matched.startDate : new Date(matched.startDate);
        const end = matched.endDate instanceof Date
          ? matched.endDate : new Date(matched.endDate);
        const durationDays = Math.ceil(
          (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
        );
        const taskProgress = (matched as Task & { progress?: number }).progress ?? 0;

        setTooltipData((prev) => prev ? {
          ...prev,
          startDate: formatDateShort(start),
          endDate: formatDateShort(end),
          duration: durationDays,
          progress: taskProgress,
        } : null);
        return;
      }
    }
  }, [taskGroups]); // intentionally watches only taskGroups

  return {
    tooltipData,
    tooltipElRef,
    isDraggingRef,
    setTooltipData,
    computeTooltipPosition,
    handleGanttPointerMove,
    handleGanttPointerLeave,
    handleGanttMouseDown,
  };
}
