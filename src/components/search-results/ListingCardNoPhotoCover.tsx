'use client';

/**
 * @fileoverview **Η κάρτα αγγελίας χωρίς φωτογραφία** — ο χάρτης της θέσης στο ΙΔΙΟ πλαίσιο.
 * @related ADR-777 §8.80 · §8.70 · listing-map-snapshot/MapOrAbsenceCover · listing-card-frame
 * @module components/search-results/ListingCardNoPhotoCover
 *
 * 🔴 **ΤΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΤΟ ΓΕΝΝΗΣΕ (2026-09-24, στιγμιότυπο του Giorgio)**: η γκαλερί επέστρεφε `null`
 * χωρίς εικόνες, η κάρτα μίκραινε στο μισό, και η βιτρίνα της οθόνης 1 έγινε **σκαλοπάτια** — δίπλα
 * σε κάρτες με φωτογραφία, οι κάρτες χωρίς φωτογραφία έμοιαζαν ημιτελείς.
 *
 * 🔑 Ο χάρτης **δεν** είναι ενδεικτική εικόνα (§25.5.2): είναι η θέση **αυτής** της αγγελίας, από το
 * **δημόσιο** σημάδι (`listingMapMark`) — ποτέ ακριβέστερο από ό,τι δείχνει ο χάρτης αναζήτησης. Χωρίς
 * σημάδι ή provider στη σελίδα, το πλαίσιο λέει «Χωρίς φωτογραφία» με το ίδιο ύψος.
 *
 * ⚠️ **Λεξιλόγιο φωτογραφιών, όχι αναζήτησης** (`common-photos`): η κάρτα ζει στο κέλυφος, και το
 * `search-results` είναι στο όριο του προϋπολογισμού του (CHECK 3.34). «Χωρίς φωτογραφία» είναι λέξη
 * φωτογραφιών — ίδιο μάθημα με τα βελάκια της γκαλερί (`ListingCardGallery`).
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { listingMapMark } from '@/lib/listings/listing-map-mark';
import type { PublicListing } from '@/types/public-listing';
import { MapOrAbsenceCover } from '@/components/listing-map-snapshot/MapOrAbsenceCover';

import { LISTING_CARD_ASPECT_CLASS } from './listing-card-frame';

interface ListingCardNoPhotoCoverProps {
  readonly listing: Pick<PublicListing, 'title' | 'position'>;
  readonly className?: string;
}

export function ListingCardNoPhotoCover({ listing, className = '' }: ListingCardNoPhotoCoverProps): React.ReactElement {
  const { t } = useTranslation(['common-photos', 'common']);
  return (
    <MapOrAbsenceCover
      mark={listingMapMark(listing.position)}
      frameClassName={`${LISTING_CARD_ASPECT_CLASS} w-full overflow-hidden rounded-md ${className}`}
      mapAlt={t('common-photos:photos.locationMapAlt', { title: listing.title })}
      mapLoadingLabel={t('common:common.loading')}
      absenceLabel={t('common-photos:photos.none')}
    />
  );
}
