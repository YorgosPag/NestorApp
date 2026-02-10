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
  Download,
  FileText,
  ImageIcon,
  FileImage,
  Table2,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { getStatusColor } from '@/lib/design-system';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { typography as designTypography, zIndex, colors } from '@/styles/design-tokens';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

import {
  exportGanttToPDF,
  exportGanttAsImage,
  exportGanttToExcel,
} from '@/services/gantt-export';
import type { GanttExportFormat } from '@/services/gantt-export';
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

interface HoverTooltipData {
  name: string;
  startDate: string;
  endDate: string;
  duration: number;
  progress: number;
  x: number;
  y: number;
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
  const { t, i18n } = useTranslation('building');
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

  // ─── Export State ─────────────────────────────────────────────────────
  const ganttChartRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Custom hover tooltip state — portal-based to escape overflow containers
  const [tooltipData, setTooltipData] = useState<HoverTooltipData | null>(null);
  const tooltipElRef = useRef<HTMLDivElement>(null);
  const hoveredTaskRef = useRef('');

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

  // ─── Custom Hover Tooltip (portal-based) ──────────────────────────────
  // The library tooltip renders INSIDE .rmg-timeline-container (overflow-x: auto)
  // which clips it behind the header. This custom tooltip uses createPortal to
  // document.body, escaping all overflow containers.

  // Tooltip labels with safe fallback — ensures correct language even if
  // namespace lazy-loading hasn't completed when the tooltip first renders
  const tooltipLabels = useMemo(() => {
    const isGreek = i18n.language === 'el';
    const safeLabel = (key: string, el: string, en: string): string => {
      const result = t(`tabs.timeline.gantt.tooltip.${key}`);
      // If t() returned the full key path (namespace not loaded), use fallback
      return result.includes('.') ? (isGreek ? el : en) : result;
    };
    return {
      start: safeLabel('start', 'Έναρξη', 'Start'),
      end: safeLabel('end', 'Λήξη', 'End'),
      duration: safeLabel('duration', 'Διάρκεια', 'Duration'),
      progress: safeLabel('progress', 'Πρόοδος', 'Progress'),
      days: safeLabel('days', 'ημέρες', 'days'),
    };
  }, [t, i18n.language]);

  // Context menu labels with same safe fallback pattern
  const contextMenuLabels = useMemo(() => {
    const isGreek = i18n.language === 'el';
    const safeLabel = (key: string, el: string, en: string): string => {
      const result = t(`tabs.timeline.gantt.contextMenu.${key}`);
      return result.includes('.') ? (isGreek ? el : en) : result;
    };
    return {
      editPhase: safeLabel('editPhase', 'Επεξεργασία Φάσης', 'Edit Phase'),
      editTask: safeLabel('editTask', 'Επεξεργασία Εργασίας', 'Edit Task'),
      newPhase: safeLabel('newPhase', 'Νέα Φάση', 'New Phase'),
      newTask: safeLabel('newTask', 'Νέα Εργασία', 'New Task'),
      changeColor: safeLabel('changeColor', 'Αλλαγή Χρώματος', 'Change Color'),
      colorPickerTitle: safeLabel('colorPickerTitle', 'Επιλογή Χρώματος Μπάρας', 'Choose Bar Color'),
      delete: safeLabel('delete', 'Διαγραφή', 'Delete'),
    };
  }, [t, i18n.language]);

  // Export labels with safe fallback (same pattern as tooltip/contextMenu)
  const exportLabels = useMemo(() => {
    const isGreek = i18n.language === 'el';
    const safeLabel = (key: string, el: string, en: string): string => {
      const result = t(`tabs.timeline.gantt.export.${key}`);
      return result.includes('.') ? (isGreek ? el : en) : result;
    };
    return {
      export: safeLabel('export', 'Εξαγωγή', 'Export'),
      pdf: safeLabel('pdf', 'PDF (Έγγραφο)', 'PDF (Document)'),
      png: safeLabel('png', 'PNG (Εικόνα)', 'PNG (Image)'),
      svg: safeLabel('svg', 'SVG (Διάνυσμα)', 'SVG (Vector)'),
      excel: safeLabel('excel', 'Excel (Δεδομένα)', 'Excel (Data)'),
    };
  }, [t, i18n.language]);

  // Export handler — dispatches to format-specific exporter
  const handleExport = useCallback(async (format: GanttExportFormat) => {
    if (!ganttChartRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      const baseName = `Gantt_${building.name ?? 'Chart'}_${timestamp}`;
      const ext = format === 'excel' ? 'xlsx' : format;

      switch (format) {
        case 'pdf':
          await exportGanttToPDF({
            format,
            filename: `${baseName}.pdf`,
            buildingName: building.name ?? '',
            taskGroups,
            chartElement: ganttChartRef.current,
          });
          break;
        case 'png':
        case 'svg':
          await exportGanttAsImage(ganttChartRef.current, format, `${baseName}.${ext}`);
          break;
        case 'excel':
          await exportGanttToExcel({
            format,
            filename: `${baseName}.xlsx`,
            buildingName: building.name ?? '',
            taskGroups,
            chartElement: ganttChartRef.current,
          });
          break;
      }
    } finally {
      setIsExporting(false);
    }
  }, [building.name, taskGroups, isExporting]);

