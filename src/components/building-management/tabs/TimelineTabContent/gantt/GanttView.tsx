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
 * Extracted modules (SRP):
 * - gantt-view-config.ts — Types and constants
 * - useGanttContextMenu.ts — Context menu state + handlers
 * - useGanttTooltip.ts — Hover tooltip state + handlers
 * - GanttPortals.tsx — Portal-rendered UI (menu, tooltip, color picker, legend)
 * - GanttToolbar.tsx — Action toolbar + export dropdown
 *
 * @see docs/centralized-systems/reference/adrs/ADR-034-gantt-chart-construction-tracking.md
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatDateShort } from '@/lib/intl-utils';
import { useTheme } from 'next-themes';
import { GanttChart, ViewMode } from 'react-modern-gantt';
import type { Task, TaskColorProps } from 'react-modern-gantt';
import 'react-modern-gantt/dist/index.css';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';

import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useFullscreen } from '@/hooks/useFullscreen';
import { FullscreenOverlay } from '@/core/containers/FullscreenOverlay';
import { useTypography } from '@/hooks/useTypography';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { typography as designTypography } from '@/styles/design-tokens';
import { Card, CardContent } from '@/components/ui/card';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';

import { useConstructionGantt } from '../../../hooks/useConstructionGantt';
import { ConstructionPhaseDialog } from '../../../dialogs/ConstructionPhaseDialog';
import type { GanttTaskStatus } from './gantt-mock-data';
import { useGanttDragObserver } from './hooks/useGanttDragObserver';
import { useGanttCascadeDrag } from './hooks/useGanttCascadeDrag';

// ─── Extracted Modules (SRP) ──────────────────────────────────────────────

import type { GanttViewProps } from './gantt-view-config';
import { STATUS_TO_CSS_COLOR, AVAILABLE_VIEW_MODES } from './gantt-view-config';
import { useGanttContextMenu } from './useGanttContextMenu';
import { useGanttTooltip } from './useGanttTooltip';
import {
  GanttContextMenuPortal,
  GanttTooltipPortal,
  GanttColorPickerDialog,
  GanttLegendBadges,
  GanttFullscreenLegend,
} from './GanttPortals';
import { GanttActionToolbar } from './GanttToolbar';

// ─── Re-exports for backward compatibility ────────────────────────────────

export type {
  GanttViewProps,
  GanttContextMenuState,
  ColorPickerTarget,
  HoverTooltipData,
} from './gantt-view-config';
export { STATUS_TO_CSS_COLOR, AVAILABLE_VIEW_MODES } from './gantt-view-config';

// ─── Component ────────────────────────────────────────────────────────────

