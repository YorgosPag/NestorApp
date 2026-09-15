'use client';

/**
 * **Η μείωση τιμής στη σελίδα της αγγελίας** — η σήμανση, μαζί με το ΠΟΤΕ και το ΣΕ ΣΧΕΣΗ ΜΕ ΤΙ.
 *
 * @related ADR-777 §8.69 · components/search-results/PriceReductionBadge.tsx
 *
 * 🏆 **Εδώ ξεπερνάμε τη Zillow**, της οποίας οι σημάνσεις μείωσης κατηγορούνται δημόσια ότι
 * συγκρίνουν με μπαγιάτικες τιμές: η σελίδα γράφει **ρητά** ότι η αναφορά είναι *«η χαμηλότερη
 * τιμή των τελευταίων 30 ημερών»* (κανόνας Omnibus, εθελοντικά — νομικά αφορά μόνο αγαθά).
 *
 * 🔴 **Χωριστό αρχείο, και είναι ο λόγος που χωρά**: η `ListingCard` ζει στο **κέλυφος**, και
 * ο γεννήτορας αποδίδει κλειδιά i18n **ανά αρχείο**. Αν η ημερομηνία και η αναφορά ζούσαν στο
 * `PriceReductionBadge`, το `listing-detail` θα έμπαινε στο κέλυφος κάθε διαδρομής (CHECK 3.34,
 * ADR-777 §8.51). Εδώ φορτώνονται **μόνο** στη σελίδα της αγγελίας.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';
import {
  PriceReductionBadge,
  useFreshReduction,
} from '@/components/search-results/PriceReductionBadge';
import type { PriceReduction } from '@/types/price-history';

interface ListingPriceReductionProps {
  readonly reduction: PriceReduction | null;
}

export function ListingPriceReduction({ reduction }: ListingPriceReductionProps) {
  const { t } = useTranslation(['listing-detail']);
  const fresh = useFreshReduction(reduction);

  if (fresh === null) return null;

  return (
    <>
      <p className="mt-2">
        <PriceReductionBadge reduction={fresh} />{' '}
        <span className="text-sm text-muted-foreground">
          {t('listing-detail:priceReduction.since', {
            date: formatDate(fresh.since, { day: '2-digit', month: '2-digit', year: 'numeric' }),
          })}
        </span>
      </p>
      <p className="text-xs text-muted-foreground">{t('listing-detail:priceReduction.basis')}</p>
    </>
  );
}
