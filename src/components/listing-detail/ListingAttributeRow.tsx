'use client';

/**
 * **ΜΙΑ ΓΡΑΜΜΗ ΙΔΙΟΤΗΤΑΣ** — ετικέτα + τιμή, **ή** ετικέτα + ονομασμένη απουσία.
 *
 * @related ADR-842 §7 (Φ3) · ADR-777 §7 (Α5 κανόνας 27 · Α7)
 *
 * 🔑 **ΕΞΑΓΩΓΗ ΑΠΟ ΤΟ `ListingAttributeList.tsx`, ΟΧΙ ΝΕΑ ΓΡΑΦΗ** (ADR-842 Φ3): η
 * γραμμή χρειάζεται πλέον **δύο** καλούντες μέσα στην ίδια ομάδα — τα δηλωμένα και
 * τα κενά, που ζουν σε ξεχωριστές λίστες επειδή ακριβώς τα δεύτερα είναι πίσω από
 * αποκάλυψη. Αντιγραμμένη, θα ήταν δίδυμος κλώνος στο ίδιο commit (N.18).
 *
 * ⚠️ **Η απουσία ζωγραφίζεται ΠΛΑΓΙΑ και όχι με χρώμα-κατάσταση**: δεν είναι
 * σφάλμα ούτε προειδοποίηση — είναι **κενό γνώσης**, και η οθόνη 3 το λέει χωρίς να
 * το χρωματίσει ως πρόβλημα του κατόχου.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { isAttributeDeclared } from '@/lib/listings/listing-attribute-declared';
import type { ListingAttributeKey } from '@/lib/listings/listing-disclosure';
import type { PublicListing } from '@/types/public-listing';

import { attributeValue } from './listing-attribute-value';

interface ListingAttributeRowProps {
  readonly listing: PublicListing;
  readonly attributeKey: ListingAttributeKey;
}

export function ListingAttributeRow({ listing, attributeKey }: ListingAttributeRowProps) {
  const { t } = useTranslation(['listing-detail', 'search-results', 'properties-enums']);
  const declared = isAttributeDeclared(listing, attributeKey);

  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2 last:border-b-0">
      <dt className="text-sm text-muted-foreground">
        {t(`listing-detail:attributes.label.${attributeKey}`)}
      </dt>
      <dd
        className={
          declared
            ? 'text-sm font-medium text-foreground'
            : 'text-sm italic text-muted-foreground'
        }
      >
        {declared
          ? attributeValue(t, listing, attributeKey)
          : t('listing-detail:attributes.undeclared')}
      </dd>
    </div>
  );
}
