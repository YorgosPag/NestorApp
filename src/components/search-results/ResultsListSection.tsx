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
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { listingFocusStrength, type ListingFocus } from '@/lib/listings/listing-focus';
import { PRICE_SECTION_KEY } from '@/lib/listings/listing-price-keys';
import type { ListingSection } from '@/lib/listings/listing-price-sections';
import { ListingCard } from './ListingCard';
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
  const { t } = useTranslation(['common']);

  const cards = (
    <ul className="space-y-2 p-3">
      {section.listings.map((listing) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          focusStrength={listingFocusStrength(focus, listing.id)}
          onHover={onHover}
          filterQuery={filterQuery}
          priority={listing.id === priorityId}
          undeclaredLabels={undeclaredLabelsFor(listing)}
        />
      ))}
    </ul>
  );

  /*
    🔑 **ΜΙΑ ΚΛΑΣΗ, ΚΑΜΙΑ ΠΕΡΙΤΥΛΙΞΗ.** Με ομοιογενή αποτελέσματα το `heading` είναι
    `null` και η έξοδος είναι **χαρακτήρα προς χαρακτήρα** η οθόνη πριν το §8.60.14:
    ούτε `<section>`, ούτε επιγραφή. Μια επιγραφή πάνω από λίστα ενός είδους θα
    επαναλάμβανε ό,τι λέει **ήδη** η μονάδα κάθε κάρτας (§8.60.11) — θόρυβος με στολή
    ειλικρίνειας.
  */
  if (section.heading === null) return cards;

  const headingId = `results-section-${section.heading}`;

  /*
    ⚠️ **`<section>` με επιγραφή, ποτέ `<div>` με έντονο κείμενο** (N.4): ο αναγνώστης
    οθόνης οφείλει να μπορεί να **πηδήξει** από κλάση σε κλάση — είναι η ίδια πληροφορία
    που ο βλέπων παίρνει από το κενό και την τυπογραφία.

    🔑 **Η επιγραφή ΕΙΝΑΙ η δήλωση του κανόνα κατάταξης** (Καν. ΕΕ 2019/1150 άρ. 5 ·
    Οδηγία ΕΕ 2019/2161): «Πώληση · 6 ακίνητα» λέει ότι η σύγκριση έγινε **μέσα** στην
    πώληση, και **πόσο** προσπερνά όποιος κυλά. Γι' αυτό δεν χρειάστηκε δεύτερη,
    γραπτή σημείωση όπως στο §8.61 — εκεί η βύθιση ήταν **αόρατη**, εδώ τίποτα δεν είναι.
  */
  return (
    <section aria-labelledby={headingId}>
      {/*
        ⚠️ **`<h2>`, ΚΑΙ ΤΟ ΜΕΤΡΗΣΕ ΑΓΚΥΡΑ.** Ο τίτλος κάθε κάρτας είναι ήδη `<h3>`· μια
        επιγραφή τμήματος στο **ίδιο** επίπεδο θα έλεγε στον αναγνώστη οθόνης ότι
        «Πώληση» και «Διαμέρισμα στο Κέντρο» είναι **αδέλφια**, δηλαδή θα κατέστρεφε
        ακριβώς την ιεραρχία που η διαμέριση υπάρχει για να δηλώσει. Η πρώτη γραφή το
        είχε λάθος.

        🔑 **`sticky`**: το ίδιο που κάνει το Revit όταν επαναλαμβάνει την επικεφαλίδα
        ομάδας σε κάθε σελίδα — η κλάση δεν επιτρέπεται να χαθεί όταν κυλήσει έξω.
      */}
      <h2
        id={headingId}
        className="sticky top-0 z-10 bg-background/95 px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur"
      >
        {t(PRICE_SECTION_KEY[section.heading], { count: section.listings.length })}
      </h2>
      {cards}
    </section>
  );
}
