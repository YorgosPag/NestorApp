'use client';

/**
 * @fileoverview **Ο ΔΕΣΜΟΣ ΚΑΤΑΛΟΓΟΥ ⇄ ΧΑΡΤΗ** — ADR-332 **D26**, ένα σημείο, μία αλήθεια.
 * @related editor/hooks/useSuggestionMapReport · AddressMapCandidateLayer · address-map-candidates
 * @module components/shared/addresses/useSuggestionMapBond
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΩΣ ΚΟΙΝΟ ΑΡΧΕΙΟ ΚΑΙ ΟΧΙ ΜΕΣΑ ΣΤΗΝ ΟΘΟΝΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο `AddressEditor` μονταρίζεται σε **έξι** σημεία *(πύλη: `proximity-anchor-reach`)*, και
 * τα μισά έχουν χάρτη δίπλα. Ο δεσμός είναι μετρημένα ~40 γραμμές κατάστασης· γραμμένος
 * μέσα στην πρώτη οθόνη, η δεύτερη θα τον **αντέγραφε** — και η CHECK 3.28 πιάνει τον
 * κλώνο **αφού** οι δύο εκδοχές αποκλίνουν, όχι πριν.
 *
 * ⚠️ **Και υπάρχει συγκεκριμένο πράγμα που θα αποκλίνει πρώτο**: το σβήσιμο της έμφασης
 * όταν αλλάζει ο κατάλογος. Χωρίς αυτό, μια ταυτότητα που κρατήθηκε από τον προηγούμενο
 * κατάλογο τονίζει **άλλη διεύθυνση** στον επόμενο. Είναι τρεις γραμμές που κανείς δεν
 * αντιγράφει επειδή κανείς δεν τις σκέφτεται.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏛️ Η ΙΔΙΟΚΤΗΣΙΑ ΤΗΣ ΚΑΤΑΣΤΑΣΗΣ — τοπική, όχι καθολική
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ιδιοκτήτης είναι ο **κοινός γονιός**, με `useState` — ίδιο precedent με τον δεσμό της
 * αναζήτησης ακινήτων (`SearchResultsContent:68`). Για πέντε γραμμές, ένα καθολικό store
 * θα ήταν υπερκατασκευή.
 *
 * ⛔ **ΚΑΙ ΡΗΤΑ ΟΧΙ ο `HoverStore`** *(`subapps/dxf-viewer/systems/hover/`)*: υπάρχει, αλλά
 * είναι φτιαγμένος για 60 fps με μηδέν React state πάνω σε χιλιάδες οντότητες σχεδίου.
 * Πέντε γραμμές καταλόγου δεν είναι το πρόβλημά του, και το βάρος του δεν πληρώνεται εδώ.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  toMapCandidates,
  type AddressMapCandidate,
} from '@/components/shared/addresses/address-map-candidates';
import type {
  AddressEditorSuggestionOptions,
  SuggestionMapReport,
} from '@/components/shared/addresses/editor';

/** Κανένας κατάλογος. Σταθερή τιμή ώστε η «καμία αλλαγή» να μην είναι αλλαγή. */
const NO_REPORT: SuggestionMapReport = {
  candidates: [],
  select: () => {},
  proximityAnchor: null,
};

export interface SuggestionMapBond {
  /**
   * Δίνεται στο `AddressEditorSuggestionOptions.onCandidatesChange`. **Σταθερή ταυτότητα**
   * *(setter του `useState`)*, οπότε δεν γίνεται η ίδια η καλωδίωση πηγή επανασχεδιάσεων.
   */
  readonly report: (report: SuggestionMapReport) => void;
  /** Οι υποψήφιοι όπως τους ζωγραφίζει ο χάρτης. Κενός πίνακας ⇒ δεν υπάρχει κατάλογος. */
  readonly candidates: readonly AddressMapCandidate[];
  readonly highlightedRank: number | null;
  /** Μία μορφή, δύο καταστάσεις — precedent `ListingCard.tsx:181-184`. */
  readonly setHighlightedRank: (rank: number | null) => void;
  /** Κλικ σε πινέζα ή δείκτη άκρης = η **ίδια** επιλογή με το κλικ στη γραμμή. */
  readonly select: (rank: number) => void;
  /** Η αφετηρία από την οποία μετρήθηκαν οι αποστάσεις — για το «δες τα όλα». */
  readonly anchor: { lat: number; lng: number } | null;
}

export function useSuggestionMapBond(): SuggestionMapBond {
  const [report, setReport] = useState<SuggestionMapReport>(NO_REPORT);
  const [highlightedRank, setHighlightedRank] = useState<number | null>(null);

  const candidates = useMemo(
    () => toMapCandidates(report.candidates),
    [report.candidates],
  );

  /*
    🔴 **Η ΕΜΦΑΣΗ ΣΒΗΝΕΙ ΟΤΑΝ ΑΛΛΑΖΕΙ Ο ΚΑΤΑΛΟΓΟΣ.** Η ταυτότητα (`originalRank`) είναι
    μοναδική **μέσα** σε έναν κατάλογο, όχι ανάμεσα σε δύο: ο επόμενος αριθμεί κι αυτός
    από το μηδέν. Κρατημένη έμφαση θα τόνιζε **άλλη διεύθυνση** από αυτή που δείχνει ο
    άνθρωπος — και θα φαινόταν απολύτως φυσιολογική.
  */
  useEffect(() => {
    setHighlightedRank(null);
  }, [report.candidates]);

  const { select, proximityAnchor } = report;

  return useMemo(
    () => ({
      report: setReport,
      candidates,
      highlightedRank,
      setHighlightedRank,
      select,
      anchor: proximityAnchor,
    }),
    [candidates, highlightedRank, select, proximityAnchor],
  );
}

/**
 * Οι ρυθμίσεις προτάσεων **μιας** φόρμας: η αφετηρία της, δεμένη στον κοινό δεσμό.
 *
 * ⚠️ **Καλείται μία φορά ανά φόρμα, και το `useMemo` δεν είναι διακόσμηση.** Το
 * `onCandidatesChange` μπαίνει σε πίνακα εξαρτήσεων μέσα στον συντάκτη: ένα φρέσκο
 * αντικείμενο σε κάθε render θα ξανάστηνε τον ακροατή, θα ξαναανέφερε τον κατάλογο, θα
 * άλλαζε την κατάσταση του γονιού — και θα ξανασχεδίαζε. **Βρόχος**, όχι απλώς σπατάλη.
 */
export function useSuggestionOptions(
  bond: SuggestionMapBond,
  proximityAnchor: { lat: number; lng: number } | undefined,
): AddressEditorSuggestionOptions {
  const { report, setHighlightedRank, highlightedRank } = bond;
  const onCandidateHighlight = useCallback(
    (rank: number | null) => setHighlightedRank(rank),
    [setHighlightedRank],
  );
  return useMemo(
    () => ({
      proximityAnchor,
      onCandidatesChange: report,
      onCandidateHighlight,
      highlightedCandidateRank: highlightedRank,
    }),
    [proximityAnchor, report, onCandidateHighlight, highlightedRank],
  );
}
