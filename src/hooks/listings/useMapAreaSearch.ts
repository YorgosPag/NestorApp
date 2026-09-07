'use client';

/**
 * # Ο ΔΙΑΚΟΠΤΗΣ ΤΟΥ ΧΑΡΤΗ — **ΠΟΙΟΣ ΑΠΟΦΑΣΙΖΕΙ ΟΤΙ ΤΟ ΚΑΔΡΟ ΕΙΝΑΙ ΕΡΩΤΗΣΗ** (ADR-777 §8.63)
 *
 * Ο χάρτης **αναφέρει** πού κοιτάει· εδώ κρίνεται αν αυτό γίνεται **ερώτημα**.
 *
 * ## 🔑 ΔΥΟ ΠΡΑΓΜΑΤΑ, ΔΥΟ ΜΗΧΑΝΙΣΜΟΙ — ΠΟΤΕ ΕΝΑΣ ΜΕ «Ή» *(πρότυπο CHECK 3.41)*
 *
 * | Τι | Είναι | Πού ζει | Γιατί |
 * |---|---|---|---|
 * | **Η περιοχή** | *ερώτημα* | **διεύθυνση** (`box=…`) | ο κοινοποιημένος σύνδεσμος οφείλει να δείχνει την ίδια περιοχή (Α3) |
 * | **Ο διακόπτης** | *προτίμηση* | **`localStorage`** | είναι συνήθεια **του ανθρώπου**, όχι της αναζήτησης |
 *
 * 🔴 **Ο διακόπτης ΔΕΝ μπαίνει στη διεύθυνση, και είναι απόφαση.** Θα ήταν εύκολο —
 * ένα ακόμη κλειδί δίπλα στα άλλα. Θα σήμαινε όμως ότι ένας σύνδεσμος **επιβάλλει**
 * τη συνήθεια του αποστολέα στον παραλήπτη: ανοίγεις τον σύνδεσμο ενός φίλου και ο
 * χάρτης σου αρχίζει ξαφνικά να ξαναγράφει τη λίστα σε κάθε σύρσιμο, χωρίς εσύ να
 * το έχεις ζητήσει ποτέ. Η **περιοχή** ταξιδεύει· η **συνήθεια** μένει.
 *
 * ## ⚠️ Η ΠΡΟΕΠΙΛΟΓΗ ΕΙΝΑΙ «ΚΛΕΙΣΤΟΣ», ΚΑΙ ΕΧΕΙ ΔΥΟ ΑΝΕΞΑΡΤΗΤΟΥΣ ΛΟΓΟΥΣ
 *
 * 1. **Μετρημένη εμπειρία τρίτων**: τα καταγεγραμμένα παράπονα χρηστών για την
 *    Airbnb αφορούν ακριβώς το **αυτόματο** — *«η παραμικρή κίνηση κάνει καταλύματα
 *    να εμφανίζονται και να εξαφανίζονται»*, με το πλήθος να κυμαίνεται. *(Το
 *    **φαινόμενο** είναι τεκμηριωμένο· η **πρόθεση** του σχεδιαστή τους **όχι** — και
 *    δεν αναπαράγεται εδώ ως γεγονός.)* Το NN/g περιγράφει τον χάρτη ως
 *    **προαιρετικό** στρώμα, με τη λίστα πρωτεύουσα.
 * 2. **Δομικός**: το `false` είναι η μόνη τιμή που ο διακομιστής **ξέρει** πριν
 *    διαβαστεί το `localStorage`. Κάθε άλλη προεπιλογή θα σήμαινε ασυμφωνία
 *    πρώτου βαψίματος — δηλαδή η λίστα θα άλλαζε μπροστά στα μάτια του επισκέπτη
 *    χωρίς να έχει αγγίξει τίποτα.
 */

import { useCallback, useEffect, useState } from 'react';

import { sameMapArea } from '@/components/search-results/results-map-area';
import type { ListingFilters } from '@/lib/listings/listing-filters';
import type { GeoBoundingBox } from '@/types/geo/coordinates';

/**
 * ⚠️ **Το πρόθεμα `nestor.` είναι σύμβαση, όχι διακόσμηση**: το `localStorage` είναι
 * **κοινό** για ολόκληρη την προέλευση, και ένα σκέτο `followMap` θα συγκρουόταν με
 * οποιοδήποτε άλλο κομμάτι της εφαρμογής διάλεγε την ίδια λέξη.
 */
const FOLLOW_MAP_STORAGE_KEY = 'nestor.search.followMap';

export interface MapAreaSearch {
  /** Ξαναγράφεται η λίστα μόνη της σε κάθε σύρσιμο; */
  readonly followMap: boolean;
  /** Άλλαξε τη συνήθεια — και **εφάρμοσε αμέσως** ό,τι εκκρεμεί. */
  readonly setFollowMap: (next: boolean) => void;
  /**
   * Το κάδρο που ο άνθρωπος έφτιαξε αλλά **δεν έχει ζητήσει ακόμη**, ή `null`.
   *
   * 🔑 Είναι το ίδιο το κουμπί *«Αναζήτηση σε αυτή την περιοχή»*: όσο δεν είναι
   * `null`, υπάρχει κάτι να προσφερθεί· μόλις εφαρμοστεί, το κουμπί **εξαφανίζεται
   * επειδή δεν έχει πια τι να πει** — όχι επειδή κάποιος το έκρυψε.
   */
  readonly pendingArea: GeoBoundingBox | null;
  /** Ο χάρτης σταμάτησε να κινείται και αναφέρει. */
  readonly onAreaChange: (area: GeoBoundingBox) => void;
  /** Ο άνθρωπος πάτησε «Αναζήτηση σε αυτή την περιοχή». */
  readonly applyPendingArea: () => void;
}

