'use client';

/**
 * **Η ΟΘΟΝΗ 2** — χάρτης ΚΑΙ λίστα, ταυτόχρονα ζωντανά (ADR-777 Α3).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΜΙΑ ΚΑΤΑΣΤΑΣΗ, ΔΥΟ ΚΑΤΑΝΑΛΩΤΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Τα φίλτρα ζουν στη **διεύθυνση** και το φιλτραρισμένο σύνολο υπολογίζεται **εδώ,
 * μία φορά**. Ο χάρτης και η λίστα το **διαβάζουν** — δεν φιλτράρουν ο καθένας μόνος
 * του. Το **75%** των αποτυχιών της σημερινής μας κατάστασης ήταν ακριβώς αυτό: δύο
 * πλαίσια που δεν συμφωνούσαν τι δείχνουν.
 *
 * Ο δεσμός είναι **και προς τις δύο κατευθύνσεις**: hover στη λίστα → δακτύλιος στον
 * χάρτη· κλικ στον χάρτη → επιλογή στη λίστα.
 *
 * 🔑 **Η λογιστική είναι πάνω από ΚΑΙ ΤΑ ΔΥΟ**, όχι μέσα σε ένα από αυτά — γιατί
 * απαντά για το **σύνολο**, όχι για ό,τι τυχαίνει να χωρά σε ένα πλαίσιο.
 */

import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePublicListings, useListingLedger } from '@/services/realtime/hooks/usePublicListings';
import {
  applyListingFilters,
  parseListingFilters,
  serializeListingFilters,
} from '@/lib/listings/listing-filters';
import { listingMapShape, isMappedShape } from '@/lib/listings/listing-map-shape';
import { useViewportClass } from '@/hooks/media/useViewportClass';
import { ListingLedgerBar } from './ListingLedgerBar';
import { ResultsList } from './ResultsList';
import { ResultsMap } from './ResultsMap';
import { ResultsSheet } from './ResultsSheet';

