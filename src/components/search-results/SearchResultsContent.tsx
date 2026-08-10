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
import { ListingLedgerBar } from './ListingLedgerBar';
import { ResultsList } from './ResultsList';
import { ResultsMap } from './ResultsMap';

export function SearchResultsContent() {
  const { t } = useTranslation(['search-results']);
  const searchParams = useSearchParams();
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
    <main className="flex h-screen flex-col bg-background">
      <header className="border-b border-border px-4 py-3">
        <h1 className="text-lg font-semibold text-foreground">{t('search-results:page.title')}</h1>
        {/* Η λογιστική τυπώνεται ΠΑΝΤΑ — ακόμη και στο μηδέν, ακόμη και στη φόρτωση. */}
        <ListingLedgerBar ledger={ledger} className="mt-1" />
        {loading && <p className="mt-1 text-sm text-muted-foreground">{t('search-results:page.loading')}</p>}
        {error && <p role="alert" className="mt-1 text-sm text-destructive">{t('search-results:page.error')}</p>}
      </header>

      {/*
        ΔΙΠΛΑ-ΔΙΠΛΑ, και τα δύο ζωντανά. Η λίστα πρώτη στη ροή ανάγνωσης: είναι το
        μέσο που το 65% χρησιμοποιεί πραγματικά.
      */}
      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(20rem,26rem)_1fr]">
        <div className="min-h-0 border-r border-border">
          <ResultsList
            mapped={mapped}
            unmapped={unmapped}
            highlightedId={highlightedId}
            onHover={setHighlightedId}
            filterQuery={filterQuery}
          />
        </div>
        <div className="min-h-0" aria-label={t('search-results:map.label')}>
          <ResultsMap listings={mapped} highlightedId={highlightedId} onSelect={setHighlightedId} />
        </div>
      </div>
    </main>
  );
}
