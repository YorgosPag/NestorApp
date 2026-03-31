'use client';

/**
 * @module ScheduleVarianceTable
 * @enterprise ADR-266 Phase A — Expandable tree table (As-Planned vs As-Built)
 *
 * Phases collapsed by default, expand to show child tasks.
 * Reuses ReportSection wrapper + semantic HTML table.
 */

import { useMemo, useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, Minus, GitCompare } from 'lucide-react';
import { ReportSection } from '@/components/reports/core/ReportSection';
import { ReportEmptyState } from '@/components/reports/core/ReportEmptyState';
import { ReportTrafficLight } from '@/components/reports/core/ReportTrafficLight';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDateShort } from '@/lib/intl-utils';
import { getStatusColor } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import type { ScheduleVarianceRow } from './schedule-dashboard.types';
import type { ConstructionBaseline } from '@/types/building/construction';

// ─── Props ───────────────────────────────────────────────────────────────

interface ScheduleVarianceTableProps {
  rows: ScheduleVarianceRow[];
  loading?: boolean;
  /** When provided, shows baseline comparison columns */
  baselineData?: ConstructionBaseline | null;
  /** Called when user clicks "clear comparison" */
  onClearBaseline?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────

export function ScheduleVarianceTable({ rows, loading, baselineData, onClearBaseline }: ScheduleVarianceTableProps) {
  const { t } = useTranslation('building');
  const colors = useSemanticColors();
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());

  const togglePhase = useCallback((phaseId: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const phaseIds = rows.filter(r => r.type === 'phase').map(r => r.id);
    setExpandedPhases(new Set(phaseIds));
  }, [rows]);

  const collapseAll = useCallback(() => {
    setExpandedPhases(new Set());
  }, []);

  // Build flat display rows (phases + expanded tasks)
  const displayRows = useMemo(() => {
    const result: ScheduleVarianceRow[] = [];
    for (const row of rows) {
      if (row.type === 'phase') {
        result.push(row);
        if (expandedPhases.has(row.id)) {
          const children = rows.filter(r => r.type === 'task' && r.parentId === row.id);
          result.push(...children);
        }
      }
    }
    return result;
  }, [rows, expandedPhases]);

  const isComparing = baselineData !== null && baselineData !== undefined;

  // Build baseline lookup maps for O(1) access per row
  const baselineLookup = useMemo(() => {
    if (!baselineData) return null;
    const phaseMap = new Map(baselineData.phases.map(p => [p.id, p]));
    const taskMap = new Map(baselineData.tasks.map(t => [t.id, t]));
    return { phaseMap, taskMap };
  }, [baselineData]);

  const phases = rows.filter(r => r.type === 'phase');
  const isEmpty = phases.length === 0;

