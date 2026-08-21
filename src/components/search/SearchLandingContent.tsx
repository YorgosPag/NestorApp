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
 * ✅ **ΤΟ ΤΡΙΤΟ ΣΤΟΙΧΕΙΟ ΤΟΥ §25.8 ΜΠΗΚΕ (2026-08-11).** Ήταν δηλωμένο κενό: *«δεν
 * βρήκες περιοχή; **πες μας τι ψάχνεις**»* — η διέξοδος προς τη **ΖΗΤΗΣΗ (Α9)** —
 * και έλειπε επειδή η Α9 δεν είχε υλοποιηθεί, οπότε ο σύνδεσμος θα ήταν **404**.
 * Πλέον υπάρχει (`/demands`, `dmnd_*`, μηχανή ταιριάσματος).
 *
 * 🔴 **ΚΑΙ ΕΙΝΑΙ Η ΣΗΜΑΝΤΙΚΟΤΕΡΗ ΠΡΟΣΘΗΚΗ ΑΥΤΗΣ ΤΗΣ ΟΘΟΝΗΣ, ΟΧΙ ΜΙΑ ΑΚΟΜΗ.** Η
 * σημερινή κατάσταση κάλυψης είναι `no-location`: **6 ακίνητα, 0 στον χάρτη**. Δηλαδή
 * ο επισκέπτης που ήρθε να ψάξει **δεν έχει τι να βρει** — και το §12.6 λέει ότι
 * ακριβώς εκεί η ζήτηση *«λύνει το κοτόπουλο και το αυγό, ανάποδα από όλους»*: είναι
 * **φθηνή** (δίνεται δωρεάν, χωρίς να κατέχει κανείς τίποτα) και είναι το **δόλωμα για
 * τον ιδιοκτήτη** (*«12 άνθρωποι ζητούν το κατάστημά σας»*).
 *
 * Άρα η διέξοδος **δεν είναι παρηγοριά για την αποτυχία της αναζήτησης** — είναι ο
 * δρόμος που, σήμερα, αξίζει περισσότερο από την ίδια την αναζήτηση.
 */

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePublicListings } from '@/services/realtime/hooks/usePublicListings';
import { computeListingCoverage, coverageAnswersWhere } from '@/lib/listings/listing-coverage';
import { SEARCH_RESULTS_ROUTE } from '@/lib/listings/listing-routes';
import { MY_DEMANDS_ROUTE } from '@/lib/demand/demand-routes';
import { MY_OFFERS_ROUTE } from '@/lib/owner-property/owner-property-routes';
import { CoverageStatement } from './CoverageStatement';
import { PlaceSearchBox } from './PlaceSearchBox';

export function SearchLandingContent() {
  const { t } = useTranslation(['search-results', 'property-market', 'search-results', 'search-results']);
  const { listings, loading, error } = usePublicListings();

  // ⚠️ **Μία** ανάγνωση, **μία** λογιστική — η ίδια που τυπώνει η οθόνη 2. Οι δύο
  // οθόνες δεν μπορούν να δώσουν διαφορετικό αριθμό, γιατί δεν υπάρχουν δύο αριθμοί
  // (άγκυρα Κ3 στο `listing-coverage.test.ts`).
  const coverage = React.useMemo(() => computeListingCoverage(listings), [listings]);

  // Όσο δεν έχουμε μετρήσει, δεν υποσχόμαστε: το κουτί δεν εμφανίζεται σε φόρτωση ή
  // σφάλμα, γιατί σε καμία από τις δύο δεν ξέρουμε αν μπορεί να τηρηθεί η υπόσχεση.
  const canAskWhere = !loading && error === null && coverageAnswersWhere(coverage);

  return (
    // `flex-1`, ΟΧΙ `min-h-screen`: το ύψος το κατέχει πλέον το `(light)/layout.tsx`,
    // που φιλοξενεί και την κεφαλίδα. Το `min-h-screen` εδώ θα ζητούσε **ολόκληρο** το
    // παράθυρο **κάτω** από την κεφαλίδα ⇒ μπάρα κύλισης σε οθόνη που δεν κυλά.
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 p-6">
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
      <nav className="flex flex-col gap-3">
        <Link
          href={SEARCH_RESULTS_ROUTE}
          className="inline-block w-fit rounded-md border border-border bg-card px-4 py-2 font-medium text-foreground"
        >
          {t('search-results:landing.browseAll')}
        </Link>

        {/*
          🔑 **Η διέξοδος του §25.8 προς τη ΖΗΤΗΣΗ.** Το κείμενο βοήθειας δεν είναι
          διακοσμητικό: χωρίς αυτό, το «Ζητώ» διαβάζεται ως «φόρμα επικοινωνίας» —
          ακριβώς η ανάγνωση που το §12.2 απαγορεύει. Λέει **τι κερδίζει** ο άνθρωπος
          («θα σου πούμε τι υπάρχει κοντά, ακόμη κι όταν δεν ταιριάζει τίποτα»), που
          είναι ο **όρος επιβίωσης** του §12.6 δηλωμένος **πριν** επενδύσει χρόνο.
        */}
        <div className="flex flex-col gap-1">
          <Link
            href={MY_DEMANDS_ROUTE}
            className="inline-block w-fit rounded-md border border-border bg-card px-4 py-2 font-medium text-foreground"
          >
            {t('property-market:demand.door.label')}
          </Link>
          <p className="text-sm text-muted-foreground">
            {t('property-market:demand.door.hint')}
          </p>
        </div>

        {/*
          🔑 **Η ΤΡΙΤΗ ΠΟΡΤΑ — «ΠΡΟΣΦΕΡΩ» (Α14).** Μέχρι τις 2026-08-11 έλειπε, και ο
          πίνακας του handoff το μετρούσε: αγορά ✅ · πώληση ❌ · ενοικίαση ❌ ·
          αντιπαροχή ❌. Ακίνητο καταχωρούσε **μόνο ο επαγγελματίας**, από το
          `(app)/properties` — πίσω από σύνδεση, με το κέλυφος έργων/λογιστικής/DXF.
          **Ο απλός χρήστης του διαδικτύου δεν είχε καμία πόρτα.**

          ⚠️ Δείχνει στον **κατάλογο** (`/offers`), όχι στη φόρμα — ίδιος λόγος με το
          «Ζητώ»: ο `(me)/layout.tsx` ζητά ταυτότητα, οπότε ο ανώνυμος περνά από τη
          σύνδεση **μία** φορά και προσγειώνεται εκεί που θέλει· ενώ σύνδεσμος προς
          `/offers/new` θα τον έστελνε, σε κινητό, σε οθόνη που λέει «όχι εδώ» (Α8).

          ⚠️ Και το κείμενο βοήθειας λέει το **§17.1** χωρίς ορολογία: *«με λίγα
          δομημένα στοιχεία … θα το βρίσκουν όσοι το ψάχνουν»*. Χωρίς αυτό, το
          «Προσφέρω» διαβάζεται ως «ανέβασε φωτογραφία και τηλέφωνο» — ακριβώς η
          αγγελία που η Α14 απαγορεύει.
        */}
        <div className="flex flex-col gap-1">
          <Link
            href={MY_OFFERS_ROUTE}
            className="inline-block w-fit rounded-md border border-border bg-card px-4 py-2 font-medium text-foreground"
          >
            {t('property-market:offer.door.label')}
          </Link>
          <p className="text-sm text-muted-foreground">
            {t('property-market:offer.door.hint')}
          </p>
        </div>
      </nav>
    </main>
  );
}
