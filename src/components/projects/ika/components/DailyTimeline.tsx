'use client';

/**
 * =============================================================================
 * DailyTimeline — Workers attendance table for a single day
 * =============================================================================
 *
 * Displays all workers with their attendance status, check-in/out times,
 * effective hours, gaps, and anomalies in a table format.
 *
 * @module components/projects/ika/components/DailyTimeline
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System (Phase 2)
 */

import React, { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Clock, AlertTriangle, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { cn } from '@/lib/utils';
import type { WorkerDailySummary, WorkerAttendanceStatus } from '../contracts';
import { AttendanceEventRow } from './AttendanceEventRow';

interface DailyTimelineProps {
  /** Worker summaries for the selected day */
  workerSummaries: WorkerDailySummary[];
  /** Callback to open manual record dialog for a specific worker */
  onRecordEvent: (contactId: string) => void;
}

/**
 * Maps status to badge variant and label
 */
function getStatusBadgeConfig(
  status: WorkerAttendanceStatus,
  t: (key: string) => string
): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  switch (status) {
    case 'present':
      return { label: t('ika.timesheetTab.status.present'), variant: 'default' };
    case 'absent':
      return { label: t('ika.timesheetTab.status.absent'), variant: 'destructive' };
    case 'off_site':
      return { label: t('ika.timesheetTab.status.offSite'), variant: 'secondary' };
    case 'on_break':
      return { label: t('ika.timesheetTab.status.onBreak'), variant: 'outline' };
    case 'checked_out':
      return { label: t('ika.timesheetTab.status.checkedOut'), variant: 'secondary' };
    default:
      return { label: status, variant: 'outline' };
  }
}

/**
 * Formats minutes as H:MM
 */
function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}

export function DailyTimeline({ workerSummaries, onRecordEvent }: DailyTimelineProps) {
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const typography = useTypography();
  const spacing = useSpacingTokens();
  const { quick } = useBorderTokens();

  // Track expanded rows for event details
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleExpanded = useCallback((contactId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  }, []);

  if (workerSummaries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Clock className={cn(iconSizes.xl, 'text-muted-foreground mb-4')} />
        <p className="text-sm font-medium text-muted-foreground">
          {t('ika.timesheetTab.noEvents')}
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8" />
          <TableHead>{t('ika.timesheetTab.columns.worker')}</TableHead>
          <TableHead>{t('ika.timesheetTab.columns.status')}</TableHead>
          <TableHead>{t('ika.timesheetTab.columns.checkIn')}</TableHead>
          <TableHead>{t('ika.timesheetTab.columns.checkOut')}</TableHead>
          <TableHead>{t('ika.timesheetTab.columns.hours')}</TableHead>
          <TableHead>{t('ika.timesheetTab.columns.gaps')}</TableHead>
          <TableHead>{t('ika.timesheetTab.columns.anomalies')}</TableHead>
          <TableHead>{t('ika.timesheetTab.columns.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {workerSummaries.map((summary) => {
          const statusConfig = getStatusBadgeConfig(summary.currentStatus, t);
          const isExpanded = expandedRows.has(summary.contactId);
          const hasEvents = summary.events.length > 0;

          return (
            <React.Fragment key={summary.contactId}>
              <TableRow className={cn(quick.separator)}>
                {/* Expand toggle */}
                <TableCell className="w-8">
                  {hasEvents && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => toggleExpanded(summary.contactId)}
                    >
                      {isExpanded
                        ? <ChevronUp className={iconSizes.xs} />
                        : <ChevronDown className={iconSizes.xs} />
                      }
                    </Button>
                  )}
                </TableCell>

                {/* Worker name + company */}
                <TableCell>
                  <p className={typography.body.sm}>{summary.workerName}</p>
                  {summary.companyName && (
                    <p className="text-xs text-muted-foreground">{summary.companyName}</p>
                  )}
                </TableCell>

                {/* Status badge */}
                <TableCell>
                  <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                </TableCell>

                {/* Check-in time */}
                <TableCell className="font-mono text-sm tabular-nums">
                  {summary.firstCheckIn
                    ? format(new Date(summary.firstCheckIn), 'HH:mm')
                    : '—'}
                </TableCell>

                {/* Check-out time */}
                <TableCell className="font-mono text-sm tabular-nums">
                  {summary.lastCheckOut
                    ? format(new Date(summary.lastCheckOut), 'HH:mm')
                    : '—'}
                </TableCell>

                {/* Effective hours */}
                <TableCell className="font-mono text-sm tabular-nums">
                  {summary.effectiveWorkMinutes > 0
                    ? formatMinutes(summary.effectiveWorkMinutes)
                    : '—'}
                </TableCell>

                {/* Gaps (off-site minutes) */}
                <TableCell className="font-mono text-sm tabular-nums">
                  {summary.totalOffSiteMinutes > 0
                    ? formatMinutes(summary.totalOffSiteMinutes)
                    : '—'}
                </TableCell>

                {/* Anomalies */}
                <TableCell>
                  {summary.anomalies.length > 0 ? (
                    <Badge variant="destructive" className={cn('flex items-center w-fit', spacing.gap.xs)}>
                      <AlertTriangle className={iconSizes.xxs} />
                      {summary.anomalies.length}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>

                {/* Actions */}
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRecordEvent(summary.contactId)}
                  >
                    <Plus className={cn(iconSizes.xs, spacing.margin.right.xs)} />
                    {t('ika.timesheetTab.addEvent')}
                  </Button>
                </TableCell>
              </TableRow>

              {/* Expanded event details */}
              {isExpanded && hasEvents && (
                <TableRow>
                  <TableCell />
                  <TableCell colSpan={8} className={cn(spacing.padding.y.sm, 'bg-muted/30')}>
                    <div className={cn('space-y-1', spacing.padding.left.md)}>
                      {summary.events.map((event) => (
                        <AttendanceEventRow key={event.id || event.timestamp} event={event} />
                      ))}
                    </div>
                    {summary.anomalies.length > 0 && (
                      <div className={cn('mt-2 space-y-1', spacing.padding.left.md)}>
                        {summary.anomalies.map((anomaly, idx) => (
                          <div
                            key={`${anomaly.type}-${idx}`}
                            className={cn('flex items-center', spacing.gap.xs)}
                          >
                            <AlertTriangle className={cn(iconSizes.xxs, colors.text.warning)} />
                            <span className="text-xs text-muted-foreground">
                              {anomaly.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
