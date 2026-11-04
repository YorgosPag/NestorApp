'use client';

import { FileText } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useQuotes } from '@/subapps/procurement/hooks/useQuotes';
import { QUOTE_PENDING_STATUSES } from '@/subapps/procurement/types/quote';
import { getProcurementHubUrl } from '@/lib/navigation/procurement-urls';
import { HubSectionCard } from './HubSectionCard';

/** «N σε αναμονή» ⇒ η λίστα προσφορών φιλτραρισμένη στο ΙΔΙΟ σύνολο καταστάσεων (ADR-330 §5.1 S3.4). */
export function QuotesCard() {
  const { t } = useTranslation('procurement');
  const { quotes, loading } = useQuotes();
  const count = quotes.filter((q) => QUOTE_PENDING_STATUSES.includes(q.status)).length;

  return (
    <HubSectionCard
      icon={FileText}
      iconClassName="text-[hsl(var(--text-warning))]"
      title={t('hub.quotes.title')}
      description={t('hub.quotes.description')}
      href={getProcurementHubUrl('quotes', count > 0 ? { status: QUOTE_PENDING_STATUSES } : undefined)}
      metric={loading ? '—' : t('hub.quotes.pendingCount', { count })}
      hint={!loading && count === 0 ? t('hub.quotes.noPending') : undefined}
    />
  );
}
