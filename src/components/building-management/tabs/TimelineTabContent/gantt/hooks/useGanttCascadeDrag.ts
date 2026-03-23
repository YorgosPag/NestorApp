'use client';

import { useRef, useMemo, useCallback, type RefObject } from 'react';
import type { TaskGroup } from 'react-modern-gantt';
import type { TaskMutationEvent } from './useGanttDragObserver';

// ─── Types ────────────────────────────────────────────────────────────────

interface UseGanttCascadeDragOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  taskGroups: TaskGroup[];
}

interface UseGanttCascadeDragReturn {
  /** Call on mousedown when a task bar is clicked */
  onDragStart: (taskElement: HTMLElement, dataTaskId: string) => void;
  /** Call from MutationObserver when a task position changes during drag */
  onTaskPositionMutation: (event: TaskMutationEvent) => void;
  /** Returns true while cascade transforms are being applied (guard for observer) */
  isCascading: () => boolean;
  /** Call on mouseup/pointerup to reset all cascade state */
  onDragEnd: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────

/**
 * useGanttCascadeDrag — Self-contained visual cascade for phase bar dragging.
 *
 * When a phase bar (parent) is dragged, all sibling task bars in the same row
 * follow visually in real-time via CSS translateX. On drop, transforms are
 * cleared so the library can re-render with actual positions.
 *
 * All guard refs are hidden inside the hook — zero exposure to component scope.
 *
 * 🏢 GOOGLE PATTERN: All external data accessed via refs, so every returned
 * callback is truly stable (same reference across all renders). This eliminates
 * stale closure bugs when callbacks are used inside useCallback([]) or useEffect([]).
 */
export function useGanttCascadeDrag({
  containerRef,
  taskGroups,
}: UseGanttCascadeDragOptions): UseGanttCascadeDragReturn {
  // ─── Internal Refs (hidden from component) ────────────────────────────
  const draggedPhaseGroupIdRef = useRef<string | null>(null);
  const phaseBarOriginalLeftRef = useRef(0);
  const isCascadingRef = useRef(false);
  const lastCascadeOffsetRef = useRef(0);

  // 🏢 GOOGLE PATTERN: Data refs — always point to latest values,
  // making all callbacks truly stable (zero stale closures).
  const taskGroupsRef = useRef(taskGroups);
  taskGroupsRef.current = taskGroups;

  // Pre-computed map: dataTaskId → groupId (O(1) lookup for phase bar detection)
  const phaseBarTaskIdMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of taskGroups) {
      for (const task of group.tasks) {
        if (task.id.startsWith('phase-bar-')) {
          map.set(task.id, group.id);
        }
      }
    }
    return map;
  }, [taskGroups]);

  const phaseBarTaskIdMapRef = useRef(phaseBarTaskIdMap);
  phaseBarTaskIdMapRef.current = phaseBarTaskIdMap;

  // ─── onDragStart (truly stable — reads refs, not closures) ────────────
  const onDragStart = useCallback((taskElement: HTMLElement, dataTaskId: string): void => {
    // Primary path: O(1) lookup via pre-computed map
    const groupId = phaseBarTaskIdMapRef.current.get(dataTaskId);
    if (groupId) {
      draggedPhaseGroupIdRef.current = groupId;
      phaseBarOriginalLeftRef.current = parseFloat(
        taskElement.style.left || '0'
      );
      return;
    }

    // Fallback: the library may not set data-task-id on all elements.
    // Match by task name text content against known phase bars.
    const taskNameEl = taskElement.querySelector('.rmg-task-item-name');
    const taskName = taskNameEl?.textContent?.trim() ?? '';
    if (!taskName) return;

    for (const group of taskGroupsRef.current) {
      const matched = group.tasks.find(
        (tsk) => tsk.id.startsWith('phase-bar-') && tsk.name === taskName
      );
      if (matched) {
        draggedPhaseGroupIdRef.current = group.id;
        phaseBarOriginalLeftRef.current = parseFloat(
          taskElement.style.left || '0'
        );
        break;
      }
    }
  }, []); // truly stable: reads phaseBarTaskIdMapRef + taskGroupsRef

  // ─── onTaskPositionMutation (truly stable — only refs) ────────────────
  const onTaskPositionMutation = useCallback((event: TaskMutationEvent): void => {
    if (!draggedPhaseGroupIdRef.current) return;

    const offsetPx = event.taskLeft - phaseBarOriginalLeftRef.current;

    // Avoid redundant DOM writes — threshold 0.5px
    if (Math.abs(offsetPx - lastCascadeOffsetRef.current) <= 0.5) return;
    lastCascadeOffsetRef.current = offsetPx;

    const parentRow = event.taskElement.closest('.rmg-task-row');
    if (!parentRow) return;

    // Guard: prevent observer from reacting to our own transform changes
    isCascadingRef.current = true;
    const siblings = parentRow.querySelectorAll('.rmg-task-item');
    siblings.forEach((el) => {
      if (el !== event.taskElement) {
        (el as HTMLElement).style.transform = `translateX(${offsetPx}px)`;
      }
    });
    // Release guard after microtask (mutations are batched synchronously)
    queueMicrotask(() => {
      isCascadingRef.current = false;
    });
  }, []); // truly stable: only refs

  // ─── isCascading (truly stable) ──────────────────────────────────────
  const isCascading = useCallback((): boolean => isCascadingRef.current, []);

  // ─── onDragEnd (truly stable — containerRef is stable React ref) ──────
  const onDragEnd = useCallback((): void => {
    if (!draggedPhaseGroupIdRef.current) return;

    const container = containerRef.current;
    if (container) {
      isCascadingRef.current = true;
      const items = container.querySelectorAll('.rmg-task-item');
      items.forEach((el) => {
        (el as HTMLElement).style.transform = '';
      });
      queueMicrotask(() => {
        isCascadingRef.current = false;
      });
    }

    draggedPhaseGroupIdRef.current = null;
    phaseBarOriginalLeftRef.current = 0;
    lastCascadeOffsetRef.current = 0;
  }, [containerRef]); // containerRef is a stable React ref object

  return { onDragStart, onTaskPositionMutation, isCascading, onDragEnd };
}
