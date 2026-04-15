/* eslint-disable design-system/no-hardcoded-colors */
/* eslint-disable design-system/enforce-semantic-colors */
'use client';

/**
 * ForwardCurveChart — Yield Curve Visualization
 *
 * Self-contained component that fetches forward curve data from
 * /api/ecb/forward-rates and displays spot + forward rates on
 * a composed chart with curve shape classification.
 *
 * @enterprise ADR-242 SPEC-242E - Forward Curves
 */

import React, { useEffect, useState } from 'react';
import { API_ROUTES } from '@/config/domain-constants';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Info, Loader2, AlertCircle, HelpCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { FinancialTooltip } from './FinancialTooltip';
import { InfoTableHead } from './InfoLabel';
import {
  Tooltip as RadixTooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { ForwardCurveResult } from '@/types/interest-calculator';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { createStaleCache } from '@/lib/stale-cache';

const forwardCurveCache = createStaleCache<ForwardCurveResult>('sales-forward-curve');

// =============================================================================
// TYPES
// =============================================================================

interface ForwardCurveChartProps {
  t: (key: string, opts?: Record<string, string>) => string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SHAPE_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  normal: 'default',
  inverted: 'destructive',
  flat: 'secondary',
  humped: 'outline',
};

// =============================================================================
// COMPONENT
// =============================================================================

export function ForwardCurveChart({ t }: ForwardCurveChartProps) {
  const colors = useSemanticColors();
  const [result, setResult] = useState<ForwardCurveResult | null>(forwardCurveCache.get() ?? null);
  const [isLoading, setIsLoading] = useState(!forwardCurveCache.hasLoaded());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchForwardCurve() {
      if (!forwardCurveCache.hasLoaded()) setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(API_ROUTES.ECB.FORWARD_RATES);
        const data = await res.json();

        if (cancelled) return;

        if (data.success && data.result) {
          forwardCurveCache.set(data.result);
          setResult(data.result);
        } else {
          setError(data.error ?? 'Unknown error');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Network error');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchForwardCurve();
    return () => { cancelled = true; };
  }, []);

  // --- Loading state ---
  if (isLoading) {
    return (
      <section className="flex items-center justify-center p-8">
        <Loader2 className={cn("h-6 w-6 animate-spin", colors.text.muted)} />
        <span className={cn("ml-2 text-sm", colors.text.muted)}>
          {t('costCalculator.forwardCurve.loading')}
        </span>
      </section>
    );
  }

  // --- Error state ---
  if (error || !result) {
    return (
      <section className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-4">
        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
        <p className="text-sm text-red-800 dark:text-red-300">
          {error ?? t('costCalculator.forwardCurve.error')}
        </p>
      </section>
    );
  }

  // --- Build chart data ---
  const chartData = result.spotRates.map((spot) => {
    const forward = result.forwardRates.find((f) => f.toTenor === spot.tenor);
    return {
      tenor: spot.tenor,
      spotRate: spot.rate,
      forwardRate: forward?.rate ?? null,
    };
  });

  return (
    <article className="space-y-4">
      {/* Info banner */}
      <aside className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-3">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
          {t('costCalculator.forwardCurve.infoBanner')}
        </p>
      </aside>

      {/* Curve shape badge */}
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold inline-flex items-center gap-1">
          {t('costCalculator.forwardCurve.chartTitle')}
          <RadixTooltip>
            <TooltipTrigger asChild>
              <HelpCircle className={cn("h-3.5 w-3.5 cursor-help", colors.text.muted)} />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {t('costCalculator.forwardCurve.chartTitleTooltip')}
            </TooltipContent>
          </RadixTooltip>
        </h3>
        <RadixTooltip>
          <TooltipTrigger asChild>
            <span>
              <Badge variant={SHAPE_BADGE_VARIANT[result.curveShape] ?? 'outline'} className="cursor-help">
                {t(`costCalculator.forwardCurve.shape.${result.curveShape}`)}
              </Badge>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs">
            {t(`costCalculator.forwardCurve.shape.${result.curveShape}Tooltip`)}
          </TooltipContent>
        </RadixTooltip>
      </header>

      {/* Chart */}
      <figure>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="tenor" tick={{ fontSize: 12 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => `${v.toFixed(2)}%`}
              domain={['auto', 'auto']}
            />
            <Tooltip
              content={
                <FinancialTooltip
                  valueFormatter={(value, name) => [
                    `${(value as number).toFixed(4)}%`,
                    name === 'spotRate'
                      ? t('costCalculator.forwardCurve.spotLine')
                      : t('costCalculator.forwardCurve.forwardLine'),
                  ]}
                />
              }
            />
            <Legend
              formatter={(value: string) =>
                value === 'spotRate'
                  ? t('costCalculator.forwardCurve.spotLine')
                  : t('costCalculator.forwardCurve.forwardLine')
              }
            />
            <Line
              type="monotone"
              dataKey="spotRate"
              stroke="hsl(200, 98%, 39%)"
              strokeWidth={2}
              dot={{ r: 4 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="forwardRate"
              stroke="hsl(142, 71%, 45%)"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={{ r: 4 }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </figure>

      {/* Rate table */}
      <section>
        <h4 className="text-sm font-semibold mb-2">
          {t('costCalculator.forwardCurve.rateTableTitle')}
        </h4>
        <Table>
          <TableHeader>
            <TableRow>
              <InfoTableHead label={t('costCalculator.forwardCurve.tenor')} tooltip={t('costCalculator.forwardCurve.tenorTooltip')} />
              <InfoTableHead className="text-right" label={t('costCalculator.forwardCurve.spotLine')} tooltip={t('costCalculator.forwardCurve.spotLineTooltip')} />
              <InfoTableHead className="text-right" label={t('costCalculator.forwardCurve.forwardLine')} tooltip={t('costCalculator.forwardCurve.forwardLineTooltip')} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.spotRates.map((spot) => {
              const forward = result.forwardRates.find((f) => f.toTenor === spot.tenor);
              return (
                <TableRow key={spot.tenor}>
                  <TableCell className="font-medium">{spot.tenor}</TableCell>
                  <TableCell className="text-right font-mono">{spot.rate.toFixed(4)}%</TableCell>
                  <TableCell className="text-right font-mono">
                    {forward ? `${forward.rate.toFixed(4)}%` : '—'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <p className={cn("text-xs mt-2", colors.text.muted)}>
          {t('costCalculator.forwardCurve.rateDate')}: {result.rateDate}
        </p>
      </section>
    </article>
  );
}
