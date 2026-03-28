'use client';

/**
 * @module CriticalPathCard
 * @enterprise ADR-266 Phase C Sub-phase 2 — Real CPM-based critical path card
 *
 * Displays top critical tasks computed via CPM algorithm.
 * Used in the Milestones view (TimelineTabContent).
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CommonBadge } from '@/core/badges';
import { AlertTriangle, Route, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useCriticalPath } from '@/hooks/useCriticalPath';
import type { CPMTaskResult } from '@/services/construction-scheduling/cpm-types';
import '@/lib/design-system';

// ─── Constants ──────────────────────────────────────────────────────────

const MAX_VISIBLE_TASKS = 5;

// ─── Sub-components ─────────────────────────────────────────────────────

interface CriticalTaskRowProps {
  task: CPMTaskResult;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function CriticalTaskRow({ task, t }: CriticalTaskRowProps) {
  const colors = useSemanticColors();
  const hasDelay = task.delayImpactDays > 0;

  return (
    <div
      className={cn(
        'flex items-center justify-between p-2 rounded-lg',
        hasDelay
          ? 'bg-red-50 dark:bg-red-950/30'
          : 'bg-orange-50 dark:bg-orange-950/30',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className={cn(
          'font-medium truncate',
          hasDelay ? 'text-red-900 dark:text-red-300' : 'text-orange-900 dark:text-orange-300',
        )}>
          {task.taskCode} — {task.taskName}
        </p>
        <p className={cn(
          'text-sm truncate',
          hasDelay ? 'text-red-700 dark:text-red-400' : 'text-orange-700 dark:text-orange-400',
        )}>
          {task.phaseName}
        </p>
      </div>
      <div className="flex-shrink-0 ml-2">
        {task.hasCyclicDependency ? (
          <CommonBadge
            status="company"
            customLabel={t('tabs.timeline.criticalPath.cyclicWarning')}
            variant="outline"
            className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          />
        ) : hasDelay ? (
          <CommonBadge
            status="company"
            customLabel={t('tabs.timeline.criticalPath.delayImpact', { days: task.delayImpactDays })}
            variant="outline"
            className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
          />
        ) : (
          <CommonBadge
            status="company"
            customLabel={t('tabs.timeline.criticalPath.critical')}
            variant="outline"
            className="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
          />
        )}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────

interface CriticalPathCardProps {
  buildingId: string;
}

export function CriticalPathCard({ buildingId }: CriticalPathCardProps) {
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();
  const { cpmResult, loading } = useCriticalPath(buildingId);

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className={cn(iconSizes.md, 'text-orange-500')} />
            {t('tabs.timeline.criticalPath.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // No data or invalid
  if (!cpmResult || !cpmResult.isValid) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className={cn(iconSizes.md, 'text-orange-500')} />
            {t('tabs.timeline.criticalPath.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('tabs.timeline.criticalPath.noData')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('tabs.timeline.criticalPath.noDataDesc')}
          </p>
        </CardContent>
      </Card>
    );
  }

  const { criticalPath, cyclicTaskIds } = cpmResult;

  // No critical tasks (all have float)
  if (criticalPath.length === 0 && cyclicTaskIds.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className={cn(iconSizes.md, 'text-green-500')} />
            {t('tabs.timeline.criticalPath.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('tabs.timeline.criticalPath.noCriticalTasks')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('tabs.timeline.criticalPath.noCriticalDesc')}
          </p>
        </CardContent>
      </Card>
    );
  }

  const visibleTasks = criticalPath.slice(0, MAX_VISIBLE_TASKS);
  const hasMore = criticalPath.length > MAX_VISIBLE_TASKS;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Route className={cn(iconSizes.md, 'text-orange-500')} />
          {t('tabs.timeline.criticalPath.title')}
          <span className="text-xs font-normal text-muted-foreground ml-auto">
            {criticalPath.length} {criticalPath.length === 1 ? 'task' : 'tasks'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {cyclicTaskIds.length > 0 && (
            <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg dark:bg-amber-950/30">
              <AlertTriangle className={cn(iconSizes.sm, 'text-amber-500 flex-shrink-0')} />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                {t('tabs.timeline.criticalPath.cyclicWarning')} ({cyclicTaskIds.length})
              </p>
            </div>
          )}
          {visibleTasks.map(task => (
            <CriticalTaskRow key={task.taskId} task={task} t={t} />
          ))}
          {hasMore && (
            <p className="text-xs text-muted-foreground text-center pt-1">
              +{criticalPath.length - MAX_VISIBLE_TASKS} more
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
