'use client';

import { Users2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePOSupplierContacts } from '@/hooks/procurement/usePOSupplierContacts';
import { getProcurementHubUrl } from '@/lib/navigation/procurement-urls';
import { HubSectionCard } from './HubSectionCard';

/** Μετρά **όλο** το μητρώο ⇒ οδηγεί στη λίστα χωρίς φίλτρο (ADR-330 §5.1 S3.4). */
export function VendorMasterCard() {
  const { t } = useTranslation('procurement');
  const { suppliers, loading } = usePOSupplierContacts();

  return (
    <HubSectionCard
      icon={Users2}
      iconClassName="text-[hsl(var(--text-success))]"
      title={t('hub.vendorMaster.title')}
      description={t('hub.vendorMaster.description')}
      href={getProcurementHubUrl('vendors')}
      metric={loading ? '—' : t('hub.vendorMaster.supplierCount', { count: suppliers.length })}
    />
  );
}
