'use client';

/**
 * ForwardCurveChart — the ECB spot curve against the forward curve implied by it.
 *
 * Renders through the ADR-710 chart card shell.
 *
 * ## Why the rate table underneath is gone
 *
 * The card used to draw the plot and then, below it, a hand-built table of the same
 * three columns — tenor, spot, forward. Same numbers, two renderers, and only the
 * table explained its terms. The shell already owns a data table derived from the
 * series description, so the explanations moved onto the series themselves
 * (`description`) and the second table went away. There is now one place where a
 * number is turned into text, which is the point of the shell.
 *
 * @enterprise ADR-242 SPEC-242E — Forward Curves
 * @enterprise ADR-710 — Chart card shell
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Info, AlertCircle, HelpCircle } from 'lucide-react';

import { API_ROUTES } from '@/config/domain-constants';
import { Badge } from '@/components/ui/badge';
import { ChartCard, seriesColorVar, type ChartSeries } from '@/components/ui/chart-card';
import { Spinner } from '@/components/ui/spinner';
import {
  Tooltip as RadixTooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatPercentage } from '@/lib/intl-utils';
import { createStaleCache } from '@/lib/stale-cache';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { cn } from '@/lib/utils';
import type { ForwardCurveResult } from '@/types/interest-calculator';
import '@/lib/design-system';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

const forwardCurveCache = createStaleCache<ForwardCurveResult>('sales-forward-curve');
const logger = createModuleLogger('ForwardCurveChart');

// =============================================================================
// TYPES
// =============================================================================

type TranslateFn = (key: string, opts?: Record<string, string>) => string;

interface ForwardCurveChartProps {
  t: TranslateFn;
}

interface CurvePoint {
  tenor: string;
  spotRate: number;
  forwardRate: number | null;
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

/** Rates arrive as percentage points (3.25 = 3.25%), which is what this expects. */
const RATE_DIGITS = { minimumFractionDigits: 4, maximumFractionDigits: 4 } as const;
const AXIS_DIGITS = { minimumFractionDigits: 2, maximumFractionDigits: 2 } as const;

// =============================================================================
// DATA
// =============================================================================

interface ForwardCurveState {
  result: ForwardCurveResult | null;
  isLoading: boolean;
  failed: boolean;
}

