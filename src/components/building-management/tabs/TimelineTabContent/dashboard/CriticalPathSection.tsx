'use client';

/**
 * @module CriticalPathSection
 * @enterprise ADR-266 Phase C Sub-phase 2 — Critical Path Analysis table
 *
 * Dashboard section showing CPM results: ES/EF/LS/LF/Float per task.
 * Critical path tasks highlighted. Uses ReportSection wrapper.
 */

import { useMemo } from 'react';
import { Route, AlertTriangle } from 'lucide-react';
import { ReportSection } from '@/components/reports/core/ReportSection';
import { ReportEmptyState } from '@/components/reports/core/ReportEmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDateShort } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import { computeCPM } from '@/services/construction-scheduling/cpm-calculator';
import type { CPMTaskResult } from '@/services/construction-scheduling/cpm-types';
import type { ConstructionPhase, ConstructionTask } from '@/types/building/construction';
import '@/lib/design-system';

// ─── Props ──────────────────────────────────────────────────────────────

interface CriticalPathSectionProps {
  tasks: ConstructionTask[];
  phases: ConstructionPhase[];
  loading?: boolean;
}

// ─── Row Component ──────────────────────────────────────────────────────

interface CPMRowProps {
  task: CPMTaskResult;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function CPMRow({ task, t }: CPMRowProps) {
  const isCritical = task.isCritical && !task.hasCyclicDependency;

  return (
    <tr className={cn(
      'border-b border-border/50 transition-colors',
      isCritical && 'bg-orange-50/50 dark:bg-orange-950/20',
      task.hasCyclicDependency && 'bg-amber-50/50 dark:bg-amber-950/20',
    )}>
      <th scope="row" className="py-2 px-2 font-medium">
        <div className="flex items-center gap-1.5">
          {isCritical && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
          )}
          {task.hasCyclicDependency && (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          )}
          <span className="truncate">{task.taskCode}</span>
        </div>
      </th>
      <td className="py-2 px-2 hidden lg:table-cell truncate max-w-[150px]">
        {task.taskName}
      </td>
      <td className="py-2 px-2 hidden md:table-cell text-muted-foreground truncate max-w-[120px]">
        {task.phaseName}
      </td>
      <td className="py-2 px-2 text-right tabular-nums">
        {task.durationDays}d
      </td>
      <td className="py-2 px-2 hidden md:table-cell text-right tabular-nums">
        {formatDateShort(task.earlyStart)}
      </td>
      <td className="py-2 px-2 hidden md:table-cell text-right tabular-nums">
        {formatDateShort(task.earlyFinish)}
      </td>
      <td className="py-2 px-2 hidden lg:table-cell text-right tabular-nums">
        {formatDateShort(task.lateStart)}
      </td>
      <td className="py-2 px-2 hidden lg:table-cell text-right tabular-nums">
        {formatDateShort(task.lateFinish)}
      </td>
      <td className="py-2 px-2 text-right">
        <FloatBadge float={task.totalFloat} isCyclic={task.hasCyclicDependency} t={t} />
      </td>
    </tr>
  );
}

// ─── Float Badge ────────────────────────────────────────────────────────

interface FloatBadgeProps {
  float: number;
  isCyclic: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function FloatBadge({ float, isCyclic, t }: FloatBadgeProps) {
  if (isCyclic) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
        {t('tabs.timeline.dashboard.criticalPath.cyclicDep')}
      </span>
    );
  }
  if (float === 0) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
        {t('tabs.timeline.dashboard.criticalPath.critical')}
      </span>
    );
  }
  return (
    <span className="text-sm tabular-nums text-muted-foreground">
      {t('tabs.timeline.dashboard.criticalPath.days', { days: float })}
    </span>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────

export function CriticalPathSection({ tasks, phases, loading }: CriticalPathSectionProps) {
  const { t } = useTranslation('building');
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();

  const cpmResult = useMemo(() => {
    if (tasks.length === 0) return null;
    return computeCPM(tasks, phases);
  }, [tasks, phases]);

  if (loading) {
    return (
      <ReportSection title={t('tabs.timeline.dashboard.criticalPath.title')}>
        <Skeleton className="h-48 w-full" />
      </ReportSection>
    );
  }

  if (!cpmResult || !cpmResult.isValid) {
    return (
      <ReportSection title={t('tabs.timeline.dashboard.criticalPath.title')}>
        <ReportEmptyState
          title={t('tabs.timeline.dashboard.criticalPath.empty')}
        />
      </ReportSection>
    );
  }

  // Sort: critical first (float ASC), then by ES
  const sortedTasks = [...cpmResult.tasks].sort((a, b) => {
    if (a.isCritical !== b.isCritical) return a.isCritical ? -1 : 1;
    if (a.totalFloat !== b.totalFloat) return a.totalFloat - b.totalFloat;
    return new Date(a.earlyStart).getTime() - new Date(b.earlyStart).getTime();
  });

  return (
    <ReportSection
      title={t('tabs.timeline.dashboard.criticalPath.title')}
      description={t('tabs.timeline.dashboard.criticalPath.description')}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={cn('border-b', colors.border.default)}>
              <th scope="col" className="text-left py-2 px-2 font-medium">
                {t('tabs.timeline.dashboard.criticalPath.colTask')}
              </th>
              <th scope="col" className="text-left py-2 px-2 font-medium hidden lg:table-cell">
                {t('tabs.timeline.dashboard.criticalPath.colTask')}
              </th>
              <th scope="col" className="text-left py-2 px-2 font-medium hidden md:table-cell">
                {t('tabs.timeline.dashboard.criticalPath.colPhase')}
              </th>
              <th scope="col" className="text-right py-2 px-2 font-medium">
                {t('tabs.timeline.dashboard.criticalPath.colDuration')}
              </th>
              <th scope="col" className="text-right py-2 px-2 font-medium hidden md:table-cell">
                {t('tabs.timeline.dashboard.criticalPath.colES')}
              </th>
              <th scope="col" className="text-right py-2 px-2 font-medium hidden md:table-cell">
                {t('tabs.timeline.dashboard.criticalPath.colEF')}
              </th>
              <th scope="col" className="text-right py-2 px-2 font-medium hidden lg:table-cell">
                {t('tabs.timeline.dashboard.criticalPath.colLS')}
              </th>
              <th scope="col" className="text-right py-2 px-2 font-medium hidden lg:table-cell">
                {t('tabs.timeline.dashboard.criticalPath.colLF')}
              </th>
              <th scope="col" className="text-right py-2 px-2 font-medium">
                {t('tabs.timeline.dashboard.criticalPath.colFloat')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedTasks.map(task => (
              <CPMRow key={task.taskId} task={task} t={t} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer: Critical Path Length */}
      {cpmResult.criticalPath.length > 0 && (
        <div className={cn('flex items-center justify-between pt-3 mt-3 border-t', colors.border.default)}>
          <div className="flex items-center gap-2">
            <Route className={cn(iconSizes.sm, 'text-orange-500')} />
            <span className="text-sm font-medium">
              {t('tabs.timeline.dashboard.criticalPath.pathLength')}
            </span>
          </div>
          <span className="text-sm font-semibold tabular-nums">
            {t('tabs.timeline.dashboard.criticalPath.days', { days: cpmResult.criticalPathLength })}
          </span>
        </div>
      )}
    </ReportSection>
  );
}
