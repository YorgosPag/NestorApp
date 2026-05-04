'use client';

import { useRouter } from 'next/navigation';
import { Package } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePurchaseOrders } from '@/hooks/procurement/usePurchaseOrders';

export function PurchaseOrdersCard() {
  const { t } = useTranslation('procurement');
  const router = useRouter();
  const { allCount, loading } = usePurchaseOrders();

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => router.push('/procurement/purchase-orders')}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && router.push('/procurement/purchase-orders')}
      aria-label={t('hub.purchaseOrders.title')}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <Package className="h-8 w-8 text-indigo-600" aria-hidden />
        </div>
        <CardTitle className="text-lg">{t('hub.purchaseOrders.title')}</CardTitle>
        <CardDescription>{t('hub.purchaseOrders.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-foreground">
          {loading ? '—' : t('hub.purchaseOrders.count', { count: allCount })}
        </p>
        {!loading && allCount === 0 && (
          <p className="mt-1 text-xs text-muted-foreground">{t('hub.purchaseOrders.noOrders')}</p>
        )}
      </CardContent>
    </Card>
  );
}