/** Fetches the curve once, serving the stale cache while the request is in flight. */
function useForwardCurve(): ForwardCurveState {
  const [result, setResult] = useState<ForwardCurveResult | null>(forwardCurveCache.get() ?? null);
  const [isLoading, setIsLoading] = useState(!forwardCurveCache.hasLoaded());
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchForwardCurve() {
      if (!forwardCurveCache.hasLoaded()) setIsLoading(true);
      setFailed(false);
      try {
        const response = await fetch(API_ROUTES.ECB.FORWARD_RATES);
        const data = await response.json();
        if (cancelled) return;

        if (data.success && data.result) {
          forwardCurveCache.set(data.result);
          setResult(data.result);
          return;
        }
        // The server's wording is for the log; the reader gets the translated message.
        logger.warn('Forward curve request rejected', { error: data.error });
        setFailed(true);
      } catch (error) {
        if (cancelled) return;
        logger.warn('Forward curve request failed', { error });
        setFailed(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void fetchForwardCurve();
    return () => {
      cancelled = true;
    };
  }, []);

  return { result, isLoading, failed };
}

function buildCurveData(result: ForwardCurveResult): CurvePoint[] {
  return result.spotRates.map((spot) => ({
    tenor: spot.tenor,
    spotRate: spot.rate,
    forwardRate: result.forwardRates.find((rate) => rate.toTenor === spot.tenor)?.rate ?? null,
  }));
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ForwardCurveChart({ t }: ForwardCurveChartProps) {
  const { result, isLoading, failed } = useForwardCurve();

  const chartData = useMemo(() => (result ? buildCurveData(result) : []), [result]);

  const series = useMemo<ChartSeries<CurvePoint>[]>(
    () => [
      {
        key: 'spotRate',
        label: t('costCalculator.forwardCurve.spotLine'),
        description: t('costCalculator.forwardCurve.spotLineTooltip'),
      },
      {
        key: 'forwardRate',
        label: t('costCalculator.forwardCurve.forwardLine'),
        description: t('costCalculator.forwardCurve.forwardLineTooltip'),
      },
    ],
    [t],
  );

  const formatRate = useCallback((value: number) => formatPercentage(value, RATE_DIGITS), []);
  const formatAxisRate = useCallback((value: number) => formatPercentage(value, AXIS_DIGITS), []);

  if (isLoading) return <CurveLoading t={t} />;
  if (failed || !result) return <CurveError t={t} />;

  return (
    <article className="space-y-4">
      <aside className="flex gap-2 rounded-lg border border-primary/30 bg-[hsl(var(--bg-info))]/20 p-3">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-sm leading-relaxed text-foreground">
          {t('costCalculator.forwardCurve.infoBanner')}
        </p>
      </aside>

      <ChartCard
        series={series}
        data={chartData}
        categoryKey="tenor"
        categoryLabel={t('costCalculator.forwardCurve.tenor')}
        categoryDescription={t('costCalculator.forwardCurve.tenorTooltip')}
        formatValue={formatRate}
      >
        <ChartCard.Header title={t('costCalculator.forwardCurve.chartTitle')}>
          <CurveShapeBadge shape={result.curveShape} t={t} />
        </ChartCard.Header>

        <ChartCard.Figure
          caption={t('costCalculator.forwardCurve.chartCaption')}
          emptyMessage={t('costCalculator.forwardCurve.chartEmptyState')}
          size="lg"
        >
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="tenor" tickLine={false} axisLine={false} />
            <YAxis
              tickFormatter={formatAxisRate}
              domain={['auto', 'auto']}
              width={72}
              tickLine={false}
              axisLine={false}
            />
            <ChartCard.Tooltip />
            <Line
              type="monotone"
              dataKey="spotRate"
              stroke={seriesColorVar('spotRate')}
              strokeWidth={2}
              dot={{ r: 4 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="forwardRate"
              stroke={seriesColorVar('forwardRate')}
              strokeWidth={2}
              // Dashed, so the implied curve stays distinguishable from the observed
              // one without relying on the two hues being told apart.
              strokeDasharray="6 3"
              dot={{ r: 4 }}
              connectNulls
            />
          </ComposedChart>
        </ChartCard.Figure>

        <ChartCard.Summary>
          <ChartCard.SummaryItem
            label={t('costCalculator.forwardCurve.rateDate')}
            value={result.rateDate}
          />
        </ChartCard.Summary>
      </ChartCard>
    </article>
  );
}

// =============================================================================
// STATES
// =============================================================================

function CurveLoading({ t }: { t: TranslateFn }) {
  const colors = useSemanticColors();
  return (
    <section className="flex items-center justify-center p-8">
      <Spinner size="medium" aria-label={t('costCalculator.forwardCurve.loading')} />
      <span className={cn('ml-2 text-sm', colors.text.muted)}>
        {t('costCalculator.forwardCurve.loading')}
      </span>
    </section>
  );
}

function CurveError({ t }: { t: TranslateFn }) {
  return (
    <section
      role="alert"
      className="flex items-center gap-2 rounded-lg border border-destructive bg-destructive/10 p-4"
    >
      <AlertCircle className="h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
      <p className="text-sm text-destructive">{t('costCalculator.forwardCurve.error')}</p>
    </section>
  );
}

/** The classification the API returns, with the sentence that explains it. */
function CurveShapeBadge({ shape, t }: { shape: string; t: TranslateFn }) {
  const colors = useSemanticColors();
  return (
    <span className="inline-flex items-center gap-2">
      <RadixTooltip>
        <TooltipTrigger asChild>
          <HelpCircle className={cn('h-3.5 w-3.5 cursor-help', colors.text.muted)} />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {t('costCalculator.forwardCurve.chartTitleTooltip')}
        </TooltipContent>
      </RadixTooltip>
      <RadixTooltip>
        <TooltipTrigger asChild>
          <span>
            <Badge variant={SHAPE_BADGE_VARIANT[shape] ?? 'outline'} className="cursor-help">
              {t(`costCalculator.forwardCurve.shape.${shape}`)}
            </Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          {t(`costCalculator.forwardCurve.shape.${shape}Tooltip`)}
        </TooltipContent>
      </RadixTooltip>
    </span>
  );
}
