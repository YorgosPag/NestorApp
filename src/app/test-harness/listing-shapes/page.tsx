'use client';

/**
 * **ΠΑΓΚΟΣ ΔΟΚΙΜΩΝ — τα έξι σχήματα της Α5, στον ΠΡΑΓΜΑΤΙΚΟ χάρτη.**
 *
 * 🔑 **Γιατί υπάρχει:** η ζωντανή βάση **δεν έχει καμία συντεταγμένη** (μετρήθηκε
 * 2026-08-10: το έργο των 8 ακινήτων δεν έχει διεύθυνση· το μόνο έργο με διεύθυνση δεν
 * έχει ακίνητα· `public_buildings` = 0). Άρα ο χάρτης της οθόνης 2 γεννιέται —σωστά—
 * **άδειος**, και τα έξι σχήματα δεν μπορούν να ιδωθούν με πραγματικά δεδομένα.
 *
 * Η εναλλακτική θα ήταν να **επινοήσω** θέσεις σε παραγωγικά ακίνητα. Δεν γίνεται:
 * μια ψεύτικη συντεταγμένη σε αγγελία είναι ακριβώς το ψέμα που ολόκληρη η Α5
 * υπάρχει για να αποκλείσει, και θα ζούσε στη βάση αφού φύγει το στιγμιότυπο.
 *
 * Εδώ τα δεδομένα είναι **δηλωμένα δοκιμαστικά**, ζουν μόνο στη μνήμη της σελίδας, και
 * τροφοδοτούν το **πραγματικό** `ResultsMap` — ίδιο ιδίωμα με το ήδη υπάρχον
 * `/test-harness/contrast-matrix`, που η CHECK 3.40 χρησιμοποιεί για τον ίδιο λόγο:
 * να δει κανείς **ζωντανά** αυτό που η στατική ανάλυση μόνο ισχυρίζεται.
 *
 * ⚠️ **Δεν είναι test.** Δεν αποδεικνύει τίποτα μόνο του — τα σχήματα τα κλειδώνει το
 * `listing-map-shape.test.ts` (18 άγκυρες, 5/5 μεταλλάξεις). Αυτό είναι το **μάτι**.
 */

import React from 'react';
import { ResultsMap } from '@/components/search-results/ResultsMap';
import { ListingLedgerBar } from '@/components/search-results/ListingLedgerBar';
import { computeListingLedger } from '@/services/realtime/hooks/usePublicListings';
import type { PublicListing } from '@/types/public-listing';

const AT = '2026-08-10T12:00:00.000Z';

/** Θεσσαλονίκη — απλωμένα ώστε να μη σκεπάζει το ένα το άλλο. */
const P = (lat: number, lng: number) => ({ lat, lng }) as const;

function fixture(id: string, title: string, position: PublicListing['position']): PublicListing {
  return {
    id, title, position,
    commercialStatus: 'for-sale',
    commercial: { askingPrice: 200000, finalPrice: null, rentPrice: null },
    coverImage: null, type: 'apartment', areaSqm: 90,
    offerKinds: ['sell'], floor: 2, bedrooms: 2, projectedAt: AT,
  };
}

const FIXTURES: readonly PublicListing[] = [
  fixture('exact', '1 — Ακριβής διεύθυνση (πινέζα)', {
    kind: 'known', provenance: 'geocoded', point: P(40.6350, 22.9420), locatedAt: AT, accuracy: 'exact',
  }),
  fixture('interpolated', '2 — Δρόμος χωρίς αριθμό (πινέζα με δακτύλιο)', {
    kind: 'known', provenance: 'geocoded', point: P(40.6350, 22.9560), locatedAt: AT, accuracy: 'interpolated',
  }),
  fixture('approximate', '3 — Συνοικία (σκιασμένος κύκλος)', {
    kind: 'known', provenance: 'geocoded', point: P(40.6270, 22.9420), locatedAt: AT, accuracy: 'approximate',
  }),
  fixture('center', '4 — ΜΟΝΟ ΠΟΛΗ (σκιασμένη πόλη, ΠΟΤΕ πινέζα)', {
    kind: 'known', provenance: 'geocoded', point: P(40.6180, 22.9560), locatedAt: AT, accuracy: 'center',
  }),
  fixture('manual', '5 — Πινέζα ανθρώπου', {
    kind: 'known', provenance: 'manual', point: P(40.6420, 22.9490), locatedAt: AT,
  }),
  fixture('outline', '6 — Μετρημένο περίγραμμα', {
    kind: 'known', provenance: 'survey', point: P(40.6300, 22.9650), locatedAt: AT,
    outline: [P(40.6295, 22.9640), P(40.6295, 22.9665), P(40.6310, 22.9665), P(40.6310, 22.9640)],
  }),
  fixture('unknown-a', '7 — Χωρίς θέση: δεν ρωτήθηκε ποτέ', { kind: 'unknown', reason: 'never-asked' }),
  fixture('unknown-b', '8 — Χωρίς θέση: ο ιδιοκτήτης δεν δήλωσε', { kind: 'unknown', reason: 'owner-declined' }),
];

export default function ListingShapesHarness() {
  const [highlightedId, setHighlightedId] = React.useState<string | null>(null);
  const ledger = computeListingLedger(FIXTURES);

  return (
    <main className="flex h-screen flex-col bg-background">
      <header className="border-b border-border px-4 py-3">
        <h1 className="text-lg font-semibold text-foreground">
          Πάγκος δοκιμών — τα έξι σχήματα της Α5
        </h1>
        <ListingLedgerBar ledger={ledger} className="mt-1" />
        <p className="mt-1 text-xs text-muted-foreground">
          Επιλεγμένο: {highlightedId ?? '—'} · και τα έξι ορατά σχήματα έχουν το ΙΔΙΟ χρώμα:
          η ακρίβεια είναι σχήμα, όχι απόχρωση (CHECK 3.41 / WCAG 1.4.1).
        </p>
      </header>

      <div className="grid flex-1 grid-cols-[22rem_1fr] overflow-hidden">
        <ul className="overflow-y-auto border-r border-border p-3 text-sm">
          {FIXTURES.map((f) => (
            <li key={f.id} className="border-b border-border py-2 text-foreground">
              {f.title}
            </li>
          ))}
        </ul>
        <ResultsMap listings={FIXTURES} highlightedId={highlightedId} onSelect={setHighlightedId} />
      </div>
    </main>
  );
}
