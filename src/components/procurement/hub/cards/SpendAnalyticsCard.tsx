'use client';

import { useRouter } from 'next/navigation';
import { BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePurchaseOrders } from '@/hooks/procurement/usePurchaseOrders';
import { formatCurrency } from '@/lib/intl-formatting';

export function SpendAnalyticsCard() {
  const { t } = useTranslation('procurement');
  const router = useRouter();
  const { purchaseOrders, loading } = usePurchaseOrders();

  const totalSpend = loading
    ? null
    : purchaseOrders.reduce((acc, po) => acc + (po.total ?? 0), 0);

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => router.push('/procurement/analytics')}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && router.push('/procurement/analytics')}
      aria-label={t('hub.spendAnalytics.title')}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <BarChart3 className="h-8 w-8 text-red-600" aria-hidden />
          <Badge variant="secondary" className="text-xs">{t('hub.spendAnalytics.phase')}</Badge>
        </div>
        <CardTitle className="text-lg">{t('hub.spendAnalytics.title')}</CardTitle>
        <CardDescription>{t('hub.spendAnalytics.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t('hub.spendAnalytics.totalPos')}</span>
          <span className="font-semibold">{loading ? '—' : purchaseOrders.length}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t('hub.spendAnalytics.totalSpend')}</span>
          <span className="font-semibold">
            {totalSpend === null ? '—' : formatCurrency(totalSpend, 'EUR')}
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t('hub.spendAnalytics.comingSoon')}</p>
      </CardContent>
    </Card>
  );
}
