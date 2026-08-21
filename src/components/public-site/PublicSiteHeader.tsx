'use client';

/**
 * **Η κεφαλίδα του δημόσιου ιστότοπου** — δύο πόρτες, καμία υπόσχεση.
 *
 * @related ADR-777 §8.13 (η δημόσια ρίζα) · Α3 · CHECK 3.52
 * @module components/public-site/PublicSiteHeader
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ΚΑΝΕΝΑ ΑΚΡΟΑΤΗΡΙΟ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΧΑΣΕΙ ΤΗΝ ΠΟΡΤΑ ΤΟΥ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Πριν: το `/` σέρβιρε το ταμπλό ⇒ **ο επαγγελματίας είχε πόρτα** (σύνδεση) και **ο
 * ιδιώτης καμία**. Η αφελής ανταλλαγή —«κάνε το `/` δημόσιο»— απλώς **αντιστρέφει**
 * το ελάττωμα: ο επαγγελματίας που πληκτρολογεί nestorconstruct.gr δεν θα έβρισκε
 * τρόπο να μπει στον χώρο του. Η κεφαλίδα υπάρχει ώστε η μετακόμιση να είναι
 * **προσθήκη πόρτας**, όχι μετακίνησή της.
 *
 * ✅ **Η ΠΟΡΤΑ «ΖΗΤΩ» ΑΝΟΙΞΕ (2026-08-11).** Μέχρι τότε αυτό το σχόλιο έγραφε ότι
 * λείπει *«επίτηδες»*, γιατί η **Α9** δεν είχε ούτε διαδρομή ούτε οντότητα ⇒ σύνδεσμος
 * εκεί θα ήταν **404**, και *«μια πόρτα που δεν ανοίγει είναι χειρότερη από καμία
 * πόρτα»*. Πλέον υπάρχουν και τα δύο (`/demands`, `dmnd_*`), οπότε η σιωπή **έπαψε να
 * είναι αλήθεια** — και μια δηλωμένη σιωπή που δεν ενημερώνεται γίνεται το σχόλιο που
 * λέει ψέματα (σχήμα CHECK 3.47: *«το σχόλιο ΕΛΕΓΕ ΨΕΜΑΤΑ»*).
 *
 * ✅ **ΚΑΙ Η ΠΟΡΤΑ «ΠΡΟΣΦΕΡΩ» ΑΝΟΙΞΕ (2026-08-11, Α14).** Ο κανόνας δεν χαλάρωσε ποτέ:
 * απαιτούσε **διαδρομή** και **οντότητα**, και πλέον υπάρχουν και οι δύο (`/offers`,
 * `ownp_*`). Οι **δύο** πόρτες του ιδιώτη είναι πλέον συμμετρικές — «ζητώ» και
 * «προσφέρω» — και μαζί με τη «σύνδεση» του επαγγελματία καλύπτουν **και τα τρία**
 * ακροατήρια που περνούν από αυτή τη γραμμή.
 *
 * 🔑 **Η πόρτα δείχνει στον κατάλογο, ΟΧΙ στη φόρμα.** Ο ανώνυμος που θα πατούσε
 * «Ζητώ» και θα προσγειωνόταν σε φόρμα δημιουργίας θα έπαιρνε ανακατεύθυνση στη
 * σύνδεση **και μετά** θα έπρεπε να ξαναβρεί τον δρόμο· και σε κινητό η φόρμα δεν
 * υπάρχει καθόλου (**Α8**). Ο κατάλογος δουλεύει και στις δύο περιπτώσεις.
 *
 * ⚠️ **ΔΕΝ είναι το `AppHeader`, και δεν επιτρέπεται να γίνει.** Το CHECK 3.52
 * φρουρεί ότι τα σύμβολα του κελύφους (`@/components/app-header`,
 * `@/components/app-sidebar`) εισάγονται **μόνο** από το `(app)/layout.tsx`. Αυτή η
 * κεφαλίδα δεν αγγίζει κανέναν από τους 9 βαρείς providers — αλλιώς θα ακύρωνε το
 * μετρημένο κέρδος **−41% έως −59%** SSR bytes των δημόσιων οθονών.
 */

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { AUTH_ROUTES } from '@/lib/routes';
import { SEARCH_LANDING_ROUTE } from '@/lib/listings/listing-routes';
import { MY_DEMANDS_ROUTE } from '@/lib/demand/demand-routes';
import { MY_OFFERS_ROUTE } from '@/lib/owner-property/owner-property-routes';

export function PublicSiteHeader() {
  const { t } = useTranslation(['search-results', 'property-market', 'search-results', 'search-results']);

  return (
    <header className="w-full border-b border-border bg-card">
      <nav
        aria-label={t('search-results:site.nav')}
        className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6"
      >
        <Link
          href={SEARCH_LANDING_ROUTE}
          className="text-base font-semibold tracking-tight text-foreground"
          aria-label={t('search-results:site.home')}
        >
          {t('search-results:site.brand')}
        </Link>

        <div className="flex items-center gap-2">
          {/*
            🔑 **Η πόρτα του ιδιώτη.** Δείχνει στον **κατάλογο** (`/demands`), όχι στη
            φόρμα: ο `(me)/layout.tsx` ζητά ταυτότητα, οπότε ο ανώνυμος περνά από τη
            σύνδεση **μία** φορά και προσγειώνεται εκεί που θέλει — ενώ ένας σύνδεσμος
            προς `/demands/new` θα τον έστελνε, σε κινητό, σε οθόνη που λέει «όχι εδώ»
            (Α8). Η πόρτα οφείλει να ανοίγει σε **κάθε** συσκευή.
          */}
          <Link
            href={MY_DEMANDS_ROUTE}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground"
          >
            {t('property-market:demand.door.label')}
          </Link>

          {/*
            ✅ **Η ΤΡΙΤΗ ΠΟΡΤΑ — «ΠΡΟΣΦΕΡΩ» (2026-08-11, Α14).** Η δεύτερη προϋπόθεση
            εκπληρώθηκε: υπάρχουν πλέον **και διαδρομή** (`/offers`) **και οντότητα**
            (`ownp_*`), οπότε ο σύνδεσμος **ανοίγει** — δεν είναι 404. Ίδιος κανόνας
            με το «Ζητώ»: *«μια πόρτα που δεν ανοίγει είναι χειρότερη από καμία
            πόρτα»*.

            🔑 Δείχνει στον **κατάλογο**, ποτέ στη φόρμα: η δημιουργία είναι
            **αποκλειστικά desktop** (Α8), ενώ η πόρτα οφείλει να ανοίγει σε **κάθε**
            συσκευή.
          */}
          <Link
            href={MY_OFFERS_ROUTE}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground"
          >
            {t('property-market:offer.door.label')}
          </Link>

          {/*
            ⚠️ Η πόρτα του επαγγελματία δείχνει στη **σύνδεση**, όχι στο
            {@link AUTH_ROUTES}`.home`: ο ανώνυμος που θα πατούσε «ο χώρος μου» θα
            έπαιρνε ανακατεύθυνση πίσω στη σύνδεση — δύο βήματα για ένα, και μια
            ετικέτα που λέει κάτι που δεν συμβαίνει.
          */}
          <Link
            href={AUTH_ROUTES.login}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground"
          >
            {t('search-results:site.signIn')}
          </Link>
        </div>
      </nav>
    </header>
  );
}
