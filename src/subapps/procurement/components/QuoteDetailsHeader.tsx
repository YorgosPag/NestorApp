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
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { QuoteStatusBadge } from '@/subapps/procurement/components/QuoteStatusBadge';
import type { Quote } from '@/subapps/procurement/types/quote';

interface QuoteDetailsHeaderProps {
  quote: Quote;
  onCreateNew?: () => void;
  onEdit?: () => void;
  onArchive?: () => void;
}

export function QuoteDetailsHeader({
  quote,
  onCreateNew,
  onEdit,
  onArchive,
}: QuoteDetailsHeaderProps) {
  const { t } = useTranslation('quotes');
  const isTerminal = quote.status === 'archived';

  return (
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
  );
}
