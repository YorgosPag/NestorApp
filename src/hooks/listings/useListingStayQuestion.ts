'use client';

/**
 * @module hooks/listings/useListingStayQuestion
 * @description **Η ερώτηση του επισκέπτη στη σελίδα αγγελίας** — νύχτες · άτομα · κατοικίδια, με
 * **έναν** ιδιοκτήτη: τη διεύθυνση (ADR-777 §8.60.21.7).
 *
 * 🔴 **Το εύρημα** (μετρημένο 2026-09-22): η αναζήτηση είχε `?in&out&guests=2`, αλλά η σελίδα ξεκινούσε
 * με άδειο ημερολόγιο, ρωτούσε τον διακομιστή με `guests: null`, και η φόρμα αιτήματος έστελνε σιωπηλά
 * `guests=1`. Ο γραφέας όμως κρίνει με τα άτομα που **στάλθηκαν**, άρα η σελίδα και ο γραφέας έκαναν
 * **δύο διαφορετικές ερωτήσεις**: σε αγγελία χωρίς δηλωμένο μέγιστο η φόρμα φαινόταν και το αίτημα
 * απορριπτόταν.
 *
 * 🔑 **Η ερώτηση χτίζεται από το `stayQueryOf`**, τον **ίδιο** κατασκευαστή με την κάρτα της
 * αναζήτησης. Άρα η σελίδα, η κάρτα και ο γραφέας ρωτούν το ίδιο πράγμα **εκ κατασκευής**.
 *
 * 🔑 **Ποιος κρίνει αν το `?in=` είναι επιλέξιμο;** Ο διακομιστής (`useStayAnswers` →
 * `stayAvailabilityFor`), ο ίδιος κριτής με την κάρτα. Το πλέγμα μένει ένδειξη· **δεύτερος κριτής δεν
 * γράφεται**. Τα κλικ περνούν από το υπάρχον `nextStaySelection`.
 *
 * ⚠️ Γραφή με `replaceState` (`replaceUrlSearchParams`): το «πίσω» γυρίζει στην αναζήτηση αντί να
 * ξετυλίγει κλικ, και κανένας γύρος RSC ανά κλικ. Ανάγνωση με `useUrlQuery`, **όχι** `useSearchParams`
 * (νεκρό στον dev για `replaceState` — δες εκεί).
 */

import React from 'react';

import { useUrlQuery } from '@/hooks/useUrlQuery';
import { parseListingFilters, stayQueryOf, type ListingFilters } from '@/lib/listings/listing-filters';
import { writeListingGuests, writeListingPets, writeListingStayWindow } from '@/lib/listings/listing-stay-url';
import type { StayQuery } from '@/lib/stay/stay-availability-vocabulary';
import { staySelectionOf, type StayPublicSelection } from '@/lib/stay/stay-public-selection';
import { replaceUrlSearchParams } from '@/lib/url-query-state';

/**
 * Ένας γραφέας-καθρέφτης → setter της διεύθυνσης. **Σταθερή ταυτότητα** (επίπεδο module): ίδια τιμή ⇒
 * ίδιο string ⇒ το `useSyncExternalStore` δεν ξαναζωγραφίζει, οπότε δεν χρειάζεται φρουρός.
 */
function urlSetterOf<T>(write: (value: T, params: URLSearchParams) => void): (value: T) => void {
  return (value) => replaceUrlSearchParams((params) => write(value, params));
}

const setPetsInUrl = urlSetterOf(writeListingPets);
const setGuestsInUrl = urlSetterOf(writeListingGuests);
const setWindowInUrl = urlSetterOf(writeListingStayWindow);

export interface ListingStayQuestion {
  readonly selection: StayPublicSelection;
  readonly setSelection: (next: StayPublicSelection) => void;
  /** `null` = **δεν δηλώθηκαν** — ποτέ «ένα». */
  readonly guests: number | null;
  readonly setGuests: (guests: number | null) => void;
  readonly pets: number | null;
  readonly setPets: (pets: number | null) => void;
  /** Η ερώτηση προς τον διακομιστή — `null` χωρίς ολοκληρωμένο παράθυρο. */
  readonly query: StayQuery | null;
}

function useUrlFilters(): ListingFilters {
  const query = useUrlQuery();
  return React.useMemo(() => parseListingFilters(new URLSearchParams(query)), [query]);
}

export function useListingStayQuestion(): ListingStayQuestion {
  const filters = useUrlFilters();
  // Η ενδιάμεση «μόνο άφιξη»: μισό ζεύγος δεν γράφεται ποτέ στη διεύθυνση (δες `staySelectionOf`).
  const [pendingCheckIn, setPendingCheckIn] = React.useState<string | null>(null);

  const selection = React.useMemo(
    () => staySelectionOf(filters.stayWindow, pendingCheckIn),
    [filters.stayWindow, pendingCheckIn],
  );
  const setSelection = React.useCallback((next: StayPublicSelection) => {
    setPendingCheckIn(next.kind === 'check-in' ? next.checkIn : null);
    setWindowInUrl(next.kind === 'range' ? { checkIn: next.checkIn, checkOut: next.checkOut } : null);
  }, []);
  const query = React.useMemo(
    () => (pendingCheckIn === null ? stayQueryOf(filters) : null),
    [filters, pendingCheckIn],
  );

  return {
    selection,
    setSelection,
    guests: filters.guests,
    setGuests: setGuestsInUrl,
    pets: filters.pets,
    setPets: setPetsInUrl,
    query,
  };
}
