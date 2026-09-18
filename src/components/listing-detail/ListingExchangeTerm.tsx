'use client';

/**
 * **Ο όρος της αντιπαροχής στη σελίδα της αγγελίας** — «40% στον οικοπεδούχο, επί των νέων τ.μ.».
 *
 * @related ADR-777 §8.60.17 · types/public-listing.ts (`PublicListingExchange`) · lib/offers/derive-exchange-terms.ts
 *
 * 🏆 Στα portals (xe.gr «Αντιπαροχές οικοπέδων») το ποσοστό ζει **μόνο σε ελεύθερο κείμενο**. Εδώ είναι
 * δομημένο, και η φράση λέει **ρητά ποιανού** είναι — το «60-40» διαβάζεται και από τις δύο μεριές.
 *
 * ⚠️ **Χωρίς δήλωση λέει «προς συζήτηση», όχι τίποτα**: η αντιπαροχή **διατίθεται** (αλλιώς το κουτί
 * είναι `null` και δεν αποδίδεται καθόλου) — η σιωπή θα έκανε τον εργολάβο να υποθέσει ότι ξεχάστηκε.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatPercentage } from '@/lib/intl-formatting';
import type { PublicListingExchange } from '@/types/public-listing';

export function ListingExchangeTerm({
  exchange,
}: {
  readonly exchange: PublicListingExchange | null;
}): React.ReactElement | null {
  const { t } = useTranslation(['listing-detail']);
  if (exchange === null) return null;

  return (
    <p className="mt-2 text-sm text-foreground">
      {exchange.landownerShare === null
        ? t('listing-detail:exchange.negotiable')
        : t('listing-detail:exchange.share', { share: formatPercentage(exchange.landownerShare) })}
    </p>
  );
}