  // Compute tooltip coordinates clamped to viewport
  const computeTooltipPosition = useCallback((clientX: number, clientY: number) => {
    const tooltipWidth = 220;
    const tooltipHeight = 120;
    return {
      x: Math.min(clientX + 16, window.innerWidth - tooltipWidth - 8),
      y: Math.max(8, Math.min(clientY - tooltipHeight, window.innerHeight - tooltipHeight - 8)),
    };
  }, []);

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
          startDate: start.toLocaleDateString('el-GR'),
          endDate: end.toLocaleDateString('el-GR'),
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
          startDate: start.toLocaleDateString('el-GR'),
          endDate: end.toLocaleDateString('el-GR'),
          duration: durationDays,
          progress: taskProgress,
        } : null);
        return;
      }
    }
  }, [taskGroups]); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally watches only taskGroups

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
      {/* Toolbar: New Phase / New Task / Export */}
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

        {/* Export Dropdown — PDF, PNG, SVG, Excel */}
        {!isEmpty && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isExporting}>
                <Download className={cn(iconSizes.xs, spacingTokens.margin.right.xs)} />
                {isExporting
                  ? t('tabs.timeline.gantt.export.exporting')
                  : exportLabels.export}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                <FileText className={cn(iconSizes.xs, spacingTokens.margin.right.sm)} />
                {exportLabels.pdf}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('png')}>
                <ImageIcon className={cn(iconSizes.xs, spacingTokens.margin.right.sm)} />
                {exportLabels.png}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('svg')}>
                <FileImage className={cn(iconSizes.xs, spacingTokens.margin.right.sm)} />
                {exportLabels.svg}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExport('excel')}>
                <Table2 className={cn(iconSizes.xs, spacingTokens.margin.right.sm)} />
                {exportLabels.excel}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

      {/* Gantt Chart — with right-click context menu + hover tooltip via portals */}
      {!isEmpty && (
        <Card
          className="border-0 shadow-none"
          onContextMenu={handleContextMenu}
          onPointerMove={handleGanttPointerMove}
          onPointerLeave={handleGanttPointerLeave}
        >
          <CardContent className={spacingTokens.padding.none} onMouseDownCapture={handleGanttMouseDown}>
            <div ref={ganttChartRef}>
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
            </div>
          </CardContent>
        </Card>
      )}

      {/* Custom Context Menu — portal-rendered at exact cursor coordinates */}
      {contextMenu && createPortal(
        <nav
          ref={contextMenuRef}
          className="min-w-48 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          style={{
            position: 'fixed',
            left: Math.min(contextMenu.x, window.innerWidth - 200),
            top: Math.min(contextMenu.y, window.innerHeight - 280),
            zIndex: zIndex.popover,
          }}
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
              ? contextMenuLabels.editPhase
              : contextMenuLabels.editTask}
          </button>
          <div className="-mx-1 my-1 h-px bg-border" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
            onClick={handleNewPhaseFromMenu}
          >
            <FolderPlus className={cn(iconSizes.xs, spacingTokens.margin.right.xs)} />
            {contextMenuLabels.newPhase}
          </button>
          <button
            type="button"
            role="menuitem"
            className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
            onClick={handleNewTaskFromMenu}
          >
            <Plus className={cn(iconSizes.xs, spacingTokens.margin.right.xs)} />
            {contextMenuLabels.newTask}
          </button>
          <div className="-mx-1 my-1 h-px bg-border" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
            onClick={handleChangeColorFromMenu}
          >
            <Palette className={cn(iconSizes.xs, spacingTokens.margin.right.xs)} />
            {contextMenuLabels.changeColor}
          </button>
          <div className="-mx-1 my-1 h-px bg-border" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none text-destructive hover:bg-destructive/10"
            onClick={handleDeleteFromMenu}
          >
            <Trash2 className={cn(iconSizes.xs, spacingTokens.margin.right.xs)} />
            {contextMenuLabels.delete}
          </button>
        </nav>,
        document.body
      )}

      {/* Custom Hover Tooltip — portal to document.body, escapes all overflow */}
      {tooltipData && createPortal(
        <aside
          ref={tooltipElRef}
          className="min-w-48 rounded border bg-popover p-2 text-popover-foreground text-xs shadow-lg pointer-events-none"
          style={{
            position: 'fixed',
            left: tooltipData.x,
            top: tooltipData.y,
            zIndex: zIndex.tooltip,
          }}
        >
          <p className="font-bold mb-1">{tooltipData.name}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
            <dt className="text-muted-foreground font-semibold">
              {tooltipLabels.start}:
            </dt>
            <dd>{tooltipData.startDate}</dd>
            <dt className="text-muted-foreground font-semibold">
              {tooltipLabels.end}:
            </dt>
            <dd>{tooltipData.endDate}</dd>
            <dt className="text-muted-foreground font-semibold">
              {tooltipLabels.duration}:
            </dt>
            <dd>{tooltipData.duration} {tooltipLabels.days}</dd>
            <dt className="text-muted-foreground font-semibold">
              {tooltipLabels.progress}:
            </dt>
            <dd>{tooltipData.progress}%</dd>
          </dl>
        </aside>,
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
            <DialogTitle>{contextMenuLabels.colorPickerTitle}</DialogTitle>
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
