'use client';

/**
 * @module ScheduleVarianceTable
 * @enterprise ADR-266 Phase A — Expandable tree table (As-Planned vs As-Built)
 *
 * Phases collapsed by default, expand to show child tasks.
 * Reuses ReportSection wrapper + semantic HTML table.
 */

import { useMemo, useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, Minus } from 'lucide-react';
import { ReportSection } from '@/components/reports/core/ReportSection';
import { ReportEmptyState } from '@/components/reports/core/ReportEmptyState';
import { ReportTrafficLight } from '@/components/reports/core/ReportTrafficLight';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDateShort } from '@/lib/intl-utils';
import { getStatusColor } from '@/lib/design-system';
import { cn } from '@/lib/utils';
import type { ScheduleVarianceRow } from './schedule-dashboard.types';

// ─── Props ───────────────────────────────────────────────────────────────

interface ScheduleVarianceTableProps {
  rows: ScheduleVarianceRow[];
  loading?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────

export function ScheduleVarianceTable({ rows, loading }: ScheduleVarianceTableProps) {
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

  const phases = rows.filter(r => r.type === 'phase');
  const isEmpty = phases.length === 0;

  if (!loading && isEmpty) {
    return (
      <ReportSection
        title={t('tabs.timeline.dashboard.variance.title')}
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
      id="schedule-variance"
    >
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
                >
                  {/* Name with expand/indent */}
                  <td className={cn('py-2 px-2', !isPhase && 'pl-8')}>
                    <span className="flex items-center gap-1.5">
                      {isPhase ? (
                        <button
                          type="button"
                          onClick={() => togglePhase(row.id)}
                          className="shrink-0"
                          aria-label={isExpanded ? 'Collapse' : 'Expand'}
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
                  </td>

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
