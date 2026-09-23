'use client';

/**
 * **Η ΣΥΜΠΤΥΓΜΕΝΗ ΓΡΑΜΜΗ** — «3 ακόμη: μπορεί να είναι εδώ, μπορεί και όχι».
 *
 * ADR-777 Α5 §4.1 — ⛔ **Ποτέ σιωπηλή εξαφάνιση.** Όταν ο χρήστης σέρνει τον χάρτη, οι
 * αγγελίες **χωρίς δηλωμένη θέση δεν φιλτράρονται**: δεν μπορούμε να τις αποκλείσουμε
 * από περιοχή που **δεν ξέρουμε** αν τους ανήκει. Το να τις κρύψουμε θα ήταν ισχυρισμός
 * γνώσης που δεν έχουμε.
 *
 * ⚠️ **Ανοίγει ΜΕΣΑ στο ίδιο πλαίσιο** — ποτέ δεύτερη επιφάνεια (Α5 §4.2, κανόνας 21:
 * NN/g *«never stack»*).
 *
 * 🔑 Η **αιτία** εμφανίζεται ανά αγγελία, γιατί οι δύο καταστάσεις **δεν είναι
 * εναλλάξιμες**: «δεν ρωτήθηκε ποτέ» είναι **δικό μας** χρέος με θεραπεία· «ο
 * ιδιοκτήτης δεν δήλωσε» είναι **επιλογή του** και δεν ζητάμε διόρθωση.
 */

import React from 'react';
import { Link } from '@/lib/workspace/navigation';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { listingDetailHref } from '@/lib/listings/listing-routes';
import type { PublicListing, UnknownPositionReason } from '@/types/public-listing';
import { UNMAPPED_ROW_LINK_CLASS, UnmappedRow } from './UnmappedRow';

interface UnmappedListingsRowProps {
  readonly listings: readonly PublicListing[];
  /** Τα ενεργά φίλτρα ως ερώτημα — ταξιδεύουν και από εδώ προς την οθόνη 3. */
  readonly filterQuery: string;
}

const REASON_KEY: Record<UnknownPositionReason, string> = {
  'never-asked': 'unmapped.reason.neverAsked',
  'owner-declined': 'unmapped.reason.ownerDeclined',
};

function reasonOf(listing: PublicListing): UnknownPositionReason | null {
  return listing.position.kind === 'unknown' ? listing.position.reason : null;
}

/**
 * Προσαρμογέας πάνω στο κοινό κέλυφος (`UnmappedRow`, ADR-777 §8.71).
 *
 * ⚠️ Στο μηδέν ΔΕΝ εμφανίζεται — και αυτό δεν αναιρεί τον κανόνα 27: το «0» το λέει
 * ήδη ρητά η λογιστική (`ListingLedgerBar`), που τυπώνεται πάντα.
 */
export function UnmappedListingsRow({ listings, filterQuery }: UnmappedListingsRowProps) {
  const { t } = useTranslation(['search-results']);

  const items = listings.map((listing) => {
    const reason = reasonOf(listing);
    return {
      id: listing.id,
      link: (
        <Link href={listingDetailHref(listing.id, filterQuery)} className={UNMAPPED_ROW_LINK_CLASS}>
          {listing.title}
        </Link>
      ),
      note: reason ? t(`search-results:${REASON_KEY[reason]}`) : null,
    };
  });

  return (
    <UnmappedRow
      heading={t('search-results:unmapped.heading', { count: listings.length })}
      hint={t('search-results:unmapped.hint')}
      items={items}
    />
  );
}
