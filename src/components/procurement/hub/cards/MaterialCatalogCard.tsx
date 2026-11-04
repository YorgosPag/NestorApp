'use client';

import { Layers } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getProcurementHubUrl } from '@/lib/navigation/procurement-urls';
import { HubSectionCard } from './HubSectionCard';

/** Κάρτα χωρίς μετρητή — καθαρή είσοδος στον κατάλογο υλικών (ADR-330 §5.1 S3.4). */
export function MaterialCatalogCard() {
  const { t } = useTranslation('procurement');

  return (
    <HubSectionCard
      icon={Layers}
      iconClassName="text-[hsl(var(--text-warning))]"
      title={t('hub.materialCatalog.title')}
      description={t('hub.materialCatalog.description')}
      href={getProcurementHubUrl('materials')}
    />
  );
}
