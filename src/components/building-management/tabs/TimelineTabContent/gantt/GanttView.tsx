'use client';

/**
 * GanttView — Construction Phase Gantt Chart (ADR-034)
 *
 * Main container for the Gantt visualization using react-modern-gantt.
 * Uses mock data for Phase 1; will switch to Firestore in Phase 2.
 *
 * Centralized Systems Used:
 * - useSemanticColors() for theme-aware status colors
 * - useTranslation('building') for i18n
 * - useSpacingTokens() for consistent spacing
 * - useIconSizes() for icon dimensions
 * - Card, Badge from @/components/ui
 * - cn() from @/lib/utils
 * - getStatusColor() from @/lib/design-system
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
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { getStatusColor } from '@/lib/design-system';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Building } from '../../../BuildingsPageContent';

import { getGanttMockData, calculateGanttStats } from './gantt-mock-data';
import type { GanttTaskStatus } from './gantt-mock-data';

// ─── Types ────────────────────────────────────────────────────────────────

interface GanttViewProps {
  building: Building;
}

// ─── Gantt Bar Color Resolver ─────────────────────────────────────────────
// Maps task status metadata to CSS colors for the Gantt bars.
// Uses CSS custom properties (resolved from design tokens) so they are theme-aware.

const STATUS_TO_CSS_COLOR: Record<GanttTaskStatus, string> = {
  completed: 'hsl(var(--bg-success))',
  inProgress: 'hsl(var(--bg-info))',
  notStarted: 'hsl(var(--muted-foreground))',
  delayed: 'hsl(var(--destructive))',
  blocked: 'hsl(var(--bg-warning))',
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
  const { resolvedTheme } = useTheme();

  const isDarkMode = resolvedTheme === 'dark';

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.MONTH);

  // Generate mock data with i18n translations
  const taskGroups = useMemo(() => getGanttMockData(t), [t]);

  // Calculate summary statistics
  const stats = useMemo(() => calculateGanttStats(taskGroups), [taskGroups]);

  // Dynamic color resolver for Gantt bars — reads taskStatus metadata
  const getTaskBarColor = useCallback(({ task }: TaskColorProps) => {
    const status = (task as Task & { taskStatus?: GanttTaskStatus }).taskStatus ?? 'notStarted';
    const backgroundColor = STATUS_TO_CSS_COLOR[status] ?? STATUS_TO_CSS_COLOR.notStarted;
    return {
      backgroundColor,
      textColor: 'white',
    };
  }, []);

  // Summary cards data
  const summaryCards = useMemo(() => [
    {
      key: 'total',
      label: t('tabs.timeline.gantt.summary.totalPhases'),
      value: stats.totalPhases,
      icon: BarChart3,
    },
    {
      key: 'completed',
      label: t('tabs.timeline.gantt.summary.completedPhases'),
      value: stats.completedPhases,
      icon: CheckCircle2,
    },
    {
      key: 'delayed',
      label: t('tabs.timeline.gantt.summary.delayedPhases'),
      value: stats.delayedPhases,
      icon: AlertTriangle,
    },
    {
      key: 'progress',
      label: t('tabs.timeline.gantt.summary.overallProgress'),
      value: `${stats.overallProgress}%`,
      icon: Clock,
    },
  ], [stats, t]);

  return (
    <section className={cn('flex flex-col', spacingTokens.gap.lg)} aria-label={t('tabs.timeline.gantt.title')}>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryCards.map((card) => {
          const IconComponent = card.icon;
          return (
            <Card key={card.key}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </CardTitle>
                <IconComponent className={cn(iconSizes.sm, 'text-muted-foreground')} />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{card.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Gantt Chart */}
      <Card>
        <CardContent className="p-0 overflow-hidden">
          <GanttChart
            tasks={taskGroups}
            title={t('tabs.timeline.gantt.title')}
            headerLabel={building.name ?? t('tabs.timeline.gantt.title')}
            viewMode={viewMode}
            viewModes={AVAILABLE_VIEW_MODES}
            onViewModeChange={setViewMode}
            darkMode={isDarkMode}
            showProgress
            showCurrentDateMarker
            todayLabel={t('tabs.timeline.gantt.toolbar.today')}
            editMode={false}
            locale="el-GR"
            fontSize="14px"
            getTaskColor={getTaskBarColor}
          />
        </CardContent>
      </Card>

      {/* Phase Status Legend */}
      <Card>
        <CardContent className={cn('flex flex-wrap items-center', spacingTokens.gap.sm, spacingTokens.padding.md)}>
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
    </section>
  );
}
