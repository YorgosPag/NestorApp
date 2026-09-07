'use client';

/**
 * @fileoverview **Η ΜΙΑ ΕΞΟΔΟΣ ΤΩΝ ΦΙΛΤΡΩΝ ΠΡΟΣ ΤΗ ΔΙΕΥΘΥΝΣΗ.**
 * @related ADR-777 §8.51 (Στάδιο 3) · ADR-777 Α3 · N.0.2 · N.18 (CHECK 3.28)
 * @module components/search-results/filters/use-filter-commit
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΓΕΝΝΗΘΗΚΕ — ΚΑΙ ΓΙΑΤΙ ΤΟ `StayFilterFields` ΤΟ ΚΑΛΕΙ ΠΛΕΟΝ ΚΙ ΑΥΤΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `StayFilterFields` είχε ήδη γράψει τη σωστή τρίγραμμη:
 *
 * ```ts
 * function commit(next: ListingFilters): void {
 *   router.push(searchResultsHref(serializeListingFilters(next).toString()));
 * }
 * ```
 *
 * με τον λόγο γραμμένο δίπλα της: *«κάθε έλεγχος περνά από εδώ, ώστε η κανονικοποίηση
 * να γίνεται ΜΙΑ φορά — δύο σημεία που έγραφαν διεύθυνση θα παρήγαγαν δύο διαφορετικούς
 * συνδέσμους για την ίδια ερώτηση»*.
 *
 * ⚠️ **Το Στάδιο 3 προσθέτει τρία ακόμη σημεία** *(γραμμή φίλτρων · πάνελ · καθαρισμός)*.
 * Αντιγραμμένη τέσσερις φορές, η ίδια τρίγραμμη θα ήταν ο **ακριβής δίδυμος κλώνος
 * μέσα σε ένα diff** που το `jscpd --diff` (N.18 · CHECK 3.28) υπάρχει για να πιάσει —
 * και το επιχείρημα του ίδιου του `StayFilterFields` θα είχε παραβιαστεί από τον
 * διάδοχό του.
 *
 * ⇒ Γράφεται **μία φορά**, εδώ, και το `StayFilterFields` **μετατράπηκε να την καλεί**
 * *(Boy Scout, N.0.2)*.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΚΑΜΙΑ `useState` ΓΙΑ ΤΙΜΗ ΦΙΛΤΡΟΥ — ΤΟ ΙΔΙΩΜΑ ΔΕΝ ΑΛΛΑΖΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Κάθε έλεγχος **διαβάζει** από τα `filters` που ήρθαν από τη διεύθυνση και **γράφει**
 * κατευθείαν πίσω σε αυτήν. Δύο αντίγραφα της ίδιας ερώτησης θα διαφωνούσαν στο πρώτο
 * «πίσω» του περιηγητή — και ο **κοινοποιημένος σύνδεσμος**, που είναι ολόκληρος ο
 * λόγος ύπαρξης της Α3, θα έδειχνε άλλα φίλτρα από αυτά που άφησε ο αποστολέας.
 */

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

import { useRouter } from '@/lib/workspace/navigation';
import type { CriterionRange } from '@/lib/criteria/criterion-vocabulary';
import type {
  CriterionKey,
  FlagCriterionKey,
  RangeCriterionKey,
  ValueSetCriterionKey,
} from '@/lib/criteria/listing-criterion-asking';
import {
  without,
  withFlag,
  withRange,
  withValues,
} from '@/lib/criteria/listing-criteria';
import { EMPTY_LISTING_CRITERIA } from '@/lib/criteria/listing-criteria';
import {
  serializeListingFilters,
  type ListingFilters,
} from '@/lib/listings/listing-filters';
import {
  parseListingOrder,
  writeListingOrder,
  type ListingOrder,
} from '@/lib/listings/listing-results-order';
import { searchResultsHref } from '@/lib/listings/listing-routes';