export function SearchResultsContent() {
  const { t } = useTranslation(['search-results']);
  const searchParams = useSearchParams();

  /**
   * **Η ΜΙΑ ΕΡΩΤΗΣΗ ΤΗΣ ΟΘΟΝΗΣ.** Ρωτιέται εδώ, μία φορά, και ταξιδεύει προς τα κάτω.
   *
   * ⚠️ Οδηγεί **συμπεριφορά**, ποτέ σχήμα: στάσεις, πίσω κουμπί, κλείδωμα εσωτερικής
   * κύλισης. Το σχήμα το απαντά το CSS στο πρώτο βάψιμο — αλλιώς το ειλικρινές `measuring`
   * θα κόστιζε πλήρη αναδιάταξη στη μία από τις δύο μερίδες κοινού (Α19: `CLS < 0,1`).
   * Ο λόγος γράφεται ολόκληρος στο `ResultsSheet`.
   */
  const viewport = useViewportClass();
  const { listings, loading, error } = usePublicListings();
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const filters = useMemo(
    () => parseListingFilters(new URLSearchParams(searchParams?.toString() ?? '')),
    [searchParams]
  );

  const visible = useMemo(() => applyListingFilters(listings, filters), [listings, filters]);

  /**
   * Τα φίλτρα **ξανα-σειριοποιημένα**, όχι η ωμή διεύθυνση.
   *
   * 🔑 Η διαφορά είναι πραγματική: το `parse → serialize` **κανονικοποιεί** (πετά
   * άγνωστες παραμέτρους, μισά γεωγραφικά ζεύγη, ακτίνες ≤ 0). Αν περνούσαμε τη
   * διεύθυνση αυτούσια, ένας κοινοποιημένος σύνδεσμος με σκουπίδια θα τα κουβαλούσε
   * σε **κάθε** επόμενη σελίδα — και θα ήταν **δύο** αλήθειες για το τι ζητήθηκε.
   */
  const filterQuery = useMemo(() => serializeListingFilters(filters).toString(), [filters]);

  // ⚠️ Η διαίρεση γίνεται ΜΙΑ φορά και τα δύο μέρη προκύπτουν από την ΙΔΙΑ κρίση —
  // αλλιώς μια αγγελία θα μπορούσε να λείπει και από τα δύο, ή να είναι και στα δύο.
  const { mapped, unmapped } = useMemo(() => {
    const withShape: typeof visible = [];
    const without: typeof visible = [];
    for (const listing of visible) {
      (isMappedShape(listingMapShape(listing.position)) ? withShape : without).push(listing);
    }
    return { mapped: withShape, unmapped: without };
  }, [visible]);

  const ledger = useListingLedger(visible);

  return (
    // 🔴 `flex-1 min-h-0`, ΟΧΙ `h-screen`: η οθόνη ζει τώρα **κάτω από κεφαλίδα**, και
    // ένα σταθερό ύψος παραθύρου θα έσπρωχνε το κάτω μέρος του χάρτη εκτός οθόνης. Το
    // `min-h-0` είναι υποχρεωτικό — χωρίς αυτό το flex item αρνείται να συρρικνωθεί
    // κάτω από το περιεχόμενό του και η **εσωτερική** κύλιση της λίστας δεν λειτουργεί.
    <main className="flex min-h-0 flex-1 flex-col bg-background">
      <header className="border-b border-border px-4 py-3">
        <h1 className="text-lg font-semibold text-foreground">{t('search-results:page.title')}</h1>
        {/* Η λογιστική τυπώνεται ΠΑΝΤΑ — ακόμη και στο μηδέν, ακόμη και στη φόρτωση. */}
        <ListingLedgerBar ledger={ledger} className="mt-1" />
        {loading && <p className="mt-1 text-sm text-muted-foreground">{t('search-results:page.loading')}</p>}
        {error && <p role="alert" className="mt-1 text-sm text-destructive">{t('search-results:page.error')}</p>}
      </header>

      {/*
        ΔΥΟ ΔΙΑΤΑΞΕΙΣ ΑΠΟ ΕΝΑ ΔΕΝΤΡΟ — και τα δύο πλαίσια ζωντανά σε **αμφότερες**.

        • **Ευρεία** (`md:`): πλέγμα δύο στηλών, λίστα ‖ χάρτης.
        • **Στενή**: ο χάρτης καταλαμβάνει **ολόκληρο** το κουτί και η λίστα κάθεται
          **από πάνω** ως μη-αποκλειστικό φύλλο (SPEC-777D §26.2).

        🔴 Αυτό που ΕΦΥΓΕ ήταν `grid-cols-1 … lg:grid-cols-[…]`, και το ελάττωμα δεν ήταν
        ότι «δεν ρωτούσε»: ρωτούσε με CSS και **απαντούσε λάθος**. Στο στενό στοίβαζε δύο
        σειρές μέσα σε `overflow-hidden`, δηλαδή λίστα και χάρτης **μοιράζονταν το ύψος**
        και κανένα δεν ήταν χρήσιμο — η **τρίτη** κακή επιλογή, δίπλα στην εναλλαγή που το
        §26.1 απορρίπτει ονομαστικά. Έφυγε επίσης το `lg` (1024), που ήταν **δεύτερος**
        αριθμός δίπλα στο `MOBILE_BREAKPOINT` (768): το κατώφλι είναι πλέον **ένα**.

        ⚠️ Η λίστα μένει **πρώτη στη ροή ανάγνωσης** — είναι το μέσο που το 65%
        χρησιμοποιεί πραγματικά (§25.3). Γι' αυτό το φύλλο ζητά σκαλί τοπικής στρώσης
        (`z-10`): στο στενό είναι **δεύτερο** στο βάψιμο ενώ είναι **πρώτο** στην ανάγνωση,
        και η σειρά του DOM μόνη της θα το έθαβε κάτω από τον χάρτη.
      */}
      <div className="relative min-h-0 flex-1 overflow-hidden md:grid md:grid-cols-[minmax(20rem,26rem)_1fr]">
        <ResultsSheet viewport={viewport}>
          <ResultsList
            mapped={mapped}
            unmapped={unmapped}
            highlightedId={highlightedId}
            onHover={setHighlightedId}
            filterQuery={filterQuery}
          />
        </ResultsSheet>

        {/*
          `isolate`: ο χάρτης είναι **ξένος** κώδικας (Geo-Canvas/MapLibre) με δικά του
          εσωτερικά επίπεδα. Ένα δικό του στρώμα δεν επιτρέπεται να αναρριχηθεί πάνω από
          το φύλλο — και ο **περιορισμός** είναι το ανώτερο εργαλείο έναντι του δαμάσματος
          με αριθμό (CHECK 3.50): δεν χρειάζεται να ξέρουμε τι γράφει η βιβλιοθήκη, ούτε
          μετά από αναβάθμισή της.
        */}
        <section
          aria-label={t('search-results:map.label')}
          className="absolute inset-0 isolate md:static"
        >
          <ResultsMap listings={mapped} highlightedId={highlightedId} onSelect={setHighlightedId} />
        </section>
      </div>
    </main>
  );
}
