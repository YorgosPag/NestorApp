'use client';

/**
 * **ΕΝΑ ΣΥΝΟΛΟ ΧΑΡΑΚΤΗΡΙΣΤΙΚΩΝ — ΚΑΙ ΟΙ ΤΡΕΙΣ ΤΟΥ ΚΑΤΑΣΤΑΣΕΙΣ** (ADR-842 Φ3).
 *
 * @related ADR-842 §7 (Φ3) · lib/listings/listing-attribute-declared
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΟ ΣΗΜΕΙΟ ΟΠΟΥ Η ΣΕΛΙΔΑ ΞΕΠΕΡΝΑ ΚΑΘΕ PORTAL — ΚΑΙ ΕΙΝΑΙ ΜΙΑ ΓΡΑΜΜΗ ΔΙΑΦΟΡΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Σε Zillow · idealista · Spitogatos ένα ακίνητο που **δήλωσε** ότι δεν έχει καμία
 * παροχή και ένα ακίνητο που **δεν ρωτήθηκε ποτέ** καταλήγουν στην **ίδια σιωπή**: ο
 * κατάλογος παροχών απλώς δεν εμφανίζεται. Ο αναγνώστης δεν έχει τρόπο να τα
 * ξεχωρίσει — και η διαφορά είναι **εμπορική**, όχι φιλολογική: *«καμία παροχή»*
 * είναι πληροφορία τιμής, *«άγνωστο»* δεν είναι.
 *
 * Εδώ οι τρεις καταστάσεις έχουν **τρία διαφορετικά κείμενα**:
 *
 * | Κατάσταση | Τι ζωγραφίζεται |
 * |---|---|
 * | `declared` | οι ίδιες οι τιμές, ως ετικέτες |
 * | `declared-none` | *«Δηλώθηκε ότι δεν υπάρχουν»* — **γεγονός του κατόχου** |
 * | `never-asked` | *«Δεν έχει δηλωθεί»* — **δικό μας χρέος** |
 *
 * ⚠️ **Οι ετικέτες των τιμών ΔΕΝ γράφονται εδώ**: έρχονται από το `properties-enums`
 * μέσω του {@link vocabularyLabel}, που το ίδιο λεξιλόγιο τροφοδοτεί ήδη τη φόρμα της
 * εταιρείας **και** τον server resolver του PDF. Τρίτο αντίγραφο θα ήταν ADR-749.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  featureSetState,
  listingFeatureSetValues,
} from '@/lib/listings/listing-attribute-declared';
import type { ListingFeatureSetKey } from '@/lib/listings/listing-disclosure';
import type { PublicListing } from '@/types/public-listing';

import { FEATURE_SET_VOCABULARY, vocabularyLabel } from './listing-attribute-value';

interface ListingFeatureSetProps {
  readonly listing: PublicListing;
  readonly featureSetKey: ListingFeatureSetKey;
}

/** Μία γραμμή συνόλου: ετικέτα + τιμές, **ή** ετικέτα + ονομασμένη κατάσταση. */
export function ListingFeatureSet({ listing, featureSetKey }: ListingFeatureSetProps) {
  const { t } = useTranslation(['listing-detail', 'search-results', 'properties-enums']);
  const state = featureSetState(listing, featureSetKey);
  const values = listingFeatureSetValues(listing, featureSetKey) ?? [];

  return (
    <div className="flex flex-col gap-1 border-b border-border py-2 last:border-b-0">
      <dt className="text-sm text-muted-foreground">
        {t(`listing-detail:attributes.label.${featureSetKey}`)}
      </dt>
      <dd>
        {state === 'declared' ? (
          <ul className="flex flex-wrap gap-1">
            {values.map((value) => (
              <li
                key={value}
                className="rounded bg-secondary px-2 py-0.5 text-sm text-secondary-foreground"
              >
                {vocabularyLabel(t, FEATURE_SET_VOCABULARY[featureSetKey], value)}
              </li>
            ))}
          </ul>
        ) : (
          /*
            🔴 **ΔΥΟ ΔΙΑΦΟΡΕΤΙΚΑ ΚΕΙΜΕΝΑ, ΟΧΙ ΕΝΑ.** Το `declared-none` είναι
            **απάντηση ανθρώπου** και ζωγραφίζεται ως κανονικό περιεχόμενο· το
            `never-asked` είναι **κενό** και ζωγραφίζεται πλάγια, όπως κάθε άλλη
            ονομασμένη απουσία της οθόνης 3.
          */
          <span
            className={
              state === 'declared-none'
                ? 'text-sm font-medium text-foreground'
                : 'text-sm italic text-muted-foreground'
            }
          >
            {state === 'declared-none'
              ? t('listing-detail:attributes.declaredNone')
              : t('listing-detail:attributes.undeclared')}
          </span>
        )}
      </dd>
    </div>
  );
}