/**
 * @param filters Τα φίλτρα **όπως τα διάβασε η οθόνη από τη διεύθυνση**.
 * @param commit  Η **μία** έξοδος προς τη διεύθυνση (`useFilterCommit`). Δεύτερος
 *   γραφέας εδώ θα παρήγαγε διαφορετικό σύνδεσμο για την ίδια ερώτηση.
 */
export function useMapAreaSearch(
  filters: ListingFilters,
  commit: (next: ListingFilters) => void
): MapAreaSearch {
  const [followMap, setFollowMapState] = useState(false);
  const [pendingArea, setPendingArea] = useState<GeoBoundingBox | null>(null);

  /**
   * ⚠️ **Η ανάγνωση ζει σε `useEffect`, ΠΟΤΕ στην αρχική τιμή του `useState`.** Το
   * `localStorage` δεν υπάρχει στον διακομιστή· διαβασμένο στην απόδοση, θα έσκαγε
   * στο SSR ή — χειρότερα — θα παρήγαγε **διαφορετικό** HTML από τον πελάτη
   * *(hydration mismatch)*. Ίδιο ιδίωμα με το `useDensity`.
   *
   * ⚠️ **`try/catch` υποχρεωτικό**: σε ιδιωτικό παράθυρο ή με μπλοκαρισμένα δεδομένα
   * ιστότοπου, **ο ίδιος ο accessor πετά**. Μια αποτυχία εδώ δεν επιτρέπεται να
   * ρίξει την οθόνη αναζήτησης για μια **συνήθεια**.
   */
  useEffect(() => {
    try {
      setFollowMapState(window.localStorage.getItem(FOLLOW_MAP_STORAGE_KEY) === 'true');
    } catch {
      // Η προεπιλογή («κλειστός») είναι ήδη σωστή — δεν υπάρχει τίποτα να διορθωθεί.
    }
  }, []);

  /**
   * 🔑 **Η γραφή στη διεύθυνση περνά ΠΑΝΤΑ από εδώ.** Το ορθογώνιο **αντικαθιστά**
   * ό,τι υπήρχε στο `near` — κύκλο ή προηγούμενο ορθογώνιο — γιατί είναι η **νεότερη**
   * δήλωση του ανθρώπου για το πού κοιτάει. Δύο γεωγραφικές δηλώσεις ταυτόχρονα θα
   * ήταν δύο απαντήσεις στην ίδια ερώτηση *(δες `ListingFilters.near`)*.
   */
  const applyArea = useCallback(
    (area: GeoBoundingBox): void => {
      setPendingArea(null);
      commit({ ...filters, near: area });
    },
    [commit, filters]
  );

  /**
   * ⚠️ **Ο έλεγχος ταυτότητας ΔΕΝ είναι βελτιστοποίηση — είναι ο φραγμός της
   * ανάδρασης.** Ο χάρτης αναφέρει και μετά από κινήσεις που **δεν** άλλαξαν το κάδρο
   * *(μια στιγμιαία σύρση που επέστρεψε στη θέση της)*· χωρίς αυτόν, κάθε τέτοια
   * αναφορά θα έγραφε **νέα** εγγραφή στο ιστορικό του περιηγητή, και το «πίσω» του
   * επισκέπτη θα σταματούσε να λειτουργεί.
   */
  const onAreaChange = useCallback(
    (area: GeoBoundingBox): void => {
      const current = filters.near;
      const alreadyAsked =
        current !== null && 'south' in current && sameMapArea(current, area);
      if (alreadyAsked) return;

      if (followMap) applyArea(area);
      else setPendingArea(area);
    },
    [filters.near, followMap, applyArea]
  );

  /**
   * 🔑 **Το άναμμα του διακόπτη ΕΦΑΡΜΟΖΕΙ ό,τι εκκρεμεί, στην ίδια πράξη.**
   * Ο άνθρωπος που είδε το κουμπί, δίστασε και άναψε τον διακόπτη είπε **ναι** — και
   * μια οθόνη που θα του ζητούσε να πατήσει **και** το κουμπί θα τον ρωτούσε δύο
   * φορές το ίδιο πράγμα.
   */
  const setFollowMap = useCallback(
    (next: boolean): void => {
      setFollowMapState(next);
      try {
        window.localStorage.setItem(FOLLOW_MAP_STORAGE_KEY, String(next));
      } catch {
        // Η συνήθεια δεν θα επιβιώσει της συνεδρίας. Η οθόνη λειτουργεί κανονικά.
      }
      if (next && pendingArea !== null) applyArea(pendingArea);
    },
    [pendingArea, applyArea]
  );

  const applyPendingArea = useCallback((): void => {
    if (pendingArea !== null) applyArea(pendingArea);
  }, [pendingArea, applyArea]);

  return { followMap, setFollowMap, pendingArea, onAreaChange, applyPendingArea };
}
