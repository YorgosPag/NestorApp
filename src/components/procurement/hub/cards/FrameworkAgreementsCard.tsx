'use client';

import { useMemo } from 'react';
import { ScrollText } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFrameworkAgreements } from '@/hooks/procurement/useFrameworkAgreements';
import { getProcurementHubUrl } from '@/lib/navigation/procurement-urls';
import {
  AGREEMENT_BUCKET_PREDICATES,
  type AgreementBucket,
} from '@/subapps/procurement/utils/framework-agreement-buckets';
import { HubSectionCard } from './HubSectionCard';

const ACTIVE_BUCKET: readonly AgreementBucket[] = ['active'];

/**
 * «N ενεργές» με τον ΙΔΙΟ ορισμό της σελίδας συμβάσεων (κατάσταση **και** ημερομηνία λήξης) ⇒ οδηγεί στη
 * λίστα φιλτραρισμένη σε αυτές (ADR-330 §5.1 S3.4).
 */
export function FrameworkAgreementsCard() {
  const { t } = useTranslation('procurement');
  const { agreements, loading } = useFrameworkAgreements();
  const count = useMemo(() => {
    const nowMs = Date.now();
    return agreements.filter((a) => AGREEMENT_BUCKET_PREDICATES.active(a, nowMs)).length;
  }, [agreements]);

  return (
    <HubSectionCard
      icon={ScrollText}
      iconClassName="text-foreground"
      title={t('hub.frameworkAgreements.title')}
      description={t('hub.frameworkAgreements.description')}
      href={getProcurementHubUrl('agreements', count > 0 ? { status: ACTIVE_BUCKET } : undefined)}
      metric={loading ? '—' : t('hub.frameworkAgreements.activeCount', { count })}
      hint={!loading && count === 0 ? t('hub.frameworkAgreements.noActive') : undefined}
    />
  );
}
