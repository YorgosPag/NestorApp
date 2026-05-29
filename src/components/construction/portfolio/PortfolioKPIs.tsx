'use client';

import { useTranslation } from 'react-i18next';
import { Building2, TrendingUp, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { PortfolioTotals } from '@/hooks/useConstructionPortfolio';

interface PortfolioKPIsProps {
  totals: PortfolioTotals;
  loading?: boolean;
}

interface KPICard {
  icon: React.ElementType;
  labelKey: string;
  value: string;
  atRisk?: boolean;
}

export function PortfolioKPIs({ totals, loading }: PortfolioKPIsProps) {
  const { t } = useTranslation('building-timeline');
  const colors = useSemanticColors();

  const cards: KPICard[] = [
    {
      icon: Building2,
      labelKey: 'portfolio.kpi.totalBuildings',
      value: String(totals.totalBuildings),
    },
    {
      icon: TrendingUp,
      labelKey: 'portfolio.kpi.avgSpi',
      value: totals.avgSPI.toFixed(2),
      atRisk: totals.avgSPI < 0.85,
    },
    {
      icon: AlertTriangle,
      labelKey: 'portfolio.kpi.totalAlerts',
      value: String(totals.totalActiveAlerts),
      atRisk: totals.totalActiveAlerts > 0,
    },
    {
      icon: ShieldAlert,
      labelKey: 'portfolio.kpi.atRisk',
      value: String(totals.buildingsAtRisk),
      atRisk: totals.buildingsAtRisk > 0,
    },
  ];

  return (
    <section aria-label={t('portfolio.kpiSectionLabel')} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map(card => {
        const Icon = card.icon;
        return (
          <article
            key={card.labelKey}
            className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
          >
            <header className="flex items-center gap-2">
              <Icon
                className={[
                  'h-4 w-4',
                  card.atRisk ? 'text-[hsl(var(--text-error))]' : colors.text.muted,
                ].join(' ')}
              />
              <span className="text-xs text-muted-foreground">{t(card.labelKey)}</span>
            </header>
            <p
              className={[
                'text-2xl font-semibold tabular-nums',
                loading ? 'animate-pulse text-muted-foreground' : '',
                card.atRisk ? 'text-[hsl(var(--text-error))]' : 'text-foreground',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {loading ? '—' : card.value}
            </p>
          </article>
        );
      })}
    </section>
  );
}
