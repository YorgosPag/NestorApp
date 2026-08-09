'use client';

/**
 * Η κάρτα της οθόνης 2 — **5 βασικά + 3 ειδικά πεδία, ΠΟΤΕ περισσότερα** (§25.6).
 *
 * ⚠️ Το «ποτέ περισσότερα» δεν είναι ύφος: μετρήθηκε (Baymard) ότι κάθε επιπλέον πεδίο
 * μειώνει τη σάρωση της λίστας. Τα υπόλοιπα ζουν στη **σελίδα ακινήτου** (οθόνη 3),
 * που είναι η προοδευτική αποκάλυψη της Α7.
 *
 * 🔴 **Η τιμή περνά ΠΑΝΤΑ από τον SSoT** (`price-resolver`): το `@deprecated` επίπεδο
 * `price` ήταν αυτό που διάβαζε η παλιά κάρτα ενώ το φίλτρο διάβαζε άλλο πεδίο. Και η
 * **απουσία τιμής είναι ΚΑΤΑΣΤΑΣΗ με αιτία**, ποτέ «0 €».
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveDisplayPrice } from '@/lib/properties/price-resolver';
import type { PublicListing } from '@/types/public-listing';
import { formatCurrency } from '@/lib/intl-formatting';

interface ListingCardProps {
  readonly listing: PublicListing;
  readonly isHighlighted: boolean;
  readonly onHover: (id: string | null) => void;
  readonly onSelect: (id: string) => void;
}

const MISSING_PRICE_KEY = {
  'not-listed': 'card.priceMissing.notListed',
  'sale-price-missing': 'card.priceMissing.salePriceMissing',
  'rent-price-missing': 'card.priceMissing.rentPriceMissing',
} as const;

export function ListingCard({ listing, isHighlighted, onHover, onSelect }: ListingCardProps) {
  const { t } = useTranslation(['search-results']);
  const price = resolveDisplayPrice(listing);

  return (
    <li>
      <article
        onMouseEnter={() => onHover(listing.id)}
        onMouseLeave={() => onHover(null)}
        onClick={() => onSelect(listing.id)}
        className={[
          'cursor-pointer rounded-lg border bg-card p-3 transition-colors',
          isHighlighted ? 'border-ring bg-accent' : 'border-border',
        ].join(' ')}
      >
        <h3 className="truncate text-sm font-medium text-foreground">{listing.title}</h3>

        <p className="mt-1 text-base font-semibold text-foreground">
          {price.kind === 'priced'
            ? formatCurrency(price.headline.amount)
            : t(`search-results:${MISSING_PRICE_KEY[price.reason]}`)}
          {price.kind === 'priced' && price.secondary && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {formatCurrency(price.secondary.amount)}
            </span>
          )}
        </p>

        <dl className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          {listing.areaSqm !== null && (
            <div><dd>{t('search-results:card.areaSqm', { value: listing.areaSqm })}</dd></div>
          )}
          {listing.floor !== null && (
            <div>
              <dd>
                {listing.floor === 0
                  ? t('search-results:card.groundFloor')
                  : t('search-results:card.floor', { value: listing.floor })}
              </dd>
            </div>
          )}
          {listing.bedrooms !== null && (
            <div><dd>{t('search-results:card.bedrooms', { count: listing.bedrooms })}</dd></div>
          )}
        </dl>

        {/* Οι ΔΙΑΘΕΣΕΙΣ, ποτέ το lossy `commercialStatus` — αλλιώς η αντιπαροχή σιωπά. */}
        <ul className="mt-2 flex flex-wrap gap-1">
          {listing.offerKinds.map((kind) => (
            <li
              key={kind}
              className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground"
            >
              {t(`search-results:card.offer.${kind}`)}
            </li>
          ))}
        </ul>
      </article>
    </li>
  );
}
