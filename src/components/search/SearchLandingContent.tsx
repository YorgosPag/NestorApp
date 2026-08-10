'use client';

/**
 * **Η ΟΘΟΝΗ 1** — *«πού ψάχνεις;»* (ADR-777 Α3, πρώτη γραμμή του πίνακα τριών οθονών).
 *
 * @related SPEC-777-RESEARCH §25.7 (ψυχρή εκκίνηση) · §25.8 · lib/listings/listing-coverage
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΚΟΥΤΙ ΕΜΦΑΝΙΖΕΤΑΙ ΜΟΝΟ ΟΤΑΝ ΜΠΟΡΕΙ ΝΑ ΤΗΡΗΣΕΙ ΤΗΝ ΥΠΟΣΧΕΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το §25.7 το έγραψε ρητά: *«Οθόνη 1 που ρωτά "πού στην Ελλάδα;" με 2 ακίνητα είναι
 * **υπόσχεση που η βάση δεν μπορεί να τηρήσει**. Ο χρήστης γράφει «Πάτρα», παίρνει
 * μηδέν, και **φεύγει για πάντα** — και το μηδέν δεν θα σημαίνει «δεν υπάρχει», θα
 * σημαίνει «δεν φτάσαμε ακόμα εκεί».»*
 *
 * **Μετρημένο ζωντανά (10/08):** `6 ακίνητα · 0 στον χάρτη · 6 χωρίς δηλωμένη θέση`.
 * Δηλαδή σήμερα η κατάσταση είναι `no-location`, και ένα κουτί «πού ψάχνεις;» θα
 * επέστρεφε **μηδέν για κάθε πιθανή είσοδο** — 100% των αναζητήσεων απογοήτευση, με
 * όλες τις πύλες πράσινες.
 *
 * ⚠️ **Και η εναλλακτική «δείξ' το πάντα, γκριζαρισμένο» απορρίφθηκε**: ένα
 * απενεργοποιημένο πεδίο λέει *«δεν σου επιτρέπεται»*, ενώ η αλήθεια είναι *«δεν
 * έχουμε ακόμη πάνω σε τι να ψάξεις»*. Η πρόταση κάλυψης το λέει **με αριθμούς**, και
 * το κουτί επιστρέφει μόνο του μόλις οι αριθμοί το δικαιολογήσουν — **χωρίς αλλαγή
 * κώδικα**, γιατί η συνθήκη είναι τα ίδια τα δεδομένα.
 *
 * 🔶 **ΔΗΛΩΜΕΝΟ ΚΕΝΟ, με όνομα:** το §25.8 προβλέπει και τρίτο στοιχείο — *«δεν
 * βρήκες περιοχή; **πες μας τι ψάχνεις**»*, τη διέξοδο προς τη **ΖΗΤΗΣΗ (Α9)**. Δεν
 * μπαίνει, και ο λόγος είναι μετρημένος: η Α9 **δεν έχει υλοποιηθεί** (καμία διαδρομή,
 * καμία οντότητα). Ένας σύνδεσμος εκεί θα ήταν **404** — δηλαδή θα γεννούσε ακριβώς
 * το ελάττωμα που αυτή η οθόνη ήρθε να κλείσει.
 */

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePublicListings } from '@/services/realtime/hooks/usePublicListings';
import { computeListingCoverage, coverageAnswersWhere } from '@/lib/listings/listing-coverage';
import { SEARCH_RESULTS_ROUTE } from '@/lib/listings/listing-routes';
import { CoverageStatement } from './CoverageStatement';
import { PlaceSearchBox } from './PlaceSearchBox';

export function SearchLandingContent() {
  const { t } = useTranslation(['search-results']);
  const { listings, loading, error } = usePublicListings();

  // ⚠️ **Μία** ανάγνωση, **μία** λογιστική — η ίδια που τυπώνει η οθόνη 2. Οι δύο
  // οθόνες δεν μπορούν να δώσουν διαφορετικό αριθμό, γιατί δεν υπάρχουν δύο αριθμοί
  // (άγκυρα Κ3 στο `listing-coverage.test.ts`).
  const coverage = React.useMemo(() => computeListingCoverage(listings), [listings]);

  // Όσο δεν έχουμε μετρήσει, δεν υποσχόμαστε: το κουτί δεν εμφανίζεται σε φόρτωση ή
  // σφάλμα, γιατί σε καμία από τις δύο δεν ξέρουμε αν μπορεί να τηρηθεί η υπόσχεση.
  const canAskWhere = !loading && error === null && coverageAnswersWhere(coverage);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-6 p-6">
      <h1 className="text-3xl font-semibold text-foreground">
        {t('search-results:landing.title')}
      </h1>

      {canAskWhere && (
        <section aria-label={t('search-results:landing.search.label')}>
          <PlaceSearchBox />
        </section>
      )}

      <CoverageStatement coverage={coverage} loading={loading} error={error} />

      {/*
        🔑 Η διέξοδος που **δουλεύει σε κάθε κατάσταση**. Στη σημερινή `no-location`
        είναι ο ΜΟΝΟΣ δρόμος — και είναι πραγματικός: η οθόνη 2 δείχνει και τις 6,
        με ρητή εξήγηση γιατί καμία δεν είναι στον χάρτη.
      */}
      <nav>
        <Link
          href={SEARCH_RESULTS_ROUTE}
          className="inline-block rounded-md border border-border bg-card px-4 py-2 font-medium text-foreground"
        >
          {t('search-results:landing.browseAll')}
        </Link>
      </nav>
    </main>
  );
}
