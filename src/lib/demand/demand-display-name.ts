/**
 * @fileoverview **ΤΟ ΟΝΟΜΑ ΜΙΑΣ ΖΗΤΗΣΗΣ** — το δικό του, αλλιώς το αυτόματο. Ένας παραγωγός.
 * @related ADR-886 · lib/demand/demand-terms.ts · lib/demand/demand-title.ts · types/property-demand.ts
 * @module lib/demand/demand-display-name
 *
 * 🏆 **ΤΙ ΚΑΝΟΥΝ ΟΙ ΜΕΓΑΛΟΙ, ΚΑΙ ΠΟΥ ΤΟΥΣ ΞΕΠΕΡΝΑΜΕ** (έρευνα 2026-09-25):
 * · **Zillow / Redfin**: ζητούν όνομα κατά την αποθήκευση και δείχνουν στη λίστα «τοποθεσία + βασικά
 *   φίλτρα». Το προτεινόμενο όνομα όμως **γράφεται** στο πεδίο ⇒ όταν αλλάξουν τα φίλτρα, το όνομα
 *   λέει ακόμη το παλιό.
 * · **Idealista**: δεν ρωτά καν όνομα στην αποθήκευση — γυρνάς μετά να το αλλάξεις.
 * ⇒ Εδώ το **αυτόματο όνομα ΔΕΝ αποθηκεύεται ποτέ**: παράγεται σε κάθε ανάγνωση από τα κριτήρια, άρα
 * **δεν μπορεί να παλιώσει**. Αποθηκεύεται **μόνο** ό,τι έγραψε ο ίδιος ο άνθρωπος (`title`).
 *
 * 🔑 **Καθαρό, χωρίς React** — με τον στενό `PriceLabelT` ⇒ το ίδιο όνομα θα το πει αύριο και το email
 * της ειδοποίησης ταιριάσματος, χωρίς δεύτερη διατύπωση.
 *
 * ⚠️ **Όνομα, όχι περίληψη.** Η πλήρης εικόνα είναι δουλειά του `DemandSummary`· εδώ μπαίνουν μόνο όσα
 * **ξεχωρίζουν** μια ζήτηση από τις άλλες του ίδιου ανθρώπου: συναλλαγή, τόπος, είδος, υπνοδωμάτια, ταβάνι.
 * Ο χρόνος και η γειτονιά μένουν έξω — σπάνια διαφέρουν ανάμεσα σε δύο ζητήσεις ενός ανθρώπου.
 */

import { OFFER_KINDS } from '@/types/property-offers';
import type { PriceLabelT } from '@/lib/listings/listing-price-label';
import {
  boundedPricedSeeks,
  matchDemandPlace,
  seekKindsOf,
  type DemandPlace,
  type PropertyDemand,
} from '@/types/property-demand';
import { demandSeekRangePhrase, demandTypeName } from './demand-terms';
import { normalizeDemandLabel } from './demand-title';
import { SEEK_KIND_I18N_KEYS } from './seek-kind-labels';

const K = 'property-market:demand.name';

/** Ό,τι χρειάζεται το αυτόματο όνομα — **υποσύνολο**, ώστε να το υπολογίζει και η φόρμα πριν την αποθήκευση. */
export type DemandNameCriteria = Pick<PropertyDemand, 'seeks' | 'place' | 'features' | 'placeLabel'>;

/**
 * Το **σύντομο** όνομα τόπου: το πρώτο κομμάτι της ετικέτας του geocoder («Κορδελιό, Θεσσαλονίκη
 * 563 34» → «Κορδελιό»). Όνομα, όχι διεύθυνση — η πλήρης ετικέτα μένει στο πεδίο της φόρμας.
 */
function shortPlaceLabel(label: string | null): string | null {
  const first = label?.split(',')[0] ?? null;
  return normalizeDemandLabel(first);
}

/** Ο τόπος ως **όνομα**· `null` για «οπουδήποτε» — δεν ξεχωρίζει τίποτα. */
function placeSegment(t: PriceLabelT, place: DemandPlace, placeLabel: string | null): string | null {
  return matchDemandPlace<string | null>(place, {
    anywhere: () => null,
    near: ({ radiusKm }) => shortPlaceLabel(placeLabel) ?? t(`${K}.near`, { radiusKm }),
    area: () => t(`${K}.area`),
    place: () => t(`${K}.place`),
    frontage: ({ streetName }) => (streetName === null ? t(`${K}.frontage`) : t(`${K}.frontageNamed`, { street: streetName })),
  });
}

/** Τα είδη συναλλαγής, με τη **σταθερή** σειρά του λεξιλογίου — ίδια κριτήρια, ίδιο όνομα. */
function seeksSegment(t: PriceLabelT, criteria: DemandNameCriteria): string {
  const kinds = new Set(seekKindsOf(criteria.seeks));
  return OFFER_KINDS.filter((kind) => kinds.has(kind))
    .map((kind) => t(SEEK_KIND_I18N_KEYS[kind]))
    .join(' / ');
}

/** Το είδος ακινήτου: ένα ⇒ το όνομά του· πολλά ⇒ «Διαμέρισμα +2»· κανένα ⇒ τίποτα. */
function typesSegment(t: PriceLabelT, types: readonly string[]): string | null {
  if (types.length === 0) return null;
  const first = demandTypeName(t, types[0]);
  return types.length === 1 ? first : t(`${K}.typesMore`, { first, count: types.length - 1 });
}

/** Το ταβάνι της **πρώτης** οριοθετημένης συναλλαγής (σειρά λεξιλογίου). Οι υπόλοιπες ζουν στην περίληψη. */
function priceSegment(t: PriceLabelT, criteria: DemandNameCriteria): string | null {
  const bounded = boundedPricedSeeks(criteria.seeks);
  const first = OFFER_KINDS.map((kind) => bounded.find((seek) => seek.kind === kind)).find(
    (seek) => seek !== undefined,
  );
  return first === undefined ? null : demandSeekRangePhrase(t, first);
}

/**
 * **Το αυτόματο όνομα** — «Αγορά / Ενοικίαση · Κορδελιό · Διαμέρισμα · 2+ υπν. · έως 200.000 €».
 * Ό,τι δεν δηλώθηκε **δεν λέγεται** (κανένα «Κάθε είδος» μέσα σε όνομα).
 */
export function demandAutoName(criteria: DemandNameCriteria, t: PriceLabelT): string {
  const { bedroomsMin } = criteria.features;
  const segments = [
    seeksSegment(t, criteria),
    placeSegment(t, criteria.place, criteria.placeLabel),
    typesSegment(t, criteria.features.types),
    // `0` = «δεκτό και studio», δηλαδή κανένας περιορισμός — δεν αξίζει θέση σε όνομα.
    bedroomsMin !== null && bedroomsMin > 0 ? t(`${K}.bedroomsMin`, { count: bedroomsMin }) : null,
    priceSegment(t, criteria),
  ];
  return segments.filter((segment): segment is string => segment !== null && segment !== '').join(' · ');
}

/** **Το όνομα που δείχνεται**: ό,τι έγραψε ο άνθρωπος, αλλιώς το αυτόματο. */
export function demandDisplayName(
  demand: DemandNameCriteria & Pick<PropertyDemand, 'title'>,
  t: PriceLabelT,
): string {
  return normalizeDemandLabel(demand.title) ?? demandAutoName(demand, t);
}
