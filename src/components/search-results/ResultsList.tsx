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
import { focusedListingId, type ListingFocus } from '@/lib/listings/listing-focus';
import { publicListingEntry } from '@/lib/listings/listing-map-entry';
import { flattenListingSections, type ListingSections } from '@/lib/listings/listing-price-sections';
import { ResultsListSection } from './ResultsListSection';
import { ListingEdgeIndicator } from './ListingEdgeIndicator';
import { UnmappedListingsRow } from './UnmappedListingsRow';
import type { PublicListing } from '@/types/public-listing';

interface ResultsListProps {
  /**
   * **Η λίστα ως ΑΚΟΛΟΥΘΙΑ ΚΛΑΣΕΩΝ**, όχι ως επίπεδος πίνακας (ADR-777 §8.60.14).
   *
   * 🔴 Ποσά διαφορετικού ρόλου είναι **ασύγκριτα**: «50 €/νύχτα», «900 €/μήνα» και
   * «170.000 €» δεν μπαίνουν σε έναν άξονα. Ο τύπος της εισόδου **δεν εκφράζει** ενιαία
   * κατάταξη, άρα η λίστα δεν μπορεί να την υποθέσει — με **μία** κλάση ο τύπος
   * εκφυλίζεται σε ένα τμήμα χωρίς επιγραφή και η οθόνη μένει **ακριβώς** η σημερινή.
   */
  readonly sections: ListingSections;
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
  sections,
  unmapped,
  focus,
  onHover,
  filterQuery,
  undeclaredLabelsFor,
}: ResultsListProps) {
  const { t } = useTranslation(['search-results']);

  /**
   * Οι τοποθετημένες αγγελίες ως **ένας** πίνακας — για την **εστίαση** και για το
   * «άδειο». 🔑 Ούτε η μία ούτε η άλλη ερώτηση αφορά τη μονάδα του ποσού, άρα εδώ η
   * ισοπέδωση δεν λέει τίποτα για τη σειρά *(δες `flattenListingSections`)*.
   */
  const mapped = useMemo(() => flattenListingSections(sections), [sections]);
  const isEmpty = mapped.length === 0 && unmapped.length === 0;

  /**
   * 🔑 **ΜΟΝΟ Η ΠΡΩΤΗ ΚΑΡΤΑ ΟΛΗΣ ΤΗΣ ΛΙΣΤΑΣ ΕΙΝΑΙ «ΥΨΗΛΗΣ»** (ADR-841 §7 Α2.4) — κατά
   * **ταυτότητα**, όχι κατά δείκτη μέσα στο τμήμα: με τρία τμήματα, ένα `index === 0`
   * ανά τμήμα θα έδινε **τρεις** εικόνες υψηλής προτεραιότητας, που **ακυρώνουν η μία
   * την άλλη** — ακριβώς το ελάττωμα που ο κανόνας υπάρχει για να αποκλείσει.
   */
  const priorityId = mapped[0]?.id ?? null;

  const { containerRef, focusVisibility, revealFocused } = useListingRevealTracking(focus);

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
            entry={publicListingEntry(focusedListing)}
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
        <div ref={containerRef} data-list-scroll className="h-full overflow-y-auto">
          {isEmpty ? (
            <p className="p-4 text-sm text-muted-foreground">{t('search-results:list.empty')}</p>
          ) : (
            sections.map((section) => (
              <ResultsListSection
                key={section.heading ?? 'all'}
                section={section}
                focus={focus}
                onHover={onHover}
                filterQuery={filterQuery}
                priorityId={priorityId}
                undeclaredLabelsFor={undeclaredLabelsFor}
              />
            ))
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
