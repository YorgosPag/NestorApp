'use client';

/**
 * @module LookaheadTable
 * @enterprise ADR-266 Phase A — Lookahead report (2/4 weeks)
 *
 * Shows upcoming tasks within a configurable window.
 * Toggle between 2 and 4 weeks using Radix Select.
 */

import { ReportSection } from '@/components/reports/core/ReportSection';
import { ReportEmptyState } from '@/components/reports/core/ReportEmptyState';
import { ReportTrafficLight } from '@/components/reports/core/ReportTrafficLight';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDateShort } from '@/lib/intl-utils';
import '@/lib/design-system';
import type { LookaheadRow } from './schedule-dashboard.types';

// ─── Helpers ─────────────────────────────────────────────────────────────

function statusToRAG(status: string): 'green' | 'amber' | 'red' | 'gray' {
  if (status === 'completed') return 'green';
  if (status === 'inProgress') return 'amber';
  if (status === 'delayed' || status === 'blocked') return 'red';
  return 'gray';
}

// ─── Props ───────────────────────────────────────────────────────────────

interface LookaheadTableProps {
  rows: LookaheadRow[];
  lookAheadDays: number;
  onLookAheadChange: (days: number) => void;
  loading?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────

export function LookaheadTable({
  rows,
  lookAheadDays,
  onLookAheadChange,
  loading,
}: LookaheadTableProps) {
  const { t } = useTranslation('building');

  const weeks = lookAheadDays === 14 ? '2' : '4';

  const isEmpty = rows.length === 0;

  return (
    <ReportSection
      title={t('tabs.timeline.dashboard.lookahead.title')}
      id="schedule-lookahead"
    >
      {/* Window toggle */}
      <div className="flex items-center gap-2 mb-3">
        <Select
          value={weeks}
          onValueChange={(v) => onLookAheadChange(v === '2' ? 14 : 28)}
        >
          <SelectTrigger className="w-[140px]" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2">
              {t('tabs.timeline.dashboard.lookahead.weeks2')}
            </SelectItem>
            <SelectItem value="4">
              {t('tabs.timeline.dashboard.lookahead.weeks4')}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!loading && isEmpty ? (
        <ReportEmptyState
          title={t('tabs.timeline.dashboard.lookahead.empty', { weeks })}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th scope="col" className="text-left py-2 px-2 font-medium">
                  {t('tabs.timeline.dashboard.lookahead.colTask')}
                </th>
                <th scope="col" className="text-left py-2 px-2 font-medium hidden sm:table-cell">
                  {t('tabs.timeline.dashboard.lookahead.colPhase')}
                </th>
                <th scope="col" className="text-left py-2 px-2 font-medium">
                  {t('tabs.timeline.dashboard.lookahead.colStart')}
                </th>
                <th scope="col" className="text-left py-2 px-2 font-medium">
                  {t('tabs.timeline.dashboard.lookahead.colEnd')}
                </th>
                <th scope="col" className="text-right py-2 px-2 font-medium hidden md:table-cell">
                  {t('tabs.timeline.dashboard.lookahead.colDuration')}
                </th>
                <th scope="col" className="text-center py-2 px-2 font-medium">
                  {t('tabs.timeline.dashboard.lookahead.colStatus')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b transition-colors hover:bg-muted/50">
                  <th scope="row" className="py-2 px-2 font-medium truncate max-w-[200px]">
                    {row.taskName}
                  </th>
                  <td className="py-2 px-2 hidden sm:table-cell text-muted-foreground">
                    {row.phaseCode}
                  </td>
                  <td className="py-2 px-2">{formatDateShort(row.start)}</td>
                  <td className="py-2 px-2">{formatDateShort(row.end)}</td>
                  <td className="py-2 px-2 text-right tabular-nums hidden md:table-cell">
                    {row.durationDays}d
                  </td>
                  <td className="py-2 px-2 text-center">
                    <ReportTrafficLight status={statusToRAG(row.status)} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ReportSection>
  );
}
