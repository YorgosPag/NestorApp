'use client';

import '@/lib/design-system';

/**
 * @module reports/sections/cash-flow/ForecastVsActualTable
 * @enterprise ADR-268 Phase 8 — Q9: Forecast vs Actual comparison
 */

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { getStatusColor } from '@/lib/design-system';
import type { ActualVsForecast } from '@/services/cash-flow/cash-flow.types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ForecastVsActualTableProps {
  rows: ActualVsForecast[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(value: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function fmtPct(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function varianceClass(value: number): string {
  if (value > 0) return getStatusColor('active', 'text');
  if (value < 0) return getStatusColor('error', 'text');
  return 'text-muted-foreground';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ForecastVsActualTable({ rows }: ForecastVsActualTableProps) {
  const { t } = useTranslation('cash-flow');

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('comparison.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('comparison.noData', 'No past months to compare yet.')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('comparison.title')}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background">{t('table.month')}</TableHead>
              <TableHead className="text-right">{t('comparison.forecastInflow', 'Forecast In')}</TableHead>
              <TableHead className="text-right">{t('comparison.actualInflow', 'Actual In')}</TableHead>
              <TableHead className="text-right">{t('comparison.variance', 'Variance')}</TableHead>
              <TableHead className="text-right">{t('comparison.forecastOutflow', 'Forecast Out')}</TableHead>
              <TableHead className="text-right">{t('comparison.actualOutflow', 'Actual Out')}</TableHead>
              <TableHead className="text-right">{t('comparison.variance', 'Variance')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.month}>
                <TableCell className="sticky left-0 bg-background font-medium">
                  {row.label}
                </TableCell>
                <TableCell className="text-right">{fmt(row.forecastInflow)}</TableCell>
                <TableCell className="text-right">{fmt(row.actualInflow)}</TableCell>
                <TableCell className={cn('text-right', varianceClass(row.inflowVariance))}>
                  {fmt(row.inflowVariance)}
                  <span className="ml-1 text-xs">({fmtPct(row.inflowVariancePct)})</span>
                </TableCell>
                <TableCell className="text-right">{fmt(row.forecastOutflow)}</TableCell>
                <TableCell className="text-right">{fmt(row.actualOutflow)}</TableCell>
                <TableCell className={cn('text-right', varianceClass(-row.outflowVariance))}>
                  {fmt(row.outflowVariance)}
                  <span className="ml-1 text-xs">({fmtPct(row.outflowVariancePct)})</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
