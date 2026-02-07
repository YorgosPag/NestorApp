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

import React, { useCallback, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import { GanttChart, ViewMode } from 'react-modern-gantt';
import type { Task, TaskColorProps } from 'react-modern-gantt';
import 'react-modern-gantt/dist/index.css';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  BarChart3,
  Plus,
  FolderPlus,
  Loader2,
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
import type { Building } from '../../../BuildingsPageContent';

import { useConstructionGantt } from '../../../hooks/useConstructionGantt';
import { ConstructionPhaseDialog } from '../../../dialogs/ConstructionPhaseDialog';
import type { GanttTaskStatus } from './gantt-mock-data';

// ─── Types ────────────────────────────────────────────────────────────────

interface GanttViewProps {
  building: Building;
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
    handleGroupClick,
    savePhase,
    updatePhase,
    removePhase,
    saveTask,
    updateTask,
    removeTask,
    phases,
  } = useConstructionGantt(String(building.id));

  // Dynamic color resolver for Gantt bars — reads taskStatus metadata
  const getTaskBarColor = useCallback(({ task }: TaskColorProps) => {
    const status = (task as Task & { taskStatus?: GanttTaskStatus }).taskStatus ?? 'notStarted';
    const backgroundColor = STATUS_TO_CSS_COLOR[status] ?? STATUS_TO_CSS_COLOR.notStarted;
    return {
      backgroundColor,
      textColor: 'white',
    };
  }, []);

  // Timeline bounds — add padding so users can drag/extend tasks freely
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
    const startDate = new Date(earliest);
    startDate.setMonth(startDate.getMonth() - 3);

    const endDate = new Date(latest);
    endDate.setMonth(endDate.getMonth() + 12);

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

      {/* Gantt Chart */}
      {!isEmpty && (
        <Card className="border-0 shadow-none">
          <CardContent className={cn(spacingTokens.padding.none, 'overflow-hidden')}>
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
              onTaskUpdate={handleTaskUpdate}
              onTaskClick={handleTaskClick}
              onGroupClick={handleGroupClick}
              locale="el-GR"
              fontSize={designTypography.fontSize.sm}
              getTaskColor={getTaskBarColor}
            />
          </CardContent>
        </Card>
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
