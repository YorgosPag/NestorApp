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
import { getCurrentLocale } from '@/lib/intl-utils';
import { EMPTY_LISTING_CRITERIA, withDateBound, type ListingCriteria } from '@/lib/criteria/listing-criteria';
import { availabilityPromisePhrase } from '@/lib/listings/availability-phrase';
import { EMPTY_LISTING_FILTERS, serializeListingFilters } from '@/lib/listings/listing-filters';
import { searchResultsHref } from '@/lib/listings/listing-routes';
import { VISIBLE_LINK_CLASS } from '@/lib/ui/link-style';
import { Link } from '@/lib/workspace/navigation';
import type { AreaUnderConstruction } from '@/types/area-market';
import type { PublicListing } from '@/types/public-listing';

const NS = 'area-market';

interface AreaListingsSectionProps {
  readonly areaId: string;
  readonly items: readonly PublicListing[];
  readonly total: number;
  /** «Χτίζονται N» της τελευταίας νύχτας (ADR-919 §12) — `null` = καμία, και η γραμμή σιωπά. */
  readonly underConstruction: AreaUnderConstructionNote | null;
}

/** Το «χτίζονται N» μαζί με την ημέρα του στιγμιότυπου που το μέτρησε: το «σήμερα» του κριτηρίου. */
export interface AreaUnderConstructionNote {
  readonly summary: AreaUnderConstruction;
  readonly day: string;
}

/**
 * **Η αναζήτηση της περιοχής**, με όποια κριτήρια ζητηθούν — από τον ΕΝΑ σειριοποιητή (`serializeListingFilters`), ποτέ
 * με χειρόγραφες παραμέτρους. Ίδια παράμετρος περιοχής (ADR-883) για το «δες όλες» και για το «χτίζονται».
 */
function areaSearchHref(areaId: string, criteria: ListingCriteria): string {
  return searchResultsHref(serializeListingFilters({ ...EMPTY_LISTING_FILTERS, criteria, near: { adminId: areaId } }).toString());
}

/**
 * **«Χτίζονται N»** — σύνδεσμος στην αναζήτηση της περιοχής με τον άξονα παράδοσης (ADR-919 §12), με τη ΜΙΑ φράση
 * ημερομηνίας (`availabilityPromisePhrase`).
 *
 * 🔑 Το `after` είναι η **ημέρα του στιγμιότυπου**, όχι το σήμερα του επισκέπτη: η αναζήτηση ρωτά το ίδιο
 * `futureDeliveryPromiseOf` με το ίδιο «σήμερα» που έβγαλε τον αριθμό. ⚠️ Η συμμετοχή στην περιοχή διαφέρει ακόμη
 * (`adminArea` εδώ, πολύγωνο + «ίσως» στο `?area=`, ADR-890 §9.1). Ισχύει ήδη και για το «δες όλες».
 */
function UnderConstructionNote({ areaId, value }: { readonly areaId: string; readonly value: AreaUnderConstructionNote | null }) {
  const { t } = useTranslation([NS, 'common-shared']);
  if (value === null) return null;
  const date = availabilityPromisePhrase(value.summary.next, t, getCurrentLocale());
  const criteria = withDateBound(EMPTY_LISTING_CRITERIA, 'delivery', { after: value.day, by: null });
  return (
    <Link href={areaSearchHref(areaId, criteria)} className={`self-start text-sm text-foreground ${VISIBLE_LINK_CLASS}`}>
      {t(`${NS}:listings.underConstruction`, { count: value.summary.count, date })}
    </Link>
  );
}

export function AreaListingsSection({ areaId, items, total, underConstruction }: AreaListingsSectionProps) {
  const { t } = useTranslation([NS]);
  const href = areaSearchHref(areaId, EMPTY_LISTING_CRITERIA);
  return (
    <section aria-labelledby="area-listings" className="flex flex-col gap-3">
      <h2 id="area-listings" className="m-0 text-xl font-semibold text-foreground">{t(`${NS}:listings.title`)}</h2>
      <UnderConstructionNote areaId={areaId} value={underConstruction} />
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
