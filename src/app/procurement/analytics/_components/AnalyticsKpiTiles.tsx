'use client';

/**
 * AnalyticsKpiTiles — 4 KPI tiles with comparison deltas (ADR-331 §4 D8).
 *
 * Tiles: totalPOs · committedAmount · deliveredAmount · activeSuppliers.
 * Each tile shows current value (3xl) + Δ% with up/down icon. Insufficient
 * historical data renders "—" with tooltip.
 *
 * @see ADR-331 §4 D8, D18, D21, D22, D23
 */

import type { LucideIcon } from 'lucide-react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-formatting';
import { KpiCardSkeleton } from '@/components/projects/procurement/overview/skeleton/KpiSkeleton';
import type { SpendKpis } from '@/services/procurement/aggregators/spendAnalyticsAggregator';

interface AnalyticsKpiTilesProps {
  kpis: SpendKpis | null;
  deltas: SpendKpis | null;
  previousFrom: string;
  previousTo: string;
  isLoading: boolean;
}

interface TileDef {
  key: keyof SpendKpis;
  labelKey: string;
  icon: LucideIcon;
  isCurrency: boolean;
}

const TILES: readonly TileDef[] = [
  { key: 'totalPOs', labelKey: 'analytics.kpi.totalPOs', icon: ShoppingCart, isCurrency: false },
  { key: 'committedAmount', labelKey: 'analytics.kpi.committedAmount', icon: TrendingUp, isCurrency: true },
  { key: 'deliveredAmount', labelKey: 'analytics.kpi.deliveredAmount', icon: Truck, isCurrency: true },
  { key: 'activeSuppliers', labelKey: 'analytics.kpi.activeSuppliers', icon: Users, isCurrency: false },
] as const;

function DeltaBadge({ delta, hasHistory, tooltip }: { delta: number; hasHistory: boolean; tooltip: string }) {
  const positive = hasHistory && delta > 0;
  const negative = hasHistory && delta < 0;
  const color = !hasHistory
    ? 'text-muted-foreground'
    : positive ? 'text-emerald-600' : negative ? 'text-rose-600' : 'text-muted-foreground';
  const Icon = positive ? ArrowUpRight : negative ? ArrowDownRight : Minus;
  const sign = positive ? '+' : '';
  const label = hasHistory ? `${sign}${delta.toFixed(1)}%` : '—';

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}>
            <Icon className="h-3 w-3" aria-hidden />
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface KpiTileProps {
  def: TileDef;
  value: number;
  delta: number;
  hasHistory: boolean;
  deltaTooltip: string;
}

function KpiTile({ def, value, delta, hasHistory, deltaTooltip }: KpiTileProps) {
  const { t } = useTranslation('procurement');
  const Icon = def.icon;
  const display = def.isCurrency ? formatCurrency(value, 'EUR') : value.toLocaleString();

  return (
    <Card aria-label={t(def.labelKey)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{t(def.labelKey)}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-3xl font-bold tracking-tight">{display}</p>
        <DeltaBadge delta={delta} hasHistory={hasHistory} tooltip={deltaTooltip} />
      </CardContent>
    </Card>
  );
}

export function AnalyticsKpiTiles({ kpis, deltas, previousFrom, previousTo, isLoading }: AnalyticsKpiTilesProps) {
  const { t } = useTranslation('procurement');

  if (isLoading || !kpis) {
    return (
      <section aria-busy="true" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
      </section>
    );
  }

  const hasHistory = previousFrom !== '' && previousTo !== '';
  const deltaTooltip = hasHistory
    ? t('analytics.kpi.deltaTooltip', { from: previousFrom, to: previousTo })
    : t('analytics.kpi.noHistorical');

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {TILES.map((def) => (
        <KpiTile
          key={def.key}
          def={def}
          value={kpis[def.key]}
          delta={deltas?.[def.key] ?? 0}
          hasHistory={hasHistory}
          deltaTooltip={deltaTooltip}
        />
      ))}
    </section>
  );
}
