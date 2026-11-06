'use client';

import { Package } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePurchaseOrders } from '@/hooks/procurement/usePurchaseOrders';
import { getProcurementHubUrl } from '@/lib/navigation/procurement-urls';
import { HubSectionCard } from './HubSectionCard';

/** Μετρά **όλες** τις παραγγελίες ⇒ οδηγεί στη λίστα χωρίς φίλτρο (ADR-330 §5.1 S3.4). */
export function PurchaseOrdersCard() {
  const { t } = useTranslation('procurement');
  const { allCount, loading } = usePurchaseOrders();

  return (
    <HubSectionCard
      icon={Package}
      iconClassName="text-foreground"
      title={t('hub.purchaseOrders.title')}
      description={t('hub.purchaseOrders.description')}
      href={getProcurementHubUrl('purchase-orders')}
      metric={loading ? '—' : t('hub.purchaseOrders.count', { count: allCount })}
      hint={!loading && allCount === 0 ? t('hub.purchaseOrders.noOrders') : undefined}
    />
  );
}
