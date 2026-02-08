'use client';

/**
 * GanttView — Construction Phase Gantt Chart (ADR-034)
 *
 * Main container for the Gantt visualization using react-modern-gantt.
 * Phase 2+3: Firestore integration + editing enabled.
 *
 * Centralized Systems Used:
 * - useSemanticColors() for theme-aware status colors
 * - useTranslation('building') for i18n
 * - useSpacingTokens() for consistent spacing
 * - useIconSizes() for icon dimensions
 * - Card, Badge, Button from @/components/ui
 * - cn() from @/lib/utils
 * - getStatusColor() from @/lib/design-system
 * - useConstructionGantt() for Firestore CRUD
 * - ConstructionPhaseDialog for editing
 *
 * @see docs/centralized-systems/reference/adrs/ADR-034-gantt-chart-construction-tracking.md
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { GanttChart, ViewMode } from 'react-modern-gantt';
import type { Task, TaskColorProps } from 'react-modern-gantt';
import 'react-modern-gantt/dist/index.css';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  BarChart3,
  Plus,
  FolderPlus,
  Loader2,
  Pencil,
  Palette,
  Trash2,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { getStatusColor } from '@/lib/design-system';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { typography as designTypography } from '@/styles/design-tokens';
import { Card, CardContent } from '@/components/ui/card';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { UnifiedColorPicker } from '@/subapps/dxf-viewer/ui/color';
import type { Building } from '../../../BuildingsPageContent';

import { useConstructionGantt } from '../../../hooks/useConstructionGantt';
import { ConstructionPhaseDialog } from '../../../dialogs/ConstructionPhaseDialog';
import type { GanttTaskStatus } from './gantt-mock-data';

// ─── Types ────────────────────────────────────────────────────────────────

interface GanttViewProps {
  building: Building;
}

interface GanttContextMenuState {
  x: number;
  y: number;
  taskId: string;
  groupId: string;
  isPhaseBar: boolean;
}

interface ColorPickerTarget {
  id: string;
  isPhase: boolean;
  currentColor: string;
}

// ─── Gantt Bar Color Resolver ─────────────────────────────────────────────

const STATUS_TO_CSS_COLOR: Record<GanttTaskStatus, string> = {
  completed: 'hsl(var(--status-success))',
  inProgress: 'hsl(var(--status-info))',
  notStarted: 'hsl(var(--muted-foreground))',
  delayed: 'hsl(var(--status-error))',
  blocked: 'hsl(var(--status-warning))',
};

// ─── View Mode Options ────────────────────────────────────────────────────

const AVAILABLE_VIEW_MODES: ViewMode[] = [
  ViewMode.DAY,
  ViewMode.WEEK,
  ViewMode.MONTH,
  ViewMode.QUARTER,
  ViewMode.YEAR,
];

// ─── Component ────────────────────────────────────────────────────────────

export function GanttView({ building }: GanttViewProps) {
  const { t } = useTranslation('building');
  const spacingTokens = useSpacingTokens();
  const iconSizes = useIconSizes();
  const typography = useTypography();
  const colors = useSemanticColors();
  const { resolvedTheme } = useTheme();

  const isDarkMode = resolvedTheme === 'dark';

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.MONTH);

  // Firestore data + CRUD handlers
  const {
    taskGroups,
    stats,
    loading,
    isEmpty,
    dialogState,
    openCreatePhaseDialog,
    openCreateTaskDialog,
    openEditPhaseDialog,
    openEditTaskDialog,
    closeDialog,
    handleTaskUpdate,
    handleTaskClick,
    handleTaskDoubleClick,
    handleGroupClick,
    savePhase,
    updatePhase,
    removePhase,
    saveTask,
    updateTask,
    removeTask,
    updateBarColor,
    phases,
    tasks,
  } = useConstructionGantt(String(building.id));

  // Context menu state (right-click on Gantt bar)
  const [contextMenu, setContextMenu] = useState<GanttContextMenuState | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [colorPickerTarget, setColorPickerTarget] = useState<ColorPickerTarget | null>(null);
  const [pendingColor, setPendingColor] = useState('#3b82f6');
  const contextMenuRef = useRef<HTMLElement>(null);

  // Close context menu on outside click, Escape key, or scroll
  useEffect(() => {
    if (!contextMenu) return;

    const handleOutsideMouseDown = (e: MouseEvent) => {
      if (contextMenuRef.current?.contains(e.target as Node)) return;
      setContextMenu(null);
    };
    const handleOutsideContextMenu = (e: MouseEvent) => {
      if (contextMenuRef.current?.contains(e.target as Node)) return;
      setContextMenu(null);
    };
    const handleScroll = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };

    // Delay to prevent the triggering right-click from immediately closing
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleOutsideMouseDown);
      document.addEventListener('contextmenu', handleOutsideContextMenu);
      document.addEventListener('scroll', handleScroll, true);
      document.addEventListener('keydown', handleKeyDown);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleOutsideMouseDown);
      document.removeEventListener('contextmenu', handleOutsideContextMenu);
      document.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  // Dynamic color resolver for Gantt bars — custom barColor overrides status color
  const getTaskBarColor = useCallback(({ task }: TaskColorProps) => {
    const extended = task as Task & { taskStatus?: GanttTaskStatus; barColor?: string };
    // Custom barColor from Firestore takes priority
    if (extended.barColor) {
      return { backgroundColor: extended.barColor, textColor: 'white' };
    }
    const status = extended.taskStatus ?? 'notStarted';
    const backgroundColor = STATUS_TO_CSS_COLOR[status] ?? STATUS_TO_CSS_COLOR.notStarted;
    return { backgroundColor, textColor: 'white' };
  }, []);

  // ─── Context Menu Handlers ────────────────────────────────────────────

  // Prevent right-click from starting a drag operation in the Gantt library
  const handleGanttMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) {
      // Right-click — stop propagation to prevent library drag
      e.stopPropagation();
    }
  }, []);

  // Detect which task bar was right-clicked — opens custom context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const taskItem = target.closest('.rmg-task-item') as HTMLElement | null;

    if (!taskItem) {
      // Not on a task bar — let browser default context menu show
      setContextMenu(null);
      return;
    }

    // Suppress browser context menu — we show our custom menu instead
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

    // No match found — clear state, but still suppress browser menu on task bars
    setContextMenu(null);
  }, [taskGroups]);

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

    // Find current color
    let currentColor = '#3b82f6';
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

  // Timeline bounds — aligned to month boundaries for correct bar positioning
  const timelineBounds = useMemo(() => {
    const now = new Date();
    let earliest = now;
    let latest = now;

    for (const group of taskGroups) {
      for (const task of group.tasks) {
        const start = task.startDate instanceof Date ? task.startDate : new Date(task.startDate);
        const end = task.endDate instanceof Date ? task.endDate : new Date(task.endDate);
        if (start < earliest) earliest = start;
        if (end > latest) latest = end;
      }
    }

    // Pad: 3 months before earliest, 12 months after latest
    // CRITICAL: Align to 1st of month — the library renders header columns
    // from the 1st of each month, so the startDate must match for correct alignment
    const startDate = new Date(earliest);
    startDate.setMonth(startDate.getMonth() - 3);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(latest);
    endDate.setMonth(endDate.getMonth() + 13);
    endDate.setDate(0); // last day of the +12 month
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
  }, [taskGroups]);

  // Summary stats — 🏢 ENTERPRISE: Centralized UnifiedDashboard (Google-level SSoT)
  const summaryStats = useMemo((): DashboardStat[] => [
    {
      title: t('tabs.timeline.gantt.summary.totalPhases'),
      value: stats.totalPhases,
      icon: BarChart3,
      color: 'blue',
    },
    {
      title: t('tabs.timeline.gantt.summary.completedPhases'),
      value: stats.completedPhases,
      icon: CheckCircle2,
      color: 'green',
    },
    {
      title: t('tabs.timeline.gantt.summary.delayedPhases'),
      value: stats.delayedPhases,
      icon: AlertTriangle,
      color: 'red',
    },
    {
      title: t('tabs.timeline.gantt.summary.overallProgress'),
      value: `${stats.overallProgress}%`,
      icon: Clock,
      color: 'orange',
    },
  ], [stats, t]);

  // ─── Loading State ───────────────────────────────────────────────────

  if (loading) {
    return (
      <section className={cn('flex items-center justify-center', spacingTokens.padding.y['2xl'])}>
        <Loader2 className={cn(iconSizes.xl, 'animate-spin', colors.text.muted)} />
      </section>
    );
  }

  return (
    <section className={cn('flex flex-col', spacingTokens.gap.sm)} aria-label={t('tabs.timeline.gantt.title')}>
      {/* Toolbar: New Phase / New Task */}
      <nav className={cn('flex items-center', spacingTokens.gap.sm)} aria-label="Gantt actions">
        <Button variant="default" size="sm" onClick={openCreatePhaseDialog}>
          <FolderPlus className={cn(iconSizes.xs, spacingTokens.margin.right.xs)} />
          {t('tabs.timeline.gantt.actions.newPhase')}
        </Button>
        {phases.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => openCreateTaskDialog(phases[0].id)}
          >
            <Plus className={cn(iconSizes.xs, spacingTokens.margin.right.xs)} />
            {t('tabs.timeline.gantt.actions.newTask')}
          </Button>
        )}
      </nav>

      {/* Summary Cards — 🏢 ENTERPRISE: Centralized UnifiedDashboard */}
      {!isEmpty && (
        <UnifiedDashboard
          stats={summaryStats}
          columns={4}
          className=""
        />
      )}

      {/* Empty State */}
      {isEmpty && (
        <Card>
          <CardContent className={cn('flex flex-col items-center justify-center text-center', spacingTokens.padding.y['2xl'])}>
            <BarChart3 className={cn(iconSizes.xl2, colors.text.muted, spacingTokens.margin.bottom.md)} />
            <p className={cn(typography.heading.md, colors.text.muted)}>
              {t('tabs.timeline.gantt.empty')}
            </p>
            <p className={cn(typography.body.sm, colors.text.muted, spacingTokens.margin.top.xs)}>
              {t('tabs.timeline.gantt.emptyHint')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Gantt Chart — with right-click context menu via portal */}
      {!isEmpty && (
        <Card className="border-0 shadow-none" onContextMenu={handleContextMenu}>
          <CardContent className={spacingTokens.padding.none} onMouseDownCapture={handleGanttMouseDown}>
            <GanttChart
              tasks={taskGroups}
              startDate={timelineBounds.startDate}
              endDate={timelineBounds.endDate}
              title={t('tabs.timeline.gantt.title')}
              headerLabel={building.name ?? t('tabs.timeline.gantt.title')}
              viewMode={viewMode}
              viewModes={AVAILABLE_VIEW_MODES}
              onViewModeChange={setViewMode}
              darkMode={isDarkMode}
              showProgress
              showCurrentDateMarker
              todayLabel={t('tabs.timeline.gantt.toolbar.today')}
              editMode
              allowProgressEdit
              allowTaskResize
              allowTaskMove
              movementThreshold={5}
              onTaskUpdate={handleTaskUpdate}
              onTaskClick={handleTaskClick}
              onTaskDoubleClick={handleTaskDoubleClick}
              onGroupClick={handleGroupClick}
              locale="el-GR"
              fontSize={designTypography.fontSize.sm}
              getTaskColor={getTaskBarColor}
            />
          </CardContent>
        </Card>
      )}

      {/* Custom Context Menu — portal-rendered at exact cursor coordinates */}
      {contextMenu && createPortal(
        <nav
          ref={contextMenuRef}
          className="fixed z-50 min-w-48 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
            onClick={handleEditFromMenu}
          >
            <Pencil className={cn(iconSizes.xs, spacingTokens.margin.right.xs)} />
            {contextMenu.isPhaseBar
              ? t('tabs.timeline.gantt.contextMenu.editPhase')
              : t('tabs.timeline.gantt.contextMenu.editTask')}
          </button>
          <div className="-mx-1 my-1 h-px bg-border" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
            onClick={handleNewPhaseFromMenu}
          >
            <FolderPlus className={cn(iconSizes.xs, spacingTokens.margin.right.xs)} />
            {t('tabs.timeline.gantt.contextMenu.newPhase')}
          </button>
          <button
            type="button"
            role="menuitem"
            className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
            onClick={handleNewTaskFromMenu}
          >
            <Plus className={cn(iconSizes.xs, spacingTokens.margin.right.xs)} />
            {t('tabs.timeline.gantt.contextMenu.newTask')}
          </button>
          <div className="-mx-1 my-1 h-px bg-border" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
            onClick={handleChangeColorFromMenu}
          >
            <Palette className={cn(iconSizes.xs, spacingTokens.margin.right.xs)} />
            {t('tabs.timeline.gantt.contextMenu.changeColor')}
          </button>
          <div className="-mx-1 my-1 h-px bg-border" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none text-destructive hover:bg-destructive/10"
            onClick={handleDeleteFromMenu}
          >
            <Trash2 className={cn(iconSizes.xs, spacingTokens.margin.right.xs)} />
            {t('tabs.timeline.gantt.contextMenu.delete')}
          </button>
        </nav>,
        document.body
      )}

      {/* Phase Status Legend */}
      {!isEmpty && (
        <Card>
          <CardContent className={cn('flex flex-wrap items-center', spacingTokens.gap.sm, spacingTokens.padding.sm)}>
            <Badge variant="default" className={getStatusColor('active', 'bg')}>
              {t('tabs.timeline.gantt.status.completed')}
            </Badge>
            <Badge variant="default" className={getStatusColor('pending', 'bg')}>
              {t('tabs.timeline.gantt.status.inProgress')}
            </Badge>
            <Badge variant="secondary">
              {t('tabs.timeline.gantt.status.notStarted')}
            </Badge>
            <Badge variant="destructive">
              {t('tabs.timeline.gantt.status.delayed')}
            </Badge>
            <Badge variant="outline" className={cn(getStatusColor('construction', 'border'), getStatusColor('construction', 'text'))}>
              {t('tabs.timeline.gantt.status.blocked')}
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* ─── Color Picker Dialog ──────────────────────────────────────────── */}
      <Dialog open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('tabs.timeline.gantt.contextMenu.colorPickerTitle')}</DialogTitle>
          </DialogHeader>
          <UnifiedColorPicker
            variant="full"
            value={pendingColor}
            onChange={setPendingColor}
            showPalettes
            showRecent
          />
          <DialogFooter className={cn('flex justify-end', spacingTokens.gap.sm)}>
            <Button variant="outline" onClick={() => setColorPickerOpen(false)}>
              {t('tabs.timeline.gantt.dialog.cancel')}
            </Button>
            <Button onClick={handleColorPickerSave}>
              {t('tabs.timeline.gantt.dialog.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Construction Phase/Task Dialog */}
      <ConstructionPhaseDialog
        open={dialogState.open}
        mode={dialogState.mode}
        onClose={closeDialog}
        phase={dialogState.phase}
        task={dialogState.task}
        phaseId={dialogState.phaseId}
        phases={phases}
        onSavePhase={savePhase}
        onUpdatePhase={updatePhase}
        onDeletePhase={removePhase}
        onSaveTask={saveTask}
        onUpdateTask={updateTask}
        onDeleteTask={removeTask}
      />
    </section>
  );
}
