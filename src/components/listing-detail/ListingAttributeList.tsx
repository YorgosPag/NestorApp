'use client';

/**
 * **Τα στοιχεία του ακινήτου — και η ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ τους.**
 *
 * @related ADR-777 §7 (Α5 κανόνας 27 · Α7) · SPEC-777-RESEARCH §25.6 ·
 *          **ADR-842 §7 (Φ3)** · lib/listings/listing-disclosure
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΟ ΣΗΜΕΙΟ ΟΠΟΥ Η ΣΕΛΙΔΑ ΞΕΠΕΡΝΑ ΚΑΘΕ PORTAL — ΚΑΙ ΕΙΝΑΙ ΜΙΑ ΓΡΑΜΜΗ ΔΙΑΦΟΡΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Σε Zillow · idealista · Spitogatos ένα στοιχείο που δεν καταχωρήθηκε **απλώς δεν
 * εμφανίζεται**. Ο αναγνώστης βλέπει τρεις γραμμές και **δεν έχει τρόπο να ξέρει** αν
 * έλειπε μία ή δέκα — δηλαδή η οθόνη είναι **δομικά ανίκανη** να ξεχωρίσει το «δεν
 * έχει όροφο» από το «κανείς δεν καταχώρησε όροφο».
 *
 * Εδώ **κάθε** στοιχείο του κλειστού καταλόγου υπάρχει: με τιμή, ή με το ρητό «δεν
 * έχει δηλωθεί». Και από πάνω τυπώνεται η λογιστική — **πάντα**, ακόμη και στο «27
 * από 27», με τον ίδιο κανόνα που η μπάρα της οθόνης 2 τυπώνει το μηδέν.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η Φ3 ΤΡΙΠΛΑΣΙΑΣΕ ΤΑ ΣΤΟΙΧΕΙΑ — ΚΑΙ ΑΥΤΟ ΑΛΛΑΞΕ ΤΗ ΣΩΣΤΗ ΔΙΑΤΑΞΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Με **4** στοιχεία, η επίπεδη λίστα ήταν η σωστή απάντηση. Με **27** (ADR-842 Φ3) ο
 * **ίδιος** κανόνας παράγει ~21 συνεχόμενα «δεν έχει δηλωθεί»: θάβει τα γεγονότα και
 * διαβάζεται ως κατηγορητήριο. Η θεραπεία ζει στο {@link ListingAttributeGroupSection}
 * — **ομάδες, καθεμιά με το δικό της κλειστό ισοζύγιο**, και τα κενά πίσω από **μία**
 * ενέργεια που τα **μετρά**. Δες εκεί τη σύγκριση και τη σύσταση των **δύο** επιπέδων.
 *
 * ⚠️ **Ο κατάλογος ΔΕΝ γράφεται εδώ, ούτε οι ομάδες**: έρχονται από το
 * `LISTING_ATTRIBUTE_GROUPS` και το `listingGroupMembers`, που **παράγονται** από τον
 * πίνακα αποκάλυψης. Μια χειρόγραφη λίστα σε αυτό το αρχείο θα μπορούσε να **ξεχάσει**
 * ένα πεδίο — και θα το ξεχνούσε **σιωπηλά**, ενώ η λογιστική από πάνω θα συνέχιζε να
 * κλείνει (το ακριβές σχήμα που πλήρωσε το `listing-disclosure.ts`: *«δύο ελλιπείς
 * λίστες που συμφωνούν μεταξύ τους»*).
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { listingAttributeLedger } from '@/lib/listings/listing-attribute-declared';
import { LISTING_ATTRIBUTE_GROUPS } from '@/lib/listings/listing-attribute-groups';
import type { PublicListing } from '@/types/public-listing';

import { ListingAttributeGroupSection } from './ListingAttributeGroup';

interface ListingAttributeListProps {
  readonly listing: PublicListing;
}

export function ListingAttributeList({ listing }: ListingAttributeListProps) {
  const { t } = useTranslation(['listing-detail', 'search-results', 'properties-enums']);
  const ledger = listingAttributeLedger(listing);

  return (
    <section
      aria-labelledby="listing-attributes-heading"
      className="rounded-lg border border-border bg-card p-4"
    >
      <h2 id="listing-attributes-heading" className="text-sm font-medium text-muted-foreground">
        {t('listing-detail:attributes.heading')}
      </h2>

      {/* Η λογιστική **πάντα** — και όταν είναι πλήρης. Ένα «27 από 27» που δεν
          τυπώνεται αφήνει τον αναγνώστη να μαντέψει αν κοίταξε κανείς. */}
      <p className="mt-1 text-xs text-muted-foreground">
        {t('listing-detail:attributes.ledger', {
          declared: ledger.declared,
          total: ledger.total,
        })}
      </p>

      <div className="mt-2 flex flex-col gap-3">
        {LISTING_ATTRIBUTE_GROUPS.map((group) => (
          <ListingAttributeGroupSection key={group} listing={listing} group={group} />
        ))}
      </div>
    </section>
  );
}
