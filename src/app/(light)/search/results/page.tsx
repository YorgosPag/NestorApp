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

// 🧩 ADR-744 §8 — PER-ROUTE SLICE, ΣΤΑΤΙΚΑ, ΣΕ ΕΜΒΕΛΕΙΑ MODULE.
//
// 🔴 **ΓΕΝΝΗΘΗΚΕ ΓΙΑ ΝΑ ΑΔΕΙΑΣΕΙ ΤΟ ΜΗΤΡΩΟ ΜΕΤΑΝΑΣΤΕΥΣΗΣ, ΟΧΙ ΓΙΑ ΝΑ ΔΙΟΡΘΩΣΕΙ ΩΜΟ
// ΚΛΕΙΔΙ** (2026-09-02). Το `short-stay` μπήκε στο κέλυφος **ολόκληρο** στις 31/08 και
// έκανε το ledger **11**, ενώ ο φρουρός του Group 12 ζητά **≤ 10** — *«μόνο
// συρρικνώνεται»*. Η εγγραφή του ονόμαζε η ίδια τη θεραπεία της: *«ΑΠΕΛΕΥΘΕΡΩΝΕΤΑΙ με
// per-route slice της `/search/results`»*.
//
// ⚠️ **ΤΟ ΜΙΣΟ ΕΚΕΙΝΗΣ ΤΗΣ ΠΡΟΤΑΣΗΣ ΗΤΑΝ ΨΕΥΔΕΣ, ΚΑΙ ΜΕΤΡΗΘΗΚΕ**: έλεγε *«ΜΑΖΙ με το
// `search-results` — έχουν τον ΙΔΙΟ, ΕΝΑΝ καταναλωτή»*. Το `search-results` **δεν** έχει
// έναν καταναλωτή: το ζητά το `PublicSiteHeader.tsx`, που ζει στο `(light)/layout.tsx`,
// δηλαδή σε **κάθε** δημόσια διαδρομή — μένει εγγυημένο. Το `short-stay` όντως έχει
// **έναν**: αυτή τη σελίδα *(`StayFilterFields` · `StayLedgerBar`)*. Η γραμμή 41 του
// `ListingLegality.tsx` που μοιάζει τρίτος καταναλωτής είναι
// `'legality:kind.short-stay-registry'` — **άλλο namespace**, ίδια λέξη.
//
// ⚠️ Η εισαγωγή είναι ΣΤΑΤΙΚΗ και η κλήση σε εμβέλεια MODULE, επίτηδες: με `import()`
// τα κλειδιά θα ήταν ωμά για ένα καρέ και **κρυμμένα** από το CHECK 3.51.
import routeSlice from '@/i18n/generated/routes/search__results.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

import React, { Suspense } from 'react';
import { StaticPageLoading } from '@/core/states';
import { SearchResultsContent } from '@/components/search-results/SearchResultsContent';

registerRouteSlice(routeSlice);

export default function SearchResultsPage() {
  return (
    <Suspense fallback={<StaticPageLoading />}>
      <SearchResultsContent />
    </Suspense>
  );
}
