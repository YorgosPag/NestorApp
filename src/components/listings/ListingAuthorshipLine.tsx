'use client';

/**
 * **Η ΓΡΑΜΜΗ ΤΗΣ ΠΡΟΕΛΕΥΣΗΣ** — *«με ποιον μιλάω;»*, ζωγραφισμένο σε **ένα** σημείο για
 * **δύο** οθόνες (ADR-841 Α13.2).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΓΙΑΤΙ ΖΕΙ ΣΕ ΟΥΔΕΤΕΡΟ ΦΑΚΕΛΟ ΚΑΙ ΟΧΙ ΔΙΠΛΑ ΣΕ ΕΝΑΝ ΑΠΟ ΤΟΥΣ ΔΥΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι καταναλωτές είναι η **κάρτα** (`components/search-results/`) και η **σελίδα**
 * (`components/listing-detail/`). Σε οποιονδήποτε από τους δύο φακέλους, ο άλλος θα
 * εισήγαγε **από την οθόνη του γείτονα** — δηλαδή η μία οθόνη θα φαινόταν να **κατέχει**
 * το λεξιλόγιο της άλλης, και η επόμενη αλλαγή εκεί θα διαβαζόταν ως τοπική ενώ δεν θα
 * ήταν.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΑ ΚΛΕΙΔΙΑ ΕΙΝΑΙ ΚΥΡΙΟΛΕΚΤΙΚΑ, ΚΑΙ ΕΙΝΑΙ ΑΠΑΙΤΗΣΗ ΟΧΙ ΥΦΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο γεννήτορας του **CHECK 3.34** *(`generate-i18n-shell-slice.js`)* **σταματά** σε
 * `t(<μεταβλητή>)` — ακόμη και με **μία** δυνατή τιμή — και μπλοκάρει το commit μέχρι να
 * μπει εγγραφή στο `dynamicKeyPolicy`. Ο τριαδικός με literals **δεν χρειάζεται καμία**
 * εγγραφή: η ερώτηση *«ποια κλειδιά ζωγραφίζει αυτό το αρχείο;»* απαντιέται **διαβάζοντάς
 * το**. Γι' αυτό ο {@link LISTING_AUTHORSHIP_KEYS} **δεν** διαβάζεται εδώ — είναι η
 * δεύτερη φωνή που ελέγχει αυτήν.
 *
 * ⛔ **Η ΤΥΠΟΓΡΑΦΙΑ ΑΝΗΚΕΙ ΣΤΟΝ ΚΑΛΟΥΝΤΑ, ΕΠΙΤΗΔΕΣ.** Η ίδια πρόταση είναι **υποσημείωση**
 * σε μια κάρτα περίληψης και **δήλωση** στη σελίδα της απόφασης· ένα `variant="card"`
 * εδώ θα ξανάφερνε μέσα στο κοινό αρχείο ακριβώς το λεξιλόγιο που η **Α13.1** έβγαλε από
 * τα κλειδιά.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { listingAuthorshipVoice } from '@/lib/listings/listing-authorship';
import type { PublicListing } from '@/types/public-listing';

interface ListingAuthorshipLineProps {
  /** Μόνο τα **δύο** πεδία που απαντούν την ερώτηση — δες `listingAuthorshipVoice`. */
  readonly listing: Pick<PublicListing, 'authorship' | 'agencyName'>;
  /**
   * Η τυπογραφία της **οθόνης που καλεί**. Υποχρεωτικό: μια σιωπηρή προεπιλογή θα
   * σήμαινε ότι το κοινό αρχείο έχει άποψη για το πού μπαίνει η γραμμή, και **δεν έχει**.
   */
  readonly className: string;
}

export function ListingAuthorshipLine({ listing, className }: ListingAuthorshipLineProps) {
  const { t } = useTranslation(['search-results']);
  const voice = listingAuthorshipVoice(listing);

  return (
    <p className={className}>
      {voice === 'owner-declared'
        ? t('search-results:listing.authorship.ownerDeclared')
        : voice === 'agency-anonymous'
          ? t('search-results:listing.authorship.agencyAnonymous')
          : t('search-results:listing.authorship.agency', { name: listing.agencyName })}
    </p>
  );
}
