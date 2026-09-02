'use client';

/**
 * **ΜΙΑ ΟΜΑΔΑ ΣΤΟΙΧΕΙΩΝ — ΜΕ ΤΟ ΔΙΚΟ ΤΗΣ ΚΛΕΙΣΤΟ ΙΣΟΖΥΓΙΟ** (ADR-842 Φ3).
 *
 * @related ADR-842 §7 (Φ3 · §8 #4) · lib/listings/listing-attribute-groups
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΠΡΟΒΛΗΜΑ: Ο ΙΔΙΟΣ ΚΑΝΟΝΑΣ, ΣΕ 27 ΠΕΔΙΑ, ΓΙΝΕΤΑΙ ΤΟ ΑΝΤΙΘΕΤΟ ΤΟΥ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κανόνας της οθόνης 3 — *«κάθε στοιχείο φαίνεται, με τιμή ή με **ονομασμένη
 * απουσία**»* — είναι ό,τι ξεπερνά κάθε portal. Εφαρμοσμένος ωμά στα 27 πεδία της Φ3
 * όμως, παράγει ~21 συνεχόμενες γραμμές «Δεν έχει δηλωθεί»: **θάβει** τα πραγματικά
 * γεγονότα και διαβάζεται ως **κατηγορητήριο κατά του κατόχου**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 Η ΛΥΣΗ — ΚΑΙ ΓΙΑΤΙ ΕΙΝΑΙ ΑΥΣΤΗΡΟΤΕΡΗ ΚΑΙ ΑΠΟ ΤΑ ΔΥΟ ΑΚΡΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Το ισοζύγιο ταξιδεύει ΜΑΖΙ με την ομάδα.** Η κεφαλίδα τυπώνει **πάντα** *«2 από
 * 3»* — ακόμη και στο «3 από 3», με τον ίδιο κανόνα που η μπάρα της οθόνης 2 τυπώνει
 * το μηδέν. Τα δηλωμένα φαίνονται. Τα κενά ζουν πίσω από **μία** ενέργεια που τα
 * **μετρά** στην ετικέτα της.
 *
 * | | Zillow / idealista | Επίπεδη λίστα 27 γραμμών | **Εδώ** |
 * |---|---|---|---|
 * | Ξέρω **πόσα** λείπουν; | ❌ ποτέ | ✅ | ✅ **πάντα ορατό** |
 * | Ξέρω **ποια** λείπουν; | ❌ ποτέ | ✅ | ✅ με **ένα** κλικ |
 * | Διαβάζονται τα γεγονότα; | ✅ | ❌ θάβονται | ✅ |
 *
 * 📐 **ΑΚΡΙΒΩΣ ΔΥΟ ΕΠΙΠΕΔΑ ΑΠΟΚΑΛΥΨΗΣ, ΠΟΤΕ ΤΡΙΑ** — ρητή σύσταση Nielsen Norman
 * Group: *«designs that go beyond 2 disclosure levels typically have low usability»*.
 * Και η δεύτερη σύστασή τους — *«the progression must have strong information scent»* —
 * είναι ο λόγος που το κουμπί **δεν** λέει «Περισσότερα» αλλά **πόσα** και **τι
 * κατάστασης** είναι.
 *
 * 🔑 Το ίδιο ιδίωμα έχουν τα εργαλεία που τέθηκαν ως πήχης: η παλέτα ιδιοτήτων του
 * **Revit** ομαδοποιεί σε *Constraints · Dimensions · Identity Data* με πτυσσόμενες
 * κεφαλίδες και **δεν εξαφανίζει ποτέ** τη γραμμή μιας κενής παραμέτρου· ο Attribute
 * Manager του **Cinema 4D** χωρίζει σε καρτέλες ανά ομάδα.
 *
 * ⚠️ **Η κατάσταση είναι ΑΝΑ ΟΜΑΔΑ, όχι καθολική**: ένας επισκέπτης που άνοιξε τα κενά
 * της ενέργειας δεν ζήτησε να δει τα κενά των εμβαδών. Καθολικός διακόπτης θα ήταν
 * τρίτο επίπεδο μεταμφιεσμένο σε πρώτο.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  featureSetState,
  isAttributeDeclared,
} from '@/lib/listings/listing-attribute-declared';
import {
  listingGroupLedger,
  listingGroupMembers,
  type ListingAttributeGroup as AttributeGroup,
} from '@/lib/listings/listing-attribute-groups';
import type { PublicListing } from '@/types/public-listing';

import { ListingAttributeRow } from './ListingAttributeRow';
import { ListingFeatureSet } from './ListingFeatureSet';

interface ListingAttributeGroupProps {
  readonly listing: PublicListing;
  readonly group: AttributeGroup;
}

export function ListingAttributeGroupSection({
  listing,
  group,
}: ListingAttributeGroupProps) {
  const { t } = useTranslation(['listing-detail', 'search-results', 'properties-enums']);
  const [revealed, setRevealed] = React.useState(false);

  const members = listingGroupMembers(group);
  const ledger = listingGroupLedger(listing, group);

  const declaredAttributes = members.attributes.filter((key) =>
    isAttributeDeclared(listing, key)
  );
  const undeclaredAttributes = members.attributes.filter(
    (key) => !isAttributeDeclared(listing, key)
  );
  const declaredSets = members.featureSets.filter(
    (key) => featureSetState(listing, key) !== 'never-asked'
  );
  const undeclaredSets = members.featureSets.filter(
    (key) => featureSetState(listing, key) === 'never-asked'
  );

  const headingId = `listing-attributes-${group}`;
  const gapsId = `listing-attributes-${group}-gaps`;

  return (
    <section aria-labelledby={headingId} className="mt-3 first:mt-0">
      <header className="flex items-baseline justify-between gap-2">
        <h3 id={headingId} className="text-sm font-medium text-foreground">
          {t(`listing-detail:attributes.group.${group}`)}
        </h3>
        {/*
          Το ισοζύγιο **πάντα**, ακόμη και στο «3 από 3». Ένα πλήρες σύνολο που δεν
          τυπώνει τον παρονομαστή του αφήνει τον αναγνώστη να μαντέψει αν κοίταξε κανείς.
        */}
        <p className="shrink-0 text-xs text-muted-foreground">
          {t('listing-detail:attributes.groupLedger', {
            declared: ledger.declared,
            total: ledger.total,
          })}
        </p>
      </header>

      {ledger.declared === 0 ? (
        <p className="mt-1 text-xs italic text-muted-foreground">
          {t('listing-detail:attributes.groupEmpty')}
        </p>
      ) : (
        <dl className="mt-1">
          {declaredAttributes.map((key) => (
            <ListingAttributeRow key={key} listing={listing} attributeKey={key} />
          ))}
          {declaredSets.map((key) => (
            <ListingFeatureSet key={key} listing={listing} featureSetKey={key} />
          ))}
        </dl>
      )}

      {ledger.undeclared > 0 && (
        <>
          <button
            type="button"
            aria-expanded={revealed}
            aria-controls={gapsId}
            onClick={() => setRevealed((open) => !open)}
            className="mt-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {revealed
              ? t('listing-detail:attributes.hide')
              : t('listing-detail:attributes.reveal', { count: ledger.undeclared })}
          </button>

          {/*
            ⚠️ **`hidden` και ΟΧΙ αφαίρεση από το DOM.** Το περιεχόμενο υπάρχει πάντα:
            το `aria-controls` δείχνει σε **υπαρκτό** στοιχείο, η εύρεση στη σελίδα
            (Ctrl+F του browser σε υποστηρικτικές μηχανές, και κάθε crawler) το βρίσκει,
            και η υπόσχεση «τίποτα δεν κρύβεται» παραμένει **αληθής στο ίδιο το έγγραφο**,
            όχι μόνο στην αφήγηση.
          */}
          <dl id={gapsId} hidden={!revealed} className="mt-1">
            {undeclaredAttributes.map((key) => (
              <ListingAttributeRow key={key} listing={listing} attributeKey={key} />
            ))}
            {undeclaredSets.map((key) => (
              <ListingFeatureSet key={key} listing={listing} featureSetKey={key} />
            ))}
          </dl>
        </>
      )}
    </section>
  );
}
