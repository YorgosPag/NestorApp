'use client';

/**
 * QuoteDetailsHeader — Header SSoT για το right-pane του Quote detail
 *
 * Stesso pattern di ContactDetailsHeader / PurchaseOrderDetailsHeader: wrappa
 * `EntityDetailsHeader` con action presets centralizzati (`createEntityAction`).
 * Espone "+Νέα Προσφορά" sempre disponibile (pari a contacts/POs) anche quando
 * un quote è selezionato. Usa `QuoteStatusBadge` SSoT per il status adornment.
 *
 * @see ADR-267 §Phase H — Quote Detail Header SSoT
 * @see src/components/procurement/PurchaseOrderDetailsHeader.tsx (sibling pattern)
 */

import { FileText } from 'lucide-react';
import { EntityDetailsHeader, createEntityAction } from '@/core/entity-headers';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { QuoteStatusBadge } from '@/subapps/procurement/components/QuoteStatusBadge';
import type { Quote } from '@/subapps/procurement/types/quote';
import { isExpired, daysUntilExpiry, formatValidUntilDate } from '@/subapps/procurement/utils/quote-expiration';

interface QuoteDetailsHeaderProps {
  quote: Quote;
  onCreateNew?: () => void;
  onEdit?: () => void;
  onArchive?: () => void;
  onRequestRenewal?: () => void;
}

export function QuoteDetailsHeader({
  quote,
  onCreateNew,
  onEdit,
  onArchive,
  onRequestRenewal,
}: QuoteDetailsHeaderProps) {
  const { t } = useTranslation('quotes');
  const isTerminal = quote.status === 'archived';
  const expired = isExpired(quote);
  const days = daysUntilExpiry(quote);
  const daysAgo = days !== null && days < 0 ? Math.abs(days) : 1;
  const validUntilDate = formatValidUntilDate(quote);

  return (
    <div>
      <EntityDetailsHeader
        icon={FileText}
        title={quote.displayNumber}
        variant="detailed"
        titleAdornment={<QuoteStatusBadge status={quote.status} className="text-sm" />}
        actions={[
          ...(onCreateNew
            ? [createEntityAction('new', t('list.createQuote'), onCreateNew)]
            : []),
          ...(onEdit && !isTerminal
            ? [createEntityAction('edit', t('detail.editQuote'), onEdit)]
            : []),
          ...(onArchive && !isTerminal
            ? [createEntityAction('delete', t('detail.archiveQuote'), onArchive)]
            : []),
        ]}
      />
      {expired && (
        <div className="mx-2 mb-2 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-3 text-sm">
          <span className="text-amber-800 dark:text-amber-200 font-medium">
            {daysAgo === 1
              ? t('rfqs.expiry.banner.title', { date: validUntilDate, daysAgo })
              : t('rfqs.expiry.banner.titlePlural', { date: validUntilDate, daysAgo })}
          </span>
          {onRequestRenewal && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRequestRenewal}
              className="shrink-0 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30"
            >
              {t('rfqs.expiry.banner.requestRenewalCta')} →
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
