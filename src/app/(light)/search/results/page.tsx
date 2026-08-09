'use client';

/**
 * `/search/results` — **η οθόνη 2** (ADR-777 Α3).
 *
 * Ζει στο route group `(light)`: κέλυφος **χωρίς** το εσωτερικό chrome της εφαρμογής,
 * γιατί ο επισκέπτης εδώ είναι **ανώνυμος** — δεν έχει sidebar, δεν έχει πελάτη, δεν
 * έχει λογαριασμό. Το `(light)` υπήρχε ήδη **χωρίς καμία διαδρομή**· αποκτά τον πρώτο
 * του καταναλωτή αντί να γεννηθεί δεύτερο κέλυφος (N.0.2).
 *
 * ⚠️ `Suspense` **υποχρεωτικά**: το `useSearchParams` το απαιτεί, αλλιώς ολόκληρη η
 * διαδρομή βγαίνει από τη στατική απόδοση.
 */

import React, { Suspense } from 'react';
import { StaticPageLoading } from '@/core/states';
import { SearchResultsContent } from '@/components/search-results/SearchResultsContent';

export default function SearchResultsPage() {
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <SearchResultsContent />
    </Suspense>
  );
}
