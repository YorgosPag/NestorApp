'use client';

import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PortfolioKPIs } from '@/components/construction/portfolio/PortfolioKPIs';
import { PortfolioTable } from '@/components/construction/portfolio/PortfolioTable';
import { useConstructionPortfolio } from '@/hooks/useConstructionPortfolio';

export default function ConstructionPortfolioPage() {
  const { t } = useTranslation('building-timeline');
  const { items, totals, loading, error, refresh } = useConstructionPortfolio();

  return (
    <main className="flex flex-col gap-6 p-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('portfolio.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('portfolio.subtitle')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={loading}
          aria-label={t('portfolio.refresh')}
        >
          <RefreshCw className={['h-4 w-4 mr-2', loading ? 'animate-spin' : ''].join(' ')} />
          {t('portfolio.refresh')}
        </Button>
      </header>

      {error && (
        <p role="alert" className="rounded border border-[hsl(var(--bg-error))/30] bg-[hsl(var(--bg-error))/10] px-4 py-2 text-sm text-[hsl(var(--bg-error))]">
          {error}
        </p>
      )}

      <PortfolioKPIs totals={totals} loading={loading} />

      <section className="rounded-lg border border-border bg-card">
        <PortfolioTable items={items} loading={loading} />
      </section>
    </main>
  );
}
