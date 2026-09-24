'use client';

/**
 * **ΕΝΑ ΤΜΗΜΑ ΤΗΣ ΛΙΣΤΑΣ** — μία κλάση συγκρισιμότητας, με ή χωρίς επιγραφή.
 *
 * @related ADR-777 §8.60.14 · lib/listings/listing-price-sections.ts
 * @module components/search-results/ResultsListSection
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΞΕΧΩΡΙΣΤΑ.** Η `ResultsList` κρατά **τη διάταξη** της οθόνης 2 —
 * το καδράρισμα του δείκτη άκρης, το δοχείο κύλισης, τη γραμμή των αγγελιών χωρίς θέση.
 * Το *«πώς ζωγραφίζεται μία κλάση»* είναι **άλλη** ερώτηση, και μαζί τους η συνάρτηση
 * της λίστας ξεπερνούσε τις **40 γραμμές** (N.7.1).
 */

import React from 'react';
import { listingFocusStrength, type ListingFocus } from '@/lib/listings/listing-focus';
import type { ListingSection } from '@/lib/listings/listing-price-sections';
import { PriceClassSection } from '@/components/shared/price-sections/PriceClassSection';
import { cn } from '@/lib/utils';

import { ListingCard } from './ListingCard';
import { LISTING_CARD_GRID_CLASS, RESULTS_CARD_IMAGE_SIZES } from './listing-card-frame';
import type { PublicListing } from '@/types/public-listing';

interface ResultsListSectionProps {
  readonly section: ListingSection;
  readonly focus: ListingFocus;
  readonly onHover: (id: string | null) => void;
  readonly filterQuery: string;
  /**
   * Η **μία** κάρτα ολόκληρης της λίστας που φορτώνει την εικόνα της κατά προτεραιότητα
   * (ADR-841 §7 Α2.4) — κατά **ταυτότητα**, όχι κατά δείκτη: με τρία τμήματα, ένα
   * `index === 0` ανά τμήμα θα έδινε **τρεις**, που **ακυρώνουν η μία την άλλη**.
   */
  readonly priorityId: string | null;
  readonly undeclaredLabelsFor: (listing: PublicListing) => readonly string[];
}

export function ResultsListSection({
  section,
  focus,
  onHover,
  filterQuery,
  priorityId,
  undeclaredLabelsFor,
}: ResultsListSectionProps) {
  const cards = (
    <ul className={cn(LISTING_CARD_GRID_CLASS, 'p-3')}>
      {section.items.map((listing) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          focusStrength={listingFocusStrength(focus, listing.id)}
          onHover={onHover}
          filterQuery={filterQuery}
          priority={listing.id === priorityId}
          imageSizes={RESULTS_CARD_IMAGE_SIZES}
          undeclaredLabels={undeclaredLabelsFor(listing)}
        />
      ))}
    </ul>
  );

  /*
    🔑 Η επιγραφή **είναι** η δήλωση του κανόνα κατάταξης (Καν. ΕΕ 2019/1150 άρ. 5 · Οδηγία ΕΕ
    2019/2161): «Πώληση · 6 ακίνητα» λέει ότι η σύγκριση έγινε **μέσα** στην πώληση. Μία κλάση ⇒
    καμία περιτύλιξη. Η σήμανση ζει στο **κοινό** `PriceClassSection` (και των εσωτερικών λιστών,
    §8.60.14.14).

    ⚠️ **`<h2>`, ΚΑΙ ΤΟ ΜΕΤΡΗΣΕ ΑΓΚΥΡΑ.** Ο τίτλος κάθε κάρτας είναι ήδη `<h3>`· επιγραφή στο
    **ίδιο** επίπεδο θα έκανε «Πώληση» και «Διαμέρισμα στο Κέντρο» **αδέλφια**.
  */
  return (
    <PriceClassSection
      heading={section.heading}
      count={section.items.length}
      idPrefix="results-section"
      level="h2"
    >
      {cards}
    </PriceClassSection>
  );
}