export function GanttView({ building }: GanttViewProps) {
  const { t } = useTranslation('building');
  const spacingTokens = useSpacingTokens();
  const iconSizes = useIconSizes();
  const typography = useTypography();
  const colors = useSemanticColors();
  const { resolvedTheme } = useTheme();

  const isDarkMode = resolvedTheme === 'dark';
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.MONTH);
  const ganttChartRef = useRef<HTMLDivElement>(null);

  // ENTERPRISE: Scroll to today marker with retry for library render timing
  const scrollToTodayMarker = useCallback((container: HTMLElement) => {
    const attemptScroll = (retriesLeft: number) => {
      const todayMarker = container.querySelector('[data-testid="today-marker"]') as HTMLElement | null;
      const scrollContainer = container.querySelector('.rmg-timeline-container') as HTMLElement | null;

      console.warn('[Gantt] scrollToTodayMarker', {
        retriesLeft,
        markerFound: !!todayMarker,
        scrollContainerFound: !!scrollContainer,
        markerLeft: todayMarker?.style.left,
        markerOffsetLeft: todayMarker?.offsetLeft,
        scrollWidth: scrollContainer?.scrollWidth,
        clientWidth: scrollContainer?.clientWidth,
      });

      if (todayMarker && scrollContainer) {
        const markerLeftPx = parseFloat(todayMarker.style.left || '0');
        if (markerLeftPx > 0) {
          const targetScroll = Math.max(0, markerLeftPx - scrollContainer.clientWidth * 0.15);
          scrollContainer.scrollLeft = targetScroll;
        }
      } else if (retriesLeft > 0) {
        setTimeout(() => attemptScroll(retriesLeft - 1), 400);
      }
    };
    attemptScroll(5);
  }, []);

  const handleViewModeChange = useCallback((newMode: ViewMode) => {
    setViewMode(newMode);
    const delays = [200, 500, 1000, 1500];
    delays.forEach((delay) => {
      setTimeout(() => {
        const container = ganttChartRef.current;
        if (!container) return;
        scrollToTodayMarker(container);
      }, delay);
    });
  }, [scrollToTodayMarker]);

  const fullscreen = useFullscreen();

  // Firestore data + CRUD handlers
  const {
    taskGroups, stats, loading, isEmpty,
    dialogState, openCreatePhaseDialog, openCreateTaskDialog,
    openEditPhaseDialog, openEditTaskDialog, closeDialog,
    handleTaskUpdate, handleTaskClick, handleTaskDoubleClick, handleGroupClick,
    savePhase, updatePhase, removePhase,
    saveTask, updateTask, removeTask,
    updateBarColor, phases, tasks,
  } = useConstructionGantt(String(building.id));

  // ─── Extracted Hooks ────────────────────────────────────────────────

  const {
    contextMenu, contextMenuRef, colorPickerOpen, pendingColor,
    setColorPickerOpen, setPendingColor,
    handleContextMenu, handleEditFromMenu, handleNewPhaseFromMenu,
    handleNewTaskFromMenu, handleDeleteFromMenu,
    handleChangeColorFromMenu, handleColorPickerSave,
  } = useGanttContextMenu({
    taskGroups, phases, tasks,
    openCreatePhaseDialog, openCreateTaskDialog,
    openEditPhaseDialog, openEditTaskDialog,
    removePhase, removeTask, updateBarColor,
  });

  // Timeline bounds — aligned to month boundaries
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

    const startDate = new Date(earliest);
    startDate.setMonth(startDate.getMonth() - 3);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(latest);
    endDate.setMonth(endDate.getMonth() + 13);
    endDate.setDate(0);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
  }, [taskGroups]);

  // Visual cascade drag hook
  const cascadeDrag = useGanttCascadeDrag({ containerRef: ganttChartRef, taskGroups });

  // Tooltip hook (portal-based)
  const {
    tooltipData, tooltipElRef, isDraggingRef, setTooltipData,
    handleGanttPointerMove, handleGanttPointerLeave, handleGanttMouseDown,
  } = useGanttTooltip({ taskGroups, cascadeDrag });

  // Shared MutationObserver — progress + position + cascade (SSoT)
  useGanttDragObserver({
    containerRef: ganttChartRef,
    timelineBounds,
    isDraggingRef,
    shouldSkipMutation: cascadeDrag.isCascading,
    onProgressMutation: (progressPct) => {
      setTooltipData((prev) => {
        if (!prev) return null;
        if (prev.progress === progressPct) return prev;
        return { ...prev, progress: progressPct };
      });
    },
    onTaskPositionMutation: (event) => {
      cascadeDrag.onTaskPositionMutation(event);
      setTooltipData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          startDate: formatDateShort(event.newStartDate),
          endDate: formatDateShort(event.newEndDate),
          duration: event.durationDays,
        };
      });
    },
  });

  // Dynamic color resolver for Gantt bars
  const getTaskBarColor = useCallback(({ task }: TaskColorProps) => {
    const extended = task as Task & { taskStatus?: GanttTaskStatus; barColor?: string };
    if (extended.barColor) {
      return { backgroundColor: extended.barColor, textColor: 'white' };
    }
    const status = extended.taskStatus ?? 'notStarted';
    const backgroundColor = STATUS_TO_CSS_COLOR[status] ?? STATUS_TO_CSS_COLOR.notStarted;
    return { backgroundColor, textColor: 'white' };
  }, []);

  // i18n labels
  const tooltipLabels = useMemo(() => ({
    start: t('tabs.timeline.gantt.tooltip.start'),
    end: t('tabs.timeline.gantt.tooltip.end'),
    duration: t('tabs.timeline.gantt.tooltip.duration'),
    progress: t('tabs.timeline.gantt.tooltip.progress'),
    days: t('tabs.timeline.gantt.tooltip.days'),
  }), [t]);

  const contextMenuLabels = useMemo(() => ({
    editPhase: t('tabs.timeline.gantt.contextMenu.editPhase'),
    editTask: t('tabs.timeline.gantt.contextMenu.editTask'),
    newPhase: t('tabs.timeline.gantt.contextMenu.newPhase'),
    newTask: t('tabs.timeline.gantt.contextMenu.newTask'),
    changeColor: t('tabs.timeline.gantt.contextMenu.changeColor'),
    colorPickerTitle: t('tabs.timeline.gantt.contextMenu.colorPickerTitle'),
    delete: t('tabs.timeline.gantt.contextMenu.delete'),
  }), [t]);

  // Auto-scroll to today on initial mount
  useEffect(() => {
    if (loading || isEmpty) return;
    const timeout = setTimeout(() => {
      const container = ganttChartRef.current;
      if (!container) return;
      scrollToTodayMarker(container);
    }, 800);
    return () => clearTimeout(timeout);
  }, [loading, isEmpty]);

  // Summary stats
  const summaryStats = useMemo((): DashboardStat[] => [
    { title: t('tabs.timeline.gantt.summary.totalPhases'), value: stats.totalPhases, icon: BarChart3, color: 'blue' },
    { title: t('tabs.timeline.gantt.summary.completedPhases'), value: stats.completedPhases, icon: CheckCircle2, color: 'green' },
    { title: t('tabs.timeline.gantt.summary.delayedPhases'), value: stats.delayedPhases, icon: AlertTriangle, color: 'red' },
    { title: t('tabs.timeline.gantt.summary.overallProgress'), value: `${stats.overallProgress}%`, icon: Clock, color: 'orange' },
  ], [stats, t]);

  if (loading) {
    return (
      <section className={cn('flex items-center justify-center', spacingTokens.padding.y['2xl'])}>
        <Spinner size="large" />
      </section>
    );
  }

  // Shared Gantt Chart props
  const ganttChartProps = {
    tasks: taskGroups,
    startDate: timelineBounds.startDate,
    endDate: timelineBounds.endDate,
    title: t('tabs.timeline.gantt.title'),
    headerLabel: building.name ?? t('tabs.timeline.gantt.title'),
    viewMode,
    viewModes: AVAILABLE_VIEW_MODES,
    onViewModeChange: handleViewModeChange,
    darkMode: isDarkMode,
    showProgress: true,
    showCurrentDateMarker: true,
    todayLabel: t('tabs.timeline.gantt.toolbar.today'),
    editMode: true,
    allowProgressEdit: true,
    allowTaskResize: true,
    allowTaskMove: true,
    movementThreshold: 5,
    onTaskUpdate: handleTaskUpdate,
    onTaskClick: handleTaskClick,
    onTaskDoubleClick: handleTaskDoubleClick,
    onGroupClick: handleGroupClick,
    locale: 'el-GR' as const,
    fontSize: designTypography.fontSize.sm,
    getTaskColor: getTaskBarColor,
  };

  const buildingName = building.name ?? '';

  return (
    <section className={cn('flex-1 flex flex-col min-h-0', spacingTokens.gap.sm)} aria-label={t('tabs.timeline.gantt.title')}>
      {/* Toolbar */}
      <GanttActionToolbar
        phases={phases}
        isEmpty={isEmpty}
        ganttChartRef={ganttChartRef}
        buildingName={buildingName}
        taskGroups={taskGroups}
        openCreatePhaseDialog={openCreatePhaseDialog}
        openCreateTaskDialog={openCreateTaskDialog}
        onEnterFullscreen={fullscreen.enter}
      />

      {/* Summary Cards */}
      {!isEmpty && <UnifiedDashboard stats={summaryStats} columns={4} className="shrink-0" />}

      {/* Empty State */}
      {isEmpty && (
        <Card>
          <CardContent className={cn('flex flex-col items-center justify-center text-center', spacingTokens.padding.y['2xl'])}>
            <BarChart3 className={cn(iconSizes.xl2, colors.text.muted, spacingTokens.margin.bottom.md)} />
            <p className={cn(typography.heading.md, colors.text.muted)}>{t('tabs.timeline.gantt.empty')}</p>
            <p className={cn(typography.body.sm, colors.text.muted, spacingTokens.margin.top.xs)}>{t('tabs.timeline.gantt.emptyHint')}</p>
          </CardContent>
        </Card>
      )}

      {/* Gantt Chart */}
      {!isEmpty && (
        <Card
          className="flex-1 flex flex-col min-h-0 border-0 shadow-none"
          onContextMenu={handleContextMenu}
          onPointerMove={handleGanttPointerMove}
          onPointerLeave={handleGanttPointerLeave}
        >
          <CardContent className={cn('flex-1 min-h-0 overflow-auto', spacingTokens.padding.none)} onMouseDownCapture={handleGanttMouseDown}>
            <div ref={ganttChartRef}>
              <GanttChart {...ganttChartProps} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fullscreen (ADR-241) */}
      {fullscreen.isFullscreen && (
        <FullscreenOverlay
          isFullscreen
          onToggle={fullscreen.toggle}
          headerContent={
            <span className="font-semibold">
              {buildingName || t('tabs.timeline.gantt.title')} — {t('tabs.timeline.gantt.title')}
            </span>
          }
          ariaLabel={t('tabs.timeline.gantt.title')}
        >
          <GanttActionToolbar
            phases={phases}
            isEmpty={false}
            ganttChartRef={ganttChartRef}
            buildingName={buildingName}
            taskGroups={taskGroups}
            openCreatePhaseDialog={openCreatePhaseDialog}
            openCreateTaskDialog={openCreateTaskDialog}
            onEnterFullscreen={fullscreen.enter}
            className="px-2 pt-2"
          />
          <UnifiedDashboard stats={summaryStats} columns={4} className="flex-shrink-0 px-2 pb-2" />
          <section
            className="flex-1 min-h-0 overflow-auto px-2"
            onContextMenu={handleContextMenu}
            onPointerMove={handleGanttPointerMove}
            onPointerLeave={handleGanttPointerLeave}
          >
            <div className="h-full" onMouseDownCapture={handleGanttMouseDown}>
              <GanttChart {...ganttChartProps} />
            </div>
          </section>
          <GanttFullscreenLegend />
        </FullscreenOverlay>
      )}

      {/* Portal-rendered UI */}
      {contextMenu && (
        <GanttContextMenuPortal
          contextMenu={contextMenu}
          contextMenuRef={contextMenuRef}
          labels={contextMenuLabels}
          onEdit={handleEditFromMenu}
          onNewPhase={handleNewPhaseFromMenu}
          onNewTask={handleNewTaskFromMenu}
          onChangeColor={handleChangeColorFromMenu}
          onDelete={handleDeleteFromMenu}
        />
      )}
      {tooltipData && (
        <GanttTooltipPortal tooltipData={tooltipData} tooltipElRef={tooltipElRef} labels={tooltipLabels} />
      )}

      {/* Legend + Dialogs */}
      {!isEmpty && <GanttLegendBadges />}
      <GanttColorPickerDialog
        open={colorPickerOpen}
        onOpenChange={setColorPickerOpen}
        pendingColor={pendingColor}
        onColorChange={setPendingColor}
        onSave={handleColorPickerSave}
        title={contextMenuLabels.colorPickerTitle}
      />
      <ConstructionPhaseDialog
        open={dialogState.open}
        mode={dialogState.mode}
        onClose={closeDialog}
        phase={dialogState.phase}
        task={dialogState.task}
        phaseId={dialogState.phaseId}
        phases={phases}
        buildingId={building.id as string}
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
