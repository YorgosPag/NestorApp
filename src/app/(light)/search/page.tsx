'use client';

/**
 * `/search` — **η οθόνη 1** (ADR-777 Α3). Ήταν **404** μέχρι σήμερα.
 *
 * Ζει στο **ίδιο** route group `(light)` με την οθόνη 2: ο επισκέπτης εδώ είναι
 * **ανώνυμος** — δεν έχει sidebar, δεν έχει πελάτη, δεν έχει λογαριασμό. Το κέλυφος
 * υπάρχει ήδη και αποκτά τον **δεύτερο** καταναλωτή του αντί να γεννηθεί τρίτο (N.0.2).
 *
 * ⚠️ **Κανένα `Suspense` εδώ, σε αντίθεση με το `results/page.tsx`** — και η διαφορά
 * δεν είναι παράλειψη: εκεί το `useSearchParams` το **απαιτεί**, αλλιώς ολόκληρη η
 * διαδρομή βγαίνει από τη στατική απόδοση. Αυτή η οθόνη δεν διαβάζει τη διεύθυνση —
 * τη **γράφει**.
 */

import React from 'react';
import { SearchLandingContent } from '@/components/search/SearchLandingContent';

export default function SearchLandingPage() {
  return <SearchLandingContent />;
}
