'use client';

import { ClipboardList } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useRfqs } from '@/subapps/procurement/hooks/useRfqs';
import { getProcurementHubUrl } from '@/lib/navigation/procurement-urls';
import type { RfqStatus } from '@/subapps/procurement/types/rfq';
import { HubSectionCard } from './HubSectionCard';

/** Η ΙΔΙΑ κατάσταση που ζητά η κάρτα από τον server και φιλτράρει η λίστα όπου οδηγεί. */
const ACTIVE_RFQ: RfqStatus = 'active';

/** «N ενεργά» ⇒ η λίστα RFQ φιλτραρισμένη στα ίδια ενεργά (ADR-330 §5.1 S3.4). */
export function RfqCard() {
  const { t } = useTranslation('procurement');
  const { rfqs, loading } = useRfqs({ status: ACTIVE_RFQ });
  const count = rfqs.length;

  return (
    <HubSectionCard
      icon={ClipboardList}
      iconClassName="text-[hsl(var(--text-info))]"
      title={t('hub.rfq.title')}
      description={t('hub.rfq.description')}
      href={getProcurementHubUrl('rfqs', count > 0 ? { status: [ACTIVE_RFQ] } : undefined)}
      metric={loading ? '—' : t('hub.rfq.activeCount', { count })}
      hint={!loading && count === 0 ? t('hub.rfq.noActive') : undefined}
    />
  );
}
