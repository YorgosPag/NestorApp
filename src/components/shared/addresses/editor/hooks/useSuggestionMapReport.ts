'use client';

/**
 * @fileoverview **ΤΙ ΔΕΙΧΝΕΙ Ο ΚΑΤΑΛΟΓΟΣ, ΓΙΑ ΟΠΟΙΟΝ ΤΟΝ ΖΩΓΡΑΦΙΖΕΙ ΑΛΛΟΥ** — ADR-332 **D26**.
 * @related editor/types (`SuggestionMapReport`) · AddressMapCandidateLayer
 * @module components/shared/addresses/editor/hooks/useSuggestionMapReport
 *
 * Ο συντάκτης κρατά τους υποψήφιους· ο **χάρτης** ζει σε άλλο κλαδί του δέντρου, στον
 * γονιό. Αυτό το αρχείο είναι η **μία** γέφυρα ανάμεσά τους, και όλη του η αξία είναι
 * τρεις εγγυήσεις που, γραμμένες διάσπαρτα, θα σπάσουν μία-μία:
 *
 * 1. **Αναφέρεται ό,τι ΖΩΓΡΑΦΙΖΕΤΑΙ, όχι ό,τι βρέθηκε.** Στο `advisory` το πάνελ δείχνει
 *    τον λόγο, όχι κατάλογο — πινέζες εκεί θα ήταν χάρτης που απαντά σε ερώτηση την
 *    οποία κανείς δεν έθεσε. Η εναλλακτική *(«ας το ξανακρίνει ο καλών»)* είναι η
 *    «παράμετρος-κατηγόρημα που ο καλών μπορεί να ξεχάσει» (μάθημα D24/D25).
 * 2. **Το ξεμοντάρισμα σβήνει.** Κλείνει η φόρμα ⇒ φεύγουν οι πινέζες. Χωρίς αυτό ο
 *    χάρτης θα κρατούσε προτάσεις για ερώτηση που δεν ρωτιέται πια.
 * 3. **Η πράξη επιλογής έχει σταθερή ταυτότητα.** Δες `SuggestionMapReport.select`.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { SuggestionPresentation } from '../helpers/computeSuggestionTriggers';
import type {
  GeocodingApiResponse,
  SuggestionMapReport,
  SuggestionRanking,
} from '../types';

/**
 * Ο κενός κατάλογος, **μία φορά**. Ένα φρέσκο `[]` σε κάθε render θα ξαναπυροδοτούσε τον
 * ακροατή του καλούντος για την ίδια — ανύπαρκτη — αλλαγή.
 */
const NO_CANDIDATES: readonly SuggestionRanking[] = [];

export interface UseSuggestionMapReportParams {
  /** Όλοι οι κατατεταγμένοι υποψήφιοι, όπως τους δίνει το `useAddressSuggestions`. */
  readonly candidates: readonly SuggestionRanking[];
  /** Ο τρόπος του πάνελ — **μόνο** το `chooser` ζωγραφίζει γραμμές. */
  readonly presentation: SuggestionPresentation;
  /** Η αφετηρία που δόθηκε στην κατάταξη· ταξιδεύει μαζί με την αναφορά. */
  readonly proximityAnchor?: { lat: number; lng: number };
  /** Ο παραλήπτης. Απών ⇒ ο βρόχος δεν στήνεται καν. */
  readonly onReport?: (report: SuggestionMapReport) => void;
  /**
   * Η **πραγματική** επιλογή του συντάκτη (`handleSuggestionSelect`) — με αναίρεση,
   * χαρακτηρισμό πεδίων και τηλεμετρία.
   *
   * ⚠️ Επιτρέπεται να αλλάζει ταυτότητα σε κάθε render· ο τυλιγμένος δείκτης που φεύγει
   * προς τα έξω **δεν** αλλάζει.
   */
  readonly onSelect: (candidate: GeocodingApiResponse) => void;
}

export function useSuggestionMapReport({
  candidates,
  presentation,
  proximityAnchor,
  onReport,
  onSelect,
}: UseSuggestionMapReportParams): void {
  /** Ό,τι ζωγραφίζεται ως γραμμές — τίποτα άλλο. */
  const visibleCandidates = useMemo<readonly SuggestionRanking[]>(
    () => (presentation === 'chooser' ? candidates : NO_CANDIDATES),
    [presentation, candidates],
  );

  /*
    🔑 **Σταθερή ταυτότητα, φρέσκο περιεχόμενο.** Το `onSelect` του συντάκτη αλλάζει
    ταυτότητα σε **κάθε πληκτρολόγηση** (εξαρτάται από το `onChange` του γονιού). Αν την
    κουβαλούσε ευθέως η αναφορά, ο γονιός θα αποθήκευε νέο αντικείμενο σε κάθε πλήκτρο —
    δηλαδή ο χάρτης θα ξανασχεδίαζε τις πινέζες όσο γράφει ο άνθρωπος.

    Η ανάθεση γίνεται σε **effect**, όχι στη ζωγραφική: γράψιμο σε `ref` κατά το render
    δεν είναι ασφαλές σε ταυτόχρονη απόδοση, και εδώ ο δείκτης διαβάζεται μόνο από
    χειριστή συμβάντος — δηλαδή πάντα μετά το commit.
  */
  const selectRef = useRef<(rank: number) => void>(() => {});
  useEffect(() => {
    selectRef.current = (rank: number) => {
      const match = candidates.find((ranking) => ranking.originalRank === rank);
      // Άγνωστη ταυτότητα ⇒ **τίποτα**. Ο κατάλογος μπορεί να άλλαξε κάτω από τον δείκτη,
      // και μια «κοντινή» επιλογή θα ήταν χειρότερη από καμία.
      if (match) onSelect(match.candidate);
    };
  });
  const select = useCallback((rank: number) => selectRef.current(rank), []);

  const anchor = proximityAnchor ?? null;
  useEffect(() => {
    if (!onReport) return undefined;
    onReport({ candidates: visibleCandidates, select, proximityAnchor: anchor });
    return () => onReport({ candidates: NO_CANDIDATES, select, proximityAnchor: null });
  }, [onReport, visibleCandidates, select, anchor]);
}
