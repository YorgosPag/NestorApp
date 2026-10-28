'use client';

/**
 * Σήμα κατάστασης προσφοράς — ΙΔΙΑ παραλλαγή με τις κάρτες λίστας/πλέγματος (`QUOTE_STATUS_BADGE_VARIANTS`),
 * ΙΔΙΟ μετρημένο μελάνι (`Badge` → `SOLID_FILL_INK`, ADR-854 §3).
 *
 * 🔴 Ως τις 2026-10-28 είχε δική του αντιστοίχιση χρώματος και έβαζε γέμισμα **και** κείμενο από το ΙΔΙΟ token
 * (`bg-…status-warning` + `text-…status-warning`) ⇒ «Υποβλήθηκε» πορτοκαλί πάνω σε πορτοκαλί: άδειο χάπι στην
 * κεφαλίδα κάθε προσφοράς (ADR-327 changelog 2026-10-28).
 */

import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { QUOTE_STATUS_BADGE_VARIANTS } from '@/domain/cards/quote/quote-card-model';
import type { QuoteStatus } from '@/subapps/procurement/types/quote';

interface QuoteStatusBadgeProps {
  status: QuoteStatus;
  className?: string;
}

export function QuoteStatusBadge({ status, className }: QuoteStatusBadgeProps) {
  const { t } = useTranslation('quotes');
  return (
    <Badge variant={QUOTE_STATUS_BADGE_VARIANTS[status]} className={className}>
      {t(`quotes.statuses.${status}`)}
    </Badge>
  );
}
