'use client';

/**
 * Η λίστα της οθόνης 2 — **ζωντανή ταυτόχρονα** με τον χάρτη, ποτέ σε εναλλαγή.
 *
 * ⛔ ADR-777 Α3: *«Καμία εναλλαγή χάρτη ⇄ λίστας ως κύριος μηχανισμός, σε καμία
 * οθόνη»* — είναι η επιλογή (α), όπου μετρήθηκε **65%** να μη χρησιμοποιούν ποτέ τον
 * χάρτη. Τα δύο πλαίσια δείχνουν **το ίδιο φιλτραρισμένο σύνολο**, από την **ίδια**
 * συνάρτηση (`applyListingFilters`), γι' αυτό δεν μπορούν να διαφωνήσουν.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ListingCard } from './ListingCard';
import { UnmappedListingsRow } from './UnmappedListingsRow';
import type { PublicListing } from '@/types/public-listing';

interface ResultsListProps {
  readonly mapped: readonly PublicListing[];
  readonly unmapped: readonly PublicListing[];
  readonly highlightedId: string | null;
  readonly onHover: (id: string | null) => void;
  /**
   * Τα ενεργά φίλτρα ως ερώτημα. Περνά **αναλλοίωτο** και στα δύο μέρη της λίστας,
   * ώστε η επιστροφή από την οθόνη 3 να βρίσκει **την ίδια** αναζήτηση (Α3).
   */
  readonly filterQuery: string;
  /**
   * **Ποια στοιχεία σιωπά αυτή η αγγελία, ΩΣ ΚΕΙΜΕΝΟ** — ερώτηση, όχι πίνακας (§8.51).
   *
   * 🔑 **Συνάρτηση και όχι χάρτης `id → άξονες`**: ένας χάρτης θα ήταν **δεύτερο
   * αντίγραφο** της κρίσης, χτισμένο πάνω σε ολόκληρο τον κατάλογο για να διαβαστεί
   * από όσες κάρτες τυχαίνει να ζωγραφιστούν. Η κρίση μιας αγγελίας κοστίζει όσο οι
   * **ρωτημένοι** άξονες — τρέχει όπου καταναλώνεται.
   *
   * ⚠️ **Η λίστα δεν ξέρει τι είναι «σιωπή» και δεν πρέπει.** Παραδίδει την ερώτηση
   * από τον γονιό στην κάρτα· ο **κριτής** ζει στο `lib/criteria`, όπου και ανήκει.
   */
  readonly undeclaredLabelsFor: (listing: PublicListing) => readonly string[];
}

export function ResultsList({
  mapped,
  unmapped,
  highlightedId,
  onHover,
  filterQuery,
  undeclaredLabelsFor,
}: ResultsListProps) {
  const { t } = useTranslation(['search-results']);
  const isEmpty = mapped.length === 0 && unmapped.length === 0;

  return (
    <section aria-label={t('search-results:list.label')} className="flex h-full flex-col">
      {/*
        `data-list-scroll`: το **φύλλο** (στενή οθόνη) κλείνει αυτή την κύλιση όσο δεν είναι
        πλήρες, ώστε η χειρονομία να **μεγαλώνει το φύλλο** αντί να διαβάζει αγγελίες μέσα
        σε χαραμάδα — NN/g: *«expands to take up the full page as the user scrolls down the
        list»* (SPEC-777D §26.2).

        🔑 Γνώρισμα, **όχι prop**: ο κανόνας «η λίστα κυλά μόνο όταν είμαι πλήρες» ανήκει
        στο φύλλο, όχι στη λίστα. Ένα prop θα υποχρέωνε **κάθε** καταναλωτή της λίστας —
        και τη στήλη του desktop, που δεν έχει στάσεις — να έχει γνώμη γι' αυτόν.
      */}
      <div data-list-scroll className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <p className="p-4 text-sm text-muted-foreground">{t('search-results:list.empty')}</p>
        ) : (
          <ul className="space-y-2 p-3">
            {/*
              🔑 **ΜΟΝΟ Η ΠΡΩΤΗ ΚΑΡΤΑ ΕΙΝΑΙ «ΥΨΗΛΗΣ»** (ADR-841 §7 Α2.4): η θέση είναι
              γνώση **της λίστας**, όχι της κάρτας — και πολλές εικόνες υψηλής
              προτεραιότητας **ακυρώνουν η μία την άλλη**.
            */}
            {mapped.map((listing, index) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                isHighlighted={listing.id === highlightedId}
                onHover={onHover}
                filterQuery={filterQuery}
                priority={index === 0}
                undeclaredLabels={undeclaredLabelsFor(listing)}
              />
            ))}
          </ul>
        )}
      </div>

      {/*
        ⛔ ΣΤΟ ΤΕΛΟΣ ΤΗΣ ΛΙΣΤΑΣ, ΜΕΣΑ ΣΤΟ ΙΔΙΟ ΠΛΑΙΣΙΟ — ποτέ δεύτερη επιφάνεια
        (Α5 §4.2, κανόνας 21). Και ποτέ φιλτραρισμένη από την κίνηση του χάρτη.
      */}
      <UnmappedListingsRow listings={unmapped} filterQuery={filterQuery} />
    </section>
  );
}
