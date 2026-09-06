'use client';

/**
 * Η λίστα της οθόνης 2 — **ζωντανή ταυτόχρονα** με τον χάρτη, ποτέ σε εναλλαγή.
 *
 * ⛔ ADR-777 Α3: *«Καμία εναλλαγή χάρτη ⇄ λίστας ως κύριος μηχανισμός, σε καμία
 * οθόνη»* — είναι η επιλογή (α), όπου μετρήθηκε **65%** να μη χρησιμοποιούν ποτέ τον
 * χάρτη. Τα δύο πλαίσια δείχνουν **το ίδιο φιλτραρισμένο σύνολο**, από την **ίδια**
 * συνάρτηση (`applyListingFilters`), γι' αυτό δεν μπορούν να διαφωνήσουν.
 */

import React, { useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useListingRevealTracking } from '@/hooks/listings/useListingRevealTracking';
import { focusedListingId, listingFocusStrength, type ListingFocus } from '@/lib/listings/listing-focus';
import { ListingCard } from './ListingCard';
import { ListingEdgeIndicator } from './ListingEdgeIndicator';
import { UnmappedListingsRow } from './UnmappedListingsRow';
import type { PublicListing } from '@/types/public-listing';

interface ResultsListProps {
  readonly mapped: readonly PublicListing[];
  readonly unmapped: readonly PublicListing[];
  /**
   * **Η ΕΣΤΙΑΣΗ ΟΛΟΚΛΗΡΗ** — «τι κοιτάζω» ΚΑΙ «τι διάλεξα», ποτέ συμπτυγμένα σε ένα.
   *
   * 🔴 Ήταν `highlightedId: string | null`, δηλαδή **μία** μεταβλητή για **δύο**
   * ερωτήσεις — και η λίστα δεν μπορούσε να ξεχωρίσει το ακούσιο πέρασμα του δείκτη
   * από τη σκόπιμη επιλογή. Δες `lib/listings/listing-focus.ts`.
   */
  readonly focus: ListingFocus;
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
  focus,
  onHover,
  filterQuery,
  undeclaredLabelsFor,
}: ResultsListProps) {
  const { t } = useTranslation(['search-results']);
  const isEmpty = mapped.length === 0 && unmapped.length === 0;

  const { scrollerRef, focusVisibility, revealFocused } = useListingRevealTracking(focus);

  /**
   * Η **εστιασμένη** αγγελία ως αντικείμενο — ή `null`.
   *
   * ⚠️ **Αναζήτηση στο `mapped`, όχι στο `visible`**: η εστίαση γεννιέται από τον χάρτη,
   * και ο χάρτης ζωγραφίζει **μόνο** ό,τι έχει σχήμα. Μια αγγελία χωρίς θέση δεν μπορεί
   * να είναι εστιασμένη — και αν κάποτε γίνει, το `undefined` εδώ σβήνει τον δείκτη
   * **σιωπηλά και σωστά**, αντί να ζωγραφίσει κενό πλαίσιο.
   */
  const focusedListing = useMemo(() => {
    const id = focusedListingId(focus);
    return id === null ? null : (mapped.find((listing) => listing.id === id) ?? null);
  }, [focus, mapped]);

  const edgeDirection = focusVisibility === 'above' || focusVisibility === 'below' ? focusVisibility : null;

  return (
    <section aria-label={t('search-results:list.label')} className="flex h-full flex-col">
      {/*
        🔑 **ΤΟ ΠΛΑΙΣΙΟ ΑΝΑΦΟΡΑΣ ΕΙΝΑΙ ΤΟ ΚΑΔΡΟ, ΟΧΙ ΤΟ ΠΕΡΙΕΧΟΜΕΝΟ** — γι' αυτό το
        `relative` ζει **έξω** από το δοχείο κύλισης. Ένα `absolute` παιδί **μέσα** στο
        δοχείο που κυλά **κυλά μαζί του**: ο δείκτης άκρης θα έφευγε από την άκρη με το
        πρώτο ξύσιμο του τροχού, δηλαδή θα εξαφανιζόταν **ακριβώς όταν χρειάζεται**.
      */}
      <div className="relative min-h-0 flex-1">
        {/*
          🏆 **Η ΤΡΙΤΗ ΕΠΙΛΟΓΗ** — δες `ListingEdgeIndicator`. Η λίστα **δεν κουνιέται**
          στο hover· λέει πού είναι αυτό που κοιτάς. Η κύλιση μένει **ρητή πράξη**.
        */}
        {focusedListing !== null && edgeDirection !== null && (
          <ListingEdgeIndicator
            listing={focusedListing}
            direction={edgeDirection}
            onActivate={revealFocused}
          />
        )}

        {/*
          `data-list-scroll`: το **φύλλο** (στενή οθόνη) κλείνει αυτή την κύλιση όσο δεν
          είναι πλήρες, ώστε η χειρονομία να **μεγαλώνει το φύλλο** αντί να διαβάζει
          αγγελίες μέσα σε χαραμάδα — NN/g: *«expands to take up the full page as the user
          scrolls down the list»* (SPEC-777D §26.2).

          🔑 Γνώρισμα, **όχι prop**: ο κανόνας «η λίστα κυλά μόνο όταν είμαι πλήρες» ανήκει
          στο φύλλο, όχι στη λίστα. Ένα prop θα υποχρέωνε **κάθε** καταναλωτή της λίστας —
          και τη στήλη του desktop, που δεν έχει στάσεις — να έχει γνώμη γι' αυτόν.
        */}
        <div ref={scrollerRef} data-list-scroll className="h-full overflow-y-auto">
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
                  focusStrength={listingFocusStrength(focus, listing.id)}
                  onHover={onHover}
                  filterQuery={filterQuery}
                  priority={index === 0}
                  undeclaredLabels={undeclaredLabelsFor(listing)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/*
        ⛔ ΣΤΟ ΤΕΛΟΣ ΤΗΣ ΛΙΣΤΑΣ, ΜΕΣΑ ΣΤΟ ΙΔΙΟ ΠΛΑΙΣΙΟ — ποτέ δεύτερη επιφάνεια
        (Α5 §4.2, κανόνας 21). Και ποτέ φιλτραρισμένη από την κίνηση του χάρτη.
      */}
      <UnmappedListingsRow listings={unmapped} filterQuery={filterQuery} />
    </section>
  );
}
