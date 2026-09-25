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

import { useCallback, useEffect, useRef, useState } from 'react';

import { sameMapArea } from '@/components/search-results/results-map-area';
import { searchRegionId, type ListingSearch } from '@/lib/listings/listing-filters';
import { drawnAreaKey, searchDrawnArea } from '@/lib/listings/listing-drawn-area';
import type { GeoBoundingBox, GeoDrawnArea } from '@/types/geo/coordinates';

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
  /**
   * **«Αφαίρεση ορίου»** *(ADR-883)* — το όριο δίνει τη θέση του στο **ορατό κάδρο**.
   *
   * 🔑 **Όχι σε «καμία περιοχή»**: ο επισκέπτης που βγάζει το όριο του Ευόσμου κοιτάει
   * ακόμη τον Εύοσμο. Αν η λίστα γινόταν ξαφνικά *«όλη η Ελλάδα»*, η οθόνη θα άλλαζε
   * κάτι που **δεν ζήτησε**. Έτσι το κάνει και το Zillow: τα αποτελέσματα μένουν, το
   * περίγραμμα φεύγει.
   *
   * ⚠️ **`framed` = το ορθογώνιο του ορίου, ως εφεδρεία**: ο χάρτης αναφέρει μόνο κινήσεις
   * **του ανθρώπου** (`originalEvent`) — το αυτόματο πλαισίωμα στο όριο **δεν** αναφέρεται.
   * Όποιος πατά «Αφαίρεση» χωρίς να έχει αγγίξει τον χάρτη κοιτάει **ακριβώς** το ορθογώνιο
   * του ορίου· χωρίς εφεδρεία η περιοχή θα γινόταν σιωπηλά «όλη η Ελλάδα».
   */
  readonly removeRegion: (framed: GeoBoundingBox | null) => void;
  /** Ζήτα **άλλη** διοικητική περιοχή — π.χ. ανέβασμα στον γονέα από τη γραμμή γενεαλογίας. */
  readonly selectRegion: (adminId: string) => void;
  /**
   * **«Εφαρμογή»** της σχεδίασης *(ADR-885)* — η περιοχή που σχεδίασε ο επισκέπτης γίνεται
   * το `near`. Από εδώ και πέρα συμπεριφέρεται **ακριβώς** όπως το όριο: η κίνηση του
   * χάρτη δεν την αντικαθιστά, και η «Αφαίρεση ορίου» ({@link removeRegion}) τη βγάζει.
   */
  readonly applyDrawnArea: (area: GeoDrawnArea) => void;
}

/**
 * @param filters Τα φίλτρα **όπως τα διάβασε η οθόνη από τη διεύθυνση**.
 * @param commit  Η **μία** έξοδος προς τη διεύθυνση (`useFilterCommit`). Δεύτερος
 *   γραφέας εδώ θα παρήγαγε διαφορετικό σύνδεσμο για την ίδια ερώτηση.
 */
export function useMapAreaSearch(
  filters: ListingSearch,
  commit: (next: ListingSearch) => void
): MapAreaSearch {
  const [followMap, setFollowMapState] = useState(false);
  const [pendingArea, setPendingArea] = useState<GeoBoundingBox | null>(null);
  // Το τελευταίο κάδρο που ανέφερε ο χάρτης — το χρειάζεται μόνο η «Αφαίρεση ορίου».
  // Ref, όχι state: κάθε σύρσιμο θα ξανα-απέδιδε την οθόνη για τιμή που δεν δείχνει κανείς.
  const viewportRef = useRef<GeoBoundingBox | null>(null);
  // ADR-885: το σχέδιο **κλειδώνει** την περιοχή όπως το όριο — δύο πηγές, ένα κλείδωμα.
  const drawn = searchDrawnArea(filters.near);
  const boundaryKey = searchRegionId(filters.near) ?? (drawn === null ? null : drawnAreaKey(drawn));
  const boundaryActive = boundaryKey !== null;
  // Νέα περιοχή ⇒ ο χάρτης πλαισιώνεται ξανά **μόνος του** (δεν αναφέρεται)· το κάδρο που
  // είχε αναφερθεί πριν ανήκει σε **άλλη** ερώτηση και δεν επιτρέπεται να επιβιώσει.
  useEffect(() => {
    viewportRef.current = null;
  }, [boundaryKey]);

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
      viewportRef.current = area;
      // 🔑 ADR-883: **το όριο δεν αντικαθίσταται από κίνηση**. Είναι ρητή επιλογή από
      //    λίστα — ισχυρότερη δήλωση από ένα σύρσιμο — και το πλαισίωμα στο όριο είναι
      //    ο ίδιος ο χάρτης που **κινείται μόνος του**. Έξοδος: «Αφαίρεση ορίου».
      if (boundaryActive) return;

      const current = filters.near;
      const alreadyAsked =
        current !== null && 'south' in current && sameMapArea(current, area);
      if (alreadyAsked) return;

      if (followMap) applyArea(area);
      else setPendingArea(area);
    },
    [filters.near, boundaryActive, followMap, applyArea]
  );

  const removeRegion = useCallback(
    (framed: GeoBoundingBox | null): void => {
      setPendingArea(null);
      commit({ ...filters, near: viewportRef.current ?? framed });
    },
    [commit, filters]
  );

  const selectRegion = useCallback(
    (adminId: string): void => {
      setPendingArea(null);
      commit({ ...filters, near: { adminId } });
    },
    [commit, filters]
  );

  const applyDrawnArea = useCallback(
    (area: GeoDrawnArea): void => {
      setPendingArea(null);
      commit({ ...filters, near: area });
    },
    [commit, filters]
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

  return {
    followMap,
    setFollowMap,
    pendingArea,
    onAreaChange,
    applyPendingArea,
    removeRegion,
    selectRegion,
    applyDrawnArea,
  };
}
