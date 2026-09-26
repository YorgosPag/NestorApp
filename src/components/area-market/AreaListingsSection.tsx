'use client';

/**
 * **Οι αγγελίες της περιοχής** — οι νεότερες, και ένα κλικ για όλες στον χάρτη αποτελεσμάτων (ADR-890 Φ1).
 *
 * 🔑 **Κανένας δεύτερος χάρτης αποτελεσμάτων.** Η πλήρης λίστα ζει ήδη στο `/search/results?area=<id>` (ADR-883):
 * ίδια παράμετρος, ίδιο όριο, ίδιος κριτής «μέσα/ίσως/έξω». Εδώ μόνο η προεπισκόπηση, με τις κάρτες της αναζήτησης.
 */

import React from 'react';

import { SavedListingsProvider } from '@/components/listings/SavedListingsProvider';
import { ListingCard } from '@/components/search-results/ListingCard';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { searchResultsHref } from '@/lib/listings/listing-routes';
import { SEARCH_REGION_PARAM } from '@/lib/listings/listing-search-area';
import { Link } from '@/lib/workspace/navigation';
import type { PublicListing } from '@/types/public-listing';

const NS = 'area-market';

interface AreaListingsSectionProps {
  readonly areaId: string;
  readonly items: readonly PublicListing[];
  readonly total: number;
}

export function AreaListingsSection({ areaId, items, total }: AreaListingsSectionProps) {
  const { t } = useTranslation([NS]);
  const href = searchResultsHref(new URLSearchParams({ [SEARCH_REGION_PARAM]: areaId }).toString());
  return (
    <section aria-labelledby="area-listings" className="flex flex-col gap-3">
      <h2 id="area-listings" className="m-0 text-xl font-semibold text-foreground">{t(`${NS}:listings.title`)}</h2>
      {items.length === 0
        ? <p className="m-0 text-sm text-muted-foreground">{t(`${NS}:listings.empty`)}</p>
        : (
          <SavedListingsProvider>
            {/* Η ρίζα του `ListingCard` είναι ήδη `<li>` (φέρει το `data-listing-id`). */}
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {items.map((listing, index) => (
                <ListingCard key={listing.id} listing={listing} priority={index === 0} />
              ))}
            </ul>
          </SavedListingsProvider>
        )}
      {total > 0 && (
        <Link
          href={href}
          className="self-start rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          {t(`${NS}:listings.seeAll`, { count: total })}
        </Link>
      )}
    </section>
  );
}
