'use client';

/**
 * **Τα στοιχεία του ακινήτου — και η ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ τους.**
 *
 * @related ADR-777 §7 (Α5 κανόνας 27 · Α7) · SPEC-777-RESEARCH §25.6 · lib/listings/listing-disclosure
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΟ ΣΗΜΕΙΟ ΟΠΟΥ Η ΣΕΛΙΔΑ ΞΕΠΕΡΝΑ ΚΑΘΕ PORTAL — ΚΑΙ ΕΙΝΑΙ ΜΙΑ ΓΡΑΜΜΗ ΔΙΑΦΟΡΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Σε Zillow · Idealista · Spitogatos ένα στοιχείο που δεν καταχωρήθηκε **απλώς δεν
 * εμφανίζεται**. Ο αναγνώστης βλέπει τρεις γραμμές και **δεν έχει τρόπο να ξέρει** αν
 * έλειπε μία ή δέκα — δηλαδή η οθόνη είναι **δομικά ανίκανη** να ξεχωρίσει το «δεν
 * έχει όροφο» από το «κανείς δεν καταχώρησε όροφο».
 *
 * Εδώ **κάθε** στοιχείο του κλειστού καταλόγου εμφανίζεται: με τιμή, ή με το ρητό
 * «δεν έχει δηλωθεί». Και από πάνω τυπώνεται η λογιστική — **πάντα**, ακόμη και στο
 * «4 από 4», με τον ίδιο κανόνα που η μπάρα της οθόνης 2 τυπώνει το μηδέν.
 *
 * ⚠️ **Ο κατάλογος ΔΕΝ γράφεται εδώ**: έρχεται από το `LISTING_ATTRIBUTE_KEYS`, που
 * παράγεται από τον πίνακα αποκάλυψης. Μια χειρόγραφη λίστα σε αυτό το αρχείο θα
 * μπορούσε να **ξεχάσει** ένα πεδίο — και θα το ξεχνούσε **σιωπηλά**, ενώ η λογιστική
 * από πάνω θα συνέχιζε να κλείνει.
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  LISTING_ATTRIBUTE_KEYS,
  isAttributeDeclared,
  listingAttributeLedger,
  type ListingAttributeKey,
} from '@/lib/listings/listing-disclosure';
import { PROPERTY_TYPE_I18N_KEYS } from '@/constants/property-types';
// 🔴 **§8.33: ο δείκτης έδειχνε σε ΑΝΥΠΑΡΚΤΗ εξαγωγή.** Η διάσπαση του §8.32
// (`property-types.ts` = μοντέλο ⇄ `property-type-aliases.ts` = **αναγνώριση**)
// μετακίνησε τον `normalizePropertyType`, και αυτή η εισαγωγή έμεινε πίσω. Δεν ήταν
// σφάλμα χρόνου εκτέλεσης: το module **δεν μεταγλωττιζόταν**, οπότε ολόκληρη η
// **δημόσια** σελίδα `/listing/[id]` απαντούσε **500** — επαληθευμένο ζωντανά.
import { normalizePropertyType } from '@/constants/property-type-aliases';
import type { PublicListing } from '@/types/public-listing';

interface ListingAttributeListProps {
  readonly listing: PublicListing;
}

/**
 * Η **τιμή** ενός δηλωμένου στοιχείου, ως κείμενο οθόνης.
 *
 * ⚠️ Καλείται **μόνο** για κλειδιά που το `isAttributeDeclared` έκρινε δηλωμένα —
 * γι' αυτό τα `!` δεν υπάρχουν εδώ: το `?? ''` θα ήταν σιωπηλή κάλυψη ενός
 * ασυμφωνίας που πρέπει να είναι **αδύνατη**, όχι κρυμμένη.
 */
function useAttributeValue(listing: PublicListing, key: ListingAttributeKey): string {
  const { t } = useTranslation(['search-results', 'properties-enums']);

  switch (key) {
    case 'type': {
      const canonical = normalizePropertyType(listing.type);
      return canonical === null ? '' : t(`properties-enums:${PROPERTY_TYPE_I18N_KEYS[canonical]}`);
    }
    case 'areaSqm':
      return t('search-results:card.areaSqm', { value: listing.areaSqm });
    case 'floor':
      // `0` είναι **ισόγειο**, όχι «μηδέν όροφος» — ίδια διάκριση με την κάρτα.
      return listing.floor === 0
        ? t('search-results:card.groundFloor')
        : t('search-results:card.floor', { value: listing.floor });
    case 'bedrooms':
      return t('search-results:card.bedrooms', { count: listing.bedrooms });
  }
}

/** Μία γραμμή: ετικέτα + τιμή, **ή** ετικέτα + ονομασμένη απουσία. */
function AttributeRow({
  listing,
  attributeKey,
}: {
  readonly listing: PublicListing;
  readonly attributeKey: ListingAttributeKey;
}) {
  const { t } = useTranslation(['search-results']);
  const declared = isAttributeDeclared(listing, attributeKey);
  const value = useAttributeValue(listing, attributeKey);

  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2 last:border-b-0">
      <dt className="text-sm text-muted-foreground">
        {t(`search-results:detail.attributes.label.${attributeKey}`)}
      </dt>
      <dd className={declared ? 'text-sm font-medium text-foreground' : 'text-sm italic text-muted-foreground'}>
        {declared ? value : t('search-results:detail.attributes.undeclared')}
      </dd>
    </div>
  );
}

export function ListingAttributeList({ listing }: ListingAttributeListProps) {
  const { t } = useTranslation(['search-results']);
  const ledger = listingAttributeLedger(listing);

  return (
    <section
      aria-labelledby="listing-attributes-heading"
      className="rounded-lg border border-border bg-card p-4"
    >
      <h2 id="listing-attributes-heading" className="text-sm font-medium text-muted-foreground">
        {t('search-results:detail.attributes.heading')}
      </h2>

      {/* Η λογιστική **πάντα** — και όταν είναι πλήρης. Ένα «4 από 4» που δεν
          τυπώνεται αφήνει τον αναγνώστη να μαντέψει αν κοίταξε κανείς. */}
      <p className="mt-1 text-xs text-muted-foreground">
        {t('search-results:detail.attributes.ledger', {
          declared: ledger.declared,
          total: ledger.total,
        })}
      </p>

      <dl className="mt-2">
        {LISTING_ATTRIBUTE_KEYS.map((key) => (
          <AttributeRow key={key} listing={listing} attributeKey={key} />
        ))}
      </dl>
    </section>
  );
}
