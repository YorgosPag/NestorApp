'use client';

/**
 * @module ReportAgingTable
 * @enterprise ADR-265 — Aging bucket visualization (30/60/90/120+ days)
 *
 * Specialized table for payment aging analysis with color-coded
 * intensity gradient (green → red as aging increases).
 */

import { getStatusColor } from '@/lib/design-system';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatCurrency, formatNumber } from '@/lib/intl-formatting';
import { ReportEmptyState } from './ReportEmptyState';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgingBucket {
  /** Display label (e.g. "0-30 ημέρες") */
  label: string;
  /** Number of items in bucket */
  count: number;
  /** Total amount in bucket */
  amount: number;
}

export interface AgingRow {
  /** Unique identifier */
  id: string;
  /** Row label (e.g. customer name, project name) */
  name: string;
  /** Total amount across all buckets */
  total: number;
  /** Bucket values */
  buckets: AgingBucket[];
  /** Flag if any bucket is overdue */
  overdue?: boolean;
}

export interface ReportAgingTableProps {
  /** Aging data rows */
  data: AgingRow[];
  /** Custom bucket column headers */
  bucketLabels?: string[];
  /** Show amounts (default: true) */
  showAmounts?: boolean;
  /** Show counts (default: false) */
  showCounts?: boolean;
  /** Color intensity gradient (default: true) */
  colorScale?: boolean;
  /** Custom value formatter */
  formatValue?: (value: number) => string;
  /** Click handler for rows */
  onRowClick?: (row: AgingRow) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUCKET_INTENSITY = [
  `${getStatusColor('available', 'bg')}/10`,   // 0-30: healthy
  `${getStatusColor('reserved', 'bg')}/10`,    // 31-60: attention
  `${getStatusColor('construction', 'bg')}/10`,// 61-90: concerning
  `${getStatusColor('error', 'bg')}/10`,       // 91-120: critical
  `${getStatusColor('error', 'bg')}/20`,       // 120+: severe
];

const BUCKET_TEXT = [
  getStatusColor('available', 'text'),
  getStatusColor('reserved', 'text'),
  getStatusColor('construction', 'text'),
  getStatusColor('error', 'text'),
  getStatusColor('error', 'text'),
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReportAgingTable({
  data,
  bucketLabels,
  showAmounts = true,
  showCounts = false,
  colorScale = true,
  formatValue: customFormat,
  onRowClick,
  className,
}: ReportAgingTableProps) {
  const { t } = useTranslation('reports');
  const formatter = customFormat ?? formatCurrency;

  // Default bucket labels from i18n
  const defaultLabels = [
    t('aging.buckets.current'),
    t('aging.buckets.thirtyOne'),
    t('aging.buckets.sixtyOne'),
    t('aging.buckets.ninetyOne'),
    t('aging.buckets.overdue'),
  ];
  const labels = bucketLabels ?? defaultLabels;

  // Totals row
  const totals = useMemo(() => {
    const bucketTotals = labels.map((_, i) => ({
      count: data.reduce((sum, row) => sum + (row.buckets[i]?.count ?? 0), 0),
      amount: data.reduce((sum, row) => sum + (row.buckets[i]?.amount ?? 0), 0),
    }));
    const grandTotal = data.reduce((sum, row) => sum + row.total, 0);
    return { bucketTotals, grandTotal };
  }, [data, labels]);

  if (data.length === 0) {
    return <ReportEmptyState type="no-data" className={className} />;
  }

  return (
    <div className={cn('overflow-x-auto rounded-md border border-border', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 bg-background min-w-[160px]">
              {/* Name column */}
            </TableHead>
            {labels.map((label, i) => (
              <TableHead key={i} className="text-center min-w-[100px]">
                {label}
              </TableHead>
            ))}
            <TableHead className="text-right min-w-[120px] font-semibold">
              {t('aging.total')}
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {data.map((row) => (
            <TableRow
              key={row.id}
              className={cn(
                onRowClick && 'cursor-pointer',
                row.overdue && 'font-medium',
              )}
              onClick={() => onRowClick?.(row)}
            >
              <TableCell className="sticky left-0 z-10 bg-background font-medium">
                {row.name}
              </TableCell>
              {labels.map((_, i) => {
                const bucket = row.buckets[i];
                const amount = bucket?.amount ?? 0;
                const count = bucket?.count ?? 0;
                const hasValue = amount > 0 || count > 0;

                return (
                  <TableCell
                    key={i}
                    className={cn(
                      'text-center tabular-nums',
                      colorScale && hasValue && BUCKET_INTENSITY[i],
                      colorScale && hasValue && BUCKET_TEXT[i],
                    )}
                  >
                    {showAmounts && hasValue ? formatter(amount) : ''}
                    {showCounts && hasValue && (
                      <span className="block text-xs opacity-70">
                        ({formatNumber(count)})
                      </span>
                    )}
                    {!hasValue && '—'}
                  </TableCell>
                );
              })}
              <TableCell className="text-right font-semibold tabular-nums">
                {formatter(row.total)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>

        <TableFooter>
          <TableRow className="font-bold">
            <TableCell className="sticky left-0 z-10">{t('aging.total')}</TableCell>
            {totals.bucketTotals.map((bt, i) => (
              <TableCell
                key={i}
                className={cn('text-center tabular-nums', colorScale && BUCKET_TEXT[i])}
              >
                {showAmounts ? formatter(bt.amount) : ''}
                {showCounts && (
                  <span className="block text-xs opacity-70">
                    ({formatNumber(bt.count)})
                  </span>
                )}
              </TableCell>
            ))}
            <TableCell className="text-right tabular-nums">
              {formatter(totals.grandTotal)}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
