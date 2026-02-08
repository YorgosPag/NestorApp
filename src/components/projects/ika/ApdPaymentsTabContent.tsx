'use client';

/**
 * =============================================================================
 * ApdPaymentsTabContent — Enterprise APD tracking & management
 * =============================================================================
 *
 * Tracks Αναλυτική Περιοδική Δήλωση (APD) submission status per month.
 * Displays employment records grouped by month with status tracking.
 *
 * @module components/projects/ika/ApdPaymentsTabContent
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System (Phase 3)
 */

import React, { useState, useMemo, useCallback } from 'react';
import { CreditCard, FileCheck, AlertTriangle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';
import { useEmploymentRecords } from './hooks/useEmploymentRecords';
import type { EmploymentRecord, ApdStatus } from './contracts';

interface ApdPaymentsTabContentProps {
  /** Project ID from parent IKA tab */
  projectId?: string;
}

/**
 * Maps ApdStatus to Badge variant.
 */
function getStatusVariant(status: ApdStatus): 'warning' | 'info' | 'success' | 'error' | 'default' {
  switch (status) {
    case 'pending': return 'warning';
    case 'submitted': return 'info';
    case 'accepted': return 'success';
    case 'rejected': return 'error';
    case 'corrected': return 'default';
  }
}

/**
 * Formats a number as Euro currency.
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Groups employment records by month/year and aggregates totals.
 */
interface ApdMonthGroup {
  month: number;
  year: number;
  records: EmploymentRecord[];
  totalContribution: number;
  workerCount: number;
  /** Overall status: worst status across all records */
  overallStatus: ApdStatus;
  /** Number of unique statuses */
  submittedCount: number;
  pendingCount: number;
}

function groupRecordsByMonth(records: EmploymentRecord[]): ApdMonthGroup[] {
  const groups = new Map<string, ApdMonthGroup>();

  for (const record of records) {
    const key = `${record.year}-${record.month}`;
    const existing = groups.get(key);

    if (existing) {
      existing.records.push(record);
      existing.totalContribution += record.totalContribution;
      existing.workerCount++;
      if (record.apdStatus === 'pending') existing.pendingCount++;
      if (record.apdStatus === 'submitted' || record.apdStatus === 'accepted') existing.submittedCount++;
    } else {
      groups.set(key, {
        month: record.month,
        year: record.year,
        records: [record],
        totalContribution: record.totalContribution,
        workerCount: 1,
        overallStatus: record.apdStatus,
        submittedCount: record.apdStatus === 'submitted' || record.apdStatus === 'accepted' ? 1 : 0,
        pendingCount: record.apdStatus === 'pending' ? 1 : 0,
      });
    }
  }

  // Determine overall status per group
  for (const group of groups.values()) {
    if (group.pendingCount === group.workerCount) {
      group.overallStatus = 'pending';
    } else if (group.submittedCount === group.workerCount) {
      group.overallStatus = 'accepted';
    } else {
      group.overallStatus = 'submitted'; // Partial
    }
  }

  // Sort by year DESC, month DESC (most recent first)
  return Array.from(groups.values()).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
}

export function ApdPaymentsTabContent({ projectId }: ApdPaymentsTabContentProps) {
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const typography = useTypography();
  const spacing = useSpacingTokens();

  // Query current year records (all months)
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // We load records for the current month (initial view)
  // In production, we'd load all months for the year
  const { records, isLoading, error, updateApdStatus } = useEmploymentRecords(
    projectId,
    currentMonth,
    currentYear
  );

  const monthGroups = useMemo(() => groupRecordsByMonth(records), [records]);

  const handleMarkSubmitted = useCallback(async (group: ApdMonthGroup) => {
    for (const record of group.records) {
      if (record.apdStatus === 'pending') {
        await updateApdStatus(record.id, 'submitted');
      }
    }
  }, [updateApdStatus]);

  // No project ID
  if (!projectId) {
    return (
      <section className={cn('flex flex-col items-center justify-center', spacing.padding.xl)}>
        <CreditCard className={cn(iconSizes.xl, 'text-muted-foreground')} />
        <p className={cn(typography.body.sm, 'text-muted-foreground', spacing.margin.top.sm)}>
          {t('ika.apdTab.noProjectId')}
        </p>
      </section>
    );
  }

  return (
    <section className={cn('flex flex-col', spacing.gap.lg)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className={typography.heading.lg}>
            {t('ika.apdTab.title')}
          </CardTitle>
          <CardDescription className={spacing.margin.top.xs}>
            {t('ika.apdTab.description')}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Loading */}
      {isLoading && (
        <Card>
          <CardContent className={cn('text-center', spacing.padding.xl, 'text-muted-foreground')}>
            <p className={typography.body.sm}>{t('common.loading', { defaultValue: 'Loading...' })}</p>
          </CardContent>
        </Card>
      )}

      {/* No records */}
      {!isLoading && monthGroups.length === 0 && (
        <Card>
          <CardContent className={cn('flex flex-col items-center', spacing.padding.xl)}>
            <FileCheck className={cn(iconSizes.xl, 'text-muted-foreground')} />
            <p className={cn(typography.body.sm, 'text-muted-foreground', spacing.margin.top.sm)}>
              {t('ika.apdTab.noRecords')}
            </p>
            <p className={cn(typography.body.xs, 'text-muted-foreground', spacing.margin.top.xs)}>
              {t('ika.apdTab.noRecordsHint')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* APD Periods Table */}
      {!isLoading && monthGroups.length > 0 && (
        <Card>
          <CardContent className={spacing.padding.none}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('ika.apdTab.columns.period')}</TableHead>
                  <TableHead>{t('ika.apdTab.columns.status')}</TableHead>
                  <TableHead className="text-right">{t('ika.apdTab.columns.workers')}</TableHead>
                  <TableHead className="text-right">{t('ika.apdTab.columns.contribution')}</TableHead>
                  <TableHead className="text-center">{t('ika.apdTab.columns.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthGroups.map((group) => {
                  const periodLabel = `${t(`ika.stampsTab.months.${group.month}`)} ${group.year}`;

                  return (
                    <TableRow key={`${group.year}-${group.month}`}>
                      <TableCell>
                        <p className={typography.label.sm}>{periodLabel}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(group.overallStatus)}>
                          {t(`ika.apdTab.status.${group.overallStatus}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {group.workerCount}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(group.totalContribution)}
                      </TableCell>
                      <TableCell className="text-center">
                        {group.overallStatus === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarkSubmitted(group)}
                          >
                            <FileCheck className={cn(iconSizes.sm, spacing.margin.right.xs)} />
                            {t('ika.apdTab.actions.markSubmitted')}
                          </Button>
                        )}
                        {group.overallStatus !== 'pending' && (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Error display */}
      {error && (
        <Card>
          <CardContent className={cn('flex items-center', spacing.padding.md)}>
            <AlertTriangle className={cn(iconSizes.md, colors.text.error, spacing.margin.right.sm)} />
            <p className={cn(typography.body.sm, colors.text.error)}>{error}</p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
