/**
 * useGanttContextMenu — Context menu state and handlers for GanttView (ADR-034)
 *
 * Extracted from GanttView.tsx for SRP compliance (Google file-size standards).
 * Manages right-click context menu state, delayed activation, keyboard/scroll
 * listeners, click-outside detection, and all context menu action handlers.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-034-gantt-chart-construction-tracking.md
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { colors as tokenColors } from '@/styles/design-tokens';
import type { TaskGroup } from 'react-modern-gantt';
import type { GanttContextMenuState, ColorPickerTarget } from './gantt-view-config';
import type { ConstructionPhase, ConstructionTask } from '@/types/building/construction';

// ─── Hook Input ───────────────────────────────────────────────────────────

interface UseGanttContextMenuParams {
  taskGroups: TaskGroup[];
  phases: ConstructionPhase[];
  tasks: ConstructionTask[];
  openCreatePhaseDialog: () => void;
  openCreateTaskDialog: (phaseId: string) => void;
  openEditPhaseDialog: (phase: ConstructionPhase) => void;
  openEditTaskDialog: (task: ConstructionTask) => void;
  removePhase: (phaseId: string) => Promise<boolean | void>;
  removeTask: (taskId: string) => Promise<boolean | void>;
  updateBarColor: (id: string, isPhase: boolean, color: string) => Promise<void>;
}

// ─── Hook Output ──────────────────────────────────────────────────────────

interface UseGanttContextMenuReturn {
  contextMenu: GanttContextMenuState | null;
  contextMenuRef: React.RefObject<HTMLElement | null>;
  colorPickerOpen: boolean;
  colorPickerTarget: ColorPickerTarget | null;
  pendingColor: string;
  setColorPickerOpen: (open: boolean) => void;
  setPendingColor: (color: string) => void;
  handleContextMenu: (e: React.MouseEvent) => void;
  handleEditFromMenu: () => void;
  handleNewPhaseFromMenu: () => void;
  handleNewTaskFromMenu: () => void;
  handleDeleteFromMenu: () => Promise<void>;
  handleChangeColorFromMenu: () => void;
  handleColorPickerSave: () => Promise<void>;
}

// ─── Hook Implementation ─────────────────────────────────────────────────

export function useGanttContextMenu({
  taskGroups,
  phases,
  tasks,
  openCreatePhaseDialog,
  openCreateTaskDialog,
  openEditPhaseDialog,
  openEditTaskDialog,
  removePhase,
  removeTask,
  updateBarColor,
}: UseGanttContextMenuParams): UseGanttContextMenuReturn {
  const [contextMenu, setContextMenu] = useState<GanttContextMenuState | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [colorPickerTarget, setColorPickerTarget] = useState<ColorPickerTarget | null>(null);
  const [pendingColor, setPendingColor] = useState<string>(tokenColors.blue['500']);
  const contextMenuRef = useRef<HTMLElement>(null);

  // ─── Delayed Activation ─────────────────────────────────────────────
  // Prevents the triggering right-click from immediately closing the menu
  const [contextMenuClickEnabled, setContextMenuClickEnabled] = useState(false);

  useEffect(() => {
    if (!contextMenu) {
      setContextMenuClickEnabled(false);
      return;
    }
    const timer = setTimeout(() => setContextMenuClickEnabled(true), 0);
    return () => clearTimeout(timer);
  }, [contextMenu]);

  // Centralized useClickOutside hook for mousedown outside-click detection
  const closeContextMenu = useCallback(() => setContextMenu(null), []);
  useClickOutside(contextMenuRef, closeContextMenu, { enabled: contextMenuClickEnabled });

  // Close context menu on right-click outside, Escape key, or scroll
  useEffect(() => {
    if (!contextMenu) return;

    const handleOutsideContextMenu = (e: MouseEvent) => {
      if (contextMenuRef.current?.contains(e.target as Node)) return;
      setContextMenu(null);
    };
    const handleScroll = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };

    // Same delay as click-outside to prevent immediate close
    const timer = setTimeout(() => {
      document.addEventListener('contextmenu', handleOutsideContextMenu);
      document.addEventListener('scroll', handleScroll, true);
      document.addEventListener('keydown', handleKeyDown);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('contextmenu', handleOutsideContextMenu);
      document.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  // ─── Context Menu Detection ─────────────────────────────────────────

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const taskItem = target.closest('.rmg-task-item') as HTMLElement | null;

    if (!taskItem) {
      setContextMenu(null);
      return;
    }

    e.preventDefault();

    // Try data attribute first, fall back to name matching
    const dataTaskId = taskItem.getAttribute('data-task-id');

    if (dataTaskId) {
      for (const group of taskGroups) {
        const matched = group.tasks.find((tsk) => tsk.id === dataTaskId);
        if (matched) {
          setContextMenu({
            x: e.clientX,
            y: e.clientY,
            taskId: matched.id,
            groupId: group.id,
            isPhaseBar: matched.id.startsWith('phase-bar-'),
          });
          return;
        }
      }
    }

    // Fallback: match by task name text content
    const taskNameEl = taskItem.querySelector('.rmg-task-item-name');
    const taskName = taskNameEl?.textContent?.trim() ?? '';

    for (const group of taskGroups) {
      const matched = group.tasks.find((tsk) => tsk.name === taskName);
      if (matched) {
        setContextMenu({
          x: e.clientX,
          y: e.clientY,
          taskId: matched.id,
          groupId: group.id,
          isPhaseBar: matched.id.startsWith('phase-bar-'),
        });
        return;
      }
    }

    setContextMenu(null);
  }, [taskGroups]);

  // ─── Action Handlers ────────────────────────────────────────────────

  const handleEditFromMenu = useCallback(() => {
    if (!contextMenu) return;
    if (contextMenu.isPhaseBar) {
      const phaseId = contextMenu.taskId.replace('phase-bar-', '');
      const fullPhase = phases.find((p) => p.id === phaseId);
      if (fullPhase) openEditPhaseDialog(fullPhase);
    } else {
      const fullTask = tasks.find((tsk) => tsk.id === contextMenu.taskId);
      if (fullTask) openEditTaskDialog(fullTask);
    }
    setContextMenu(null);
  }, [contextMenu, phases, tasks, openEditPhaseDialog, openEditTaskDialog]);

  const handleNewPhaseFromMenu = useCallback(() => {
    openCreatePhaseDialog();
    setContextMenu(null);
  }, [openCreatePhaseDialog]);

  const handleNewTaskFromMenu = useCallback(() => {
    if (!contextMenu) return;
    openCreateTaskDialog(contextMenu.groupId);
    setContextMenu(null);
  }, [contextMenu, openCreateTaskDialog]);

  const handleDeleteFromMenu = useCallback(async () => {
    if (!contextMenu) return;
    if (contextMenu.isPhaseBar) {
      const phaseId = contextMenu.taskId.replace('phase-bar-', '');
      await removePhase(phaseId);
    } else {
      await removeTask(contextMenu.taskId);
    }
    setContextMenu(null);
  }, [contextMenu, removePhase, removeTask]);

  const handleChangeColorFromMenu = useCallback(() => {
    if (!contextMenu) return;
    const isPhase = contextMenu.isPhaseBar;
    const targetId = isPhase
      ? contextMenu.taskId.replace('phase-bar-', '')
      : contextMenu.taskId;

    let currentColor: string = tokenColors.blue['500'];
    if (isPhase) {
      const phase = phases.find((p) => p.id === targetId);
      if (phase?.barColor) currentColor = phase.barColor;
    } else {
      const task = tasks.find((tsk) => tsk.id === targetId);
      if (task?.barColor) currentColor = task.barColor;
    }

    setColorPickerTarget({ id: targetId, isPhase, currentColor });
    setPendingColor(currentColor);
    setColorPickerOpen(true);
    setContextMenu(null);
  }, [contextMenu, phases, tasks]);

  const handleColorPickerSave = useCallback(async () => {
    if (!colorPickerTarget) return;
    await updateBarColor(colorPickerTarget.id, colorPickerTarget.isPhase, pendingColor);
    setColorPickerOpen(false);
    setColorPickerTarget(null);
  }, [colorPickerTarget, pendingColor, updateBarColor]);

  return {
    contextMenu,
    contextMenuRef,
    colorPickerOpen,
    colorPickerTarget,
    pendingColor,
    setColorPickerOpen,
    setPendingColor,
    handleContextMenu,
    handleEditFromMenu,
    handleNewPhaseFromMenu,
    handleNewTaskFromMenu,
    handleDeleteFromMenu,
    handleChangeColorFromMenu,
    handleColorPickerSave,
  };
}