  if (!loading && isEmpty) {
    return (
      <ReportSection
        title={t('tabs.timeline.dashboard.variance.title')}
        tooltip={t('tabs.timeline.dashboard.tooltips.varianceTitle')}
        id="schedule-variance"
      >
        <ReportEmptyState
          title={t('tabs.timeline.dashboard.empty.noPhases')}
        />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('tabs.timeline.dashboard.variance.title')}
      tooltip={t('tabs.timeline.dashboard.tooltips.varianceTitle')}
      id="schedule-variance"
    >
      {/* Baseline comparison badge */}
      {isComparing && baselineData && (
        <div className="flex items-center gap-2 mb-3 rounded-md bg-primary/10 px-3 py-1.5 text-sm">
          <GitCompare className="h-4 w-4 text-primary shrink-0" />
          <span className="font-medium">
            {t('tabs.timeline.dashboard.baseline.variance.comparingTo', { name: baselineData.name })}
          </span>
          {onClearBaseline && (
            <button
              type="button"
              onClick={onClearBaseline}
              className="ml-auto text-xs underline text-muted-foreground hover:text-foreground"
            >
              {t('tabs.timeline.dashboard.baseline.variance.clearComparison')}
            </button>
          )}
        </div>
      )}

      {/* Expand/Collapse controls */}
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={expandAll}
          className={cn('text-xs underline', colors.text.muted)}
        >
          {t('tabs.timeline.dashboard.variance.expandAll')}
        </button>
        <button
          type="button"
          onClick={collapseAll}
          className={cn('text-xs underline', colors.text.muted)}
        >
          {t('tabs.timeline.dashboard.variance.collapseAll')}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={cn('border-b', colors.text.muted)}>
              <th scope="col" className="text-left py-2 px-2 font-medium">
                {t('tabs.timeline.dashboard.variance.colName')}
              </th>
              <th scope="col" className="text-left py-2 px-2 font-medium hidden md:table-cell">
                {t('tabs.timeline.dashboard.variance.colPlannedStart')}
              </th>
              <th scope="col" className="text-left py-2 px-2 font-medium">
                {t('tabs.timeline.dashboard.variance.colPlannedEnd')}
              </th>
              <th scope="col" className="text-left py-2 px-2 font-medium hidden md:table-cell">
                {t('tabs.timeline.dashboard.variance.colActualStart')}
              </th>
              <th scope="col" className="text-left py-2 px-2 font-medium">
                {t('tabs.timeline.dashboard.variance.colActualEnd')}
              </th>
              {isComparing && (
                <>
                  <th scope="col" className="text-left py-2 px-2 font-medium hidden lg:table-cell text-primary/80">
                    {t('tabs.timeline.dashboard.baseline.variance.colBaselineStart')}
                  </th>
                  <th scope="col" className="text-left py-2 px-2 font-medium hidden md:table-cell text-primary/80">
                    {t('tabs.timeline.dashboard.baseline.variance.colBaselineEnd')}
                  </th>
                  <th scope="col" className="text-right py-2 px-2 font-medium text-primary/80">
                    {t('tabs.timeline.dashboard.baseline.variance.colBaselineVariance')}
                  </th>
                </>
              )}
              <th scope="col" className="text-right py-2 px-2 font-medium">
                {t('tabs.timeline.dashboard.variance.colVariance')}
              </th>
              <th scope="col" className="text-center py-2 px-2 font-medium">
                {t('tabs.timeline.dashboard.variance.colStatus')}
              </th>
              <th scope="col" className="text-right py-2 px-2 font-medium">
                {t('tabs.timeline.dashboard.variance.colProgress')}
              </th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map(row => {
              const isPhase = row.type === 'phase';
              const isExpanded = expandedPhases.has(row.id);

              return (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b transition-colors hover:bg-muted/50',
                    isPhase && 'font-medium',
                  )}
                  aria-expanded={isPhase ? isExpanded : undefined}
                >
                  {/* Name with expand/indent */}
                  <th scope="row" className={cn('py-2 px-2 font-normal', isPhase && 'font-medium', !isPhase && 'pl-8')}>
                    <span className="flex items-center gap-1.5">
                      {isPhase ? (
                        <button
                          type="button"
                          onClick={() => togglePhase(row.id)}
                          className="shrink-0"
                          aria-label={isExpanded
                            ? t('tabs.timeline.dashboard.variance.collapsePhase', { name: row.name })
                            : t('tabs.timeline.dashboard.variance.expandPhase', { name: row.name })
                          }
                        >
                          {isExpanded
                            ? <ChevronDown className="h-4 w-4" />
                            : <ChevronRight className="h-4 w-4" />
                          }
                        </button>
                      ) : (
                        <Minus className="h-3 w-3 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate">{row.code} {row.name}</span>
                    </span>
                  </th>

                  {/* Planned Start */}
                  <td className="py-2 px-2 hidden md:table-cell">
                    {formatDateShort(row.plannedStart)}
                  </td>

                  {/* Planned End */}
                  <td className="py-2 px-2">
                    {formatDateShort(row.plannedEnd)}
                  </td>

                  {/* Actual Start */}
                  <td className="py-2 px-2 hidden md:table-cell">
                    {row.actualStart ? formatDateShort(row.actualStart) : '—'}
                  </td>

                  {/* Actual End */}
                  <td className="py-2 px-2">
                    {row.actualEnd ? formatDateShort(row.actualEnd) : '—'}
                  </td>

                  {/* Baseline columns (only when comparing) */}
                  {isComparing && (() => {
                    const bEntity = baselineLookup
                      ? (row.type === 'phase'
                        ? baselineLookup.phaseMap.get(row.id)
                        : baselineLookup.taskMap.get(row.id))
                      : undefined;
                    const bStart = bEntity?.plannedStartDate ?? null;
                    const bEnd = bEntity?.plannedEndDate ?? null;
                    const bVar = bEnd && row.plannedEnd
                      ? Math.round((new Date(row.plannedEnd).getTime() - new Date(bEnd).getTime()) / 86_400_000)
                      : 0;
                    return (
                      <>
                        <td className="py-2 px-2 hidden lg:table-cell text-primary/70">
                          {bStart ? formatDateShort(bStart) : '—'}
                        </td>
                        <td className="py-2 px-2 hidden md:table-cell text-primary/70">
                          {bEnd ? formatDateShort(bEnd) : '—'}
                        </td>
                        <td className={cn(
                          'py-2 px-2 text-right tabular-nums',
                          bVar > 0 && 'text-destructive',
                          bVar === 0 && 'text-muted-foreground',
                          bVar < 0 && getStatusColor('available', 'text'),
                        )}>
                          {bEntity ? (bVar > 0 ? `+${bVar}d` : `${bVar}d`) : '—'}
                        </td>
                      </>
                    );
                  })()}

                  {/* Variance */}
                  <td className={cn(
                    'py-2 px-2 text-right tabular-nums',
                    row.varianceDays > 0 && 'text-destructive',
                    row.varianceDays === 0 && 'text-muted-foreground',
                    row.varianceDays < 0 && getStatusColor('available', 'text'),
                  )}>
                    {row.varianceDays > 0 ? `+${row.varianceDays}d` : row.varianceDays === 0 ? '0d' : `${row.varianceDays}d`}
                  </td>

                  {/* Status */}
                  <td className="py-2 px-2 text-center">
                    <ReportTrafficLight status={row.ragStatus} size="sm" />
                  </td>

                  {/* Progress */}
                  <td className="py-2 px-2 text-right tabular-nums">
                    {row.progress}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ReportSection>
  );
}