/** Ό,τι μπορεί να ζητήσει ένα χειριστήριο από τη διεύθυνση. */
export interface FilterCommit {
  /** Γράψε **ολόκληρα** τα φίλτρα. Η χαμηλότερη βαθμίδα — τη χρειάζεται η διαμονή. */
  readonly commit: (next: ListingFilters) => void;
  readonly setRange: (key: RangeCriterionKey, range: CriterionRange) => void;
  readonly setValues: (key: ValueSetCriterionKey, values: readonly string[]) => void;
  readonly setFlag: (key: FlagCriterionKey, value: boolean | undefined) => void;
  /** Ξε-ρώτα **έναν** άξονα, όποιο κι αν είναι το σχήμα του. */
  readonly clearAxis: (key: CriterionKey) => void;
  /**
   * Ξε-ρώτα **κάθε** άξονα του χάρτη.
   *
   * ⚠️ **Η γεωγραφία, το παράθυρο και τα άτομα ΔΕΝ καθαρίζονται, και είναι απόφαση.**
   * Ο άνθρωπος που πατά «Καθαρισμός όλων» μέσα στο πάνελ κριτηρίων ζητά να φύγουν τα
   * **κριτήρια** — όχι να τον πετάξουμε από την περιοχή που διάλεξε στον χάρτη ή από
   * τις ημερομηνίες του ταξιδιού του. Είναι ο ίδιος λόγος που εκείνοι οι τρεις άξονες
   * μένουν **εκτός** του χάρτη κριτηρίων (`AXES_OUTSIDE_THE_CRITERIA_MAP`).
   */
  readonly clearAllCriteria: () => void;
  /**
   * **Άλλαξε τη ΣΕΙΡΑ**, αφήνοντας κάθε φίλτρο ανέγγιχτο.
   *
   * ⚠️ **Η σειρά ΔΕΝ είναι φίλτρο** και γι' αυτό δεν ζει μέσα στο {@link ListingFilters}:
   * κάθε πεδίο εκεί απαντά *«τι ρώτησε ο επισκέπτης για τα ακίνητα;»*, ενώ αυτό απαντά
   * *«πώς θέλει να τα δει;»*. Ζει όμως στην **ίδια** διεύθυνση, γιατί η Α3 το απαιτεί:
   * ο κοινοποιημένος σύνδεσμος οφείλει να δείχνει ό,τι άφησε ο αποστολέας.
   */
  readonly setOrder: (order: ListingOrder) => void;
}

export function useFilterCommit(filters: ListingFilters): FilterCommit {
  const router = useRouter();
  const searchParams = useSearchParams();

  /**
   * 🔴 **Η ΣΕΙΡΑ ΔΙΑΒΑΖΕΤΑΙ ΑΠΟ ΤΗ ΔΙΕΥΘΥΝΣΗ, ΟΧΙ ΑΠΟ ΟΡΙΣΜΑ — ΚΑΙ ΕΙΝΑΙ ΔΟΜΙΚΟ.**
   *
   * Η εναλλακτική ήταν να περάσει ως δεύτερο όρισμα του `useFilterCommit`. Θα δούλευε,
   * και θα ήταν **εύθραυστη**: κάθε καλών (`PrimaryFilterBar`, `StayFilterFields`, και
   * όποιος προστεθεί αύριο) θα έπρεπε να **θυμηθεί** να το περάσει, και όποιος το
   * ξεχνούσε θα **έσβηνε σιωπηλά** τη σειρά του ανθρώπου με το πρώτο φίλτρο που θα
   * άλλαζε. Διαβασμένη εδώ, από την ίδια τη διεύθυνση που πρόκειται να ξαναγραφτεί, η
   * διατήρηση είναι **αδύνατο** να ξεχαστεί.
   */
  const currentOrder = useMemo(
    () => parseListingOrder(new URLSearchParams(searchParams?.toString() ?? '')),
    [searchParams]
  );

  /**
   * 🔑 **Η ΜΙΑ ΕΞΟΔΟΣ.** Κάθε έλεγχος περνά από εδώ, ώστε η κανονικοποίηση
   * (`serializeListingFilters`) να γίνεται **μία** φορά: δύο ταυτόσημες αναζητήσεις
   * οφείλουν να παράγουν **χαρακτήρα προς χαρακτήρα** την ίδια διεύθυνση, αλλιώς μια
   * μηχανή αναζήτησης βλέπει δύο σελίδες με ταυτόσημο περιεχόμενο.
   *
   * ⚠️ **Τα φίλτρα και η σειρά γράφονται ΜΑΖΙ, στο ίδιο αντικείμενο παραμέτρων** — για
   * τον ίδιο λόγο που το `serializeListingFilters` γράφει τον χάρτη και τους τρεις
   * ειδικούς μαζί: μια συγχώνευση δύο `URLSearchParams` είναι η θέση όπου χάνεται το ένα.
   */
  const write = useCallback(
    (next: ListingFilters, order: ListingOrder): void => {
      const params = serializeListingFilters(next);
      writeListingOrder(order, params);
      router.push(searchResultsHref(params.toString()));
    },
    [router]
  );

  const commit = useCallback(
    (next: ListingFilters): void => write(next, currentOrder),
    [write, currentOrder]
  );

  return useMemo(() => {
    /** Γράψε **έναν** άξονα του χάρτη, αφήνοντας τους τρεις ειδικούς ανέγγιχτους. */
    const commitCriteria = (criteria: ListingFilters['criteria']): void =>
      commit({ ...filters, criteria });

    return {
      commit,
      setRange: (key, range) => commitCriteria(withRange(filters.criteria, key, range)),
      setValues: (key, values) => commitCriteria(withValues(filters.criteria, key, values)),
      setFlag: (key, value) => commitCriteria(withFlag(filters.criteria, key, value)),
      clearAxis: (key) => commitCriteria(without(filters.criteria, key)),
      clearAllCriteria: () => commitCriteria(EMPTY_LISTING_CRITERIA),
      // ⚠️ Περνά τα **τρέχοντα** φίλτρα αυτούσια: αλλαγή σειράς δεν είναι αλλαγή
      //    ερώτησης, και δεν επιτρέπεται να ξε-ρωτήσει τίποτα.
      setOrder: (order) => write(filters, order),
    };
  }, [commit, write, filters]);
}
