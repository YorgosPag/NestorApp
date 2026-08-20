/**
 * @fileoverview **ΑΓΚΥΡΕΣ: Ο ΣΥΝΔΕΣΜΟΣ ΔΕΝ ΣΕ ΠΑΕΙ ΑΛΛΟΥ** (ADR-777 §8.31).
 * @related hooks/entity-selection-state · hooks/useEntityPageState
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΟΥΝ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `useEntityPageState` (ADR-203) απαντούσε *«ποια εγγραφή ζητήθηκε;»* μέσα σε
 * μια `useEffect`, με **τρεις** σιωπηλές αστοχίες. Καμία δεν έσπαγε τίποτα —
 * γι' αυτό επέζησαν: η σελίδα φόρτωνε, ο σύνδεσμος ήταν έγκυρος, **και ο
 * άνθρωπος έβλεπε άλλο κτίριο από αυτό που ζήτησε**.
 *
 * 🔑 **Η `Κ9` είναι η μόνη που θα είχε πιάσει το ζωντανό ελάττωμα.** Ένα test που
 * επιβεβαιώνει μόνο ότι «η σωστή ταυτότητα επιλέγεται» είναι **πράσινο πάνω στο
 * ελάττωμα**: η βλάβη δεν ήταν στην επιτυχία, ήταν στο τι γίνεται στην
 * **αποτυχία**.
 */

import {
  deriveEntitySelection,
  mayAutoSelectFirst,
  type EntitySelection,
} from '../entity-selection-state';

interface Thing {
  readonly id: string;
  readonly name: string;
  readonly deletedAt?: string;
}

const A: Thing = { id: 'bld_A', name: 'Κτίριο Α' };
const B: Thing = { id: 'bld_B', name: 'Κτίριο Β' };
const GONE: Thing = { id: 'bld_G', name: 'Κτίριο Γ', deletedAt: '2026-08-01' };

const base = {
  requestedId: 'bld_A' as string | null,
  hasAnswered: true,
  items: [A, B] as readonly Thing[],
};

describe('ADR-777 §8.31 — deriveEntitySelection: καμία σιωπηλή κατάσταση', () => {
  // ==========================================================================
  // Κ1 — 🔴 «ΔΕΝ ΦΟΡΤΩΝΩ» ≠ «ΚΟΙΤΑΞΑ» (μάθημα Μ-Α του §8.30)
  // ==========================================================================

  it('Κ1 🔴 άδεια λίστα που ΔΕΝ έχει απαντήσει ⇒ resolving, ΠΟΤΕ not-found', () => {
    /*
     * Αυτή ήταν η γρ. 145 του `useEntityPageState`: `if (!items.length) return;`
     * Άδεια λίστα σήμαινε **ταυτόχρονα** «δεν φόρτωσε ακόμη» και «δεν υπάρχει».
     * Το σχήμα «0 = κανείς δεν κοίταξε», στραμμένο στον χρήστη.
     */
    const state = deriveEntitySelection<Thing>({
      requestedId: 'bld_A',
      hasAnswered: false,
      items: [],
    });

    expect(state).toEqual({ kind: 'resolving', requestedId: 'bld_A' });
    expect(state.kind).not.toBe('not-found');
  });

  it('Κ2 η σειρά ΕΙΝΑΙ το συμβόλαιο: το hasAnswered κρίνεται ΠΡΙΝ τη λίστα', () => {
    // Η εγγραφή είναι **μπροστά μας** — και πάλι δεν την ανακοινώνουμε, γιατί η
    // πηγή δεν έχει βεβαιώσει ότι η λίστα είναι πλήρης. Αν αντιστραφεί η σειρά
    // των δύο ελέγχων, αυτό γίνεται 'selected' και η Κ1 μένει πράσινη.
    const state = deriveEntitySelection<Thing>({ ...base, hasAnswered: false });
    expect(state.kind).toBe('resolving');
  });

  it('Κ3 απάντησε και δεν υπάρχει πουθενά ⇒ not-found (με την ταυτότητα μέσα)', () => {
    const state = deriveEntitySelection<Thing>({ ...base, requestedId: 'bld_X' });
    expect(state).toEqual({ kind: 'not-found', requestedId: 'bld_X' });
  });

  it('Κ4 βρέθηκε στην ενεργή λίστα ⇒ selected, και ταξιδεύει η ΙΔΙΑ η εγγραφή', () => {
    const state = deriveEntitySelection<Thing>(base);
    expect(state).toEqual({ kind: 'selected', item: A });
  });

  it('Κ5 καμία ταυτότητα στη διεύθυνση ⇒ none', () => {
    expect(deriveEntitySelection<Thing>({ ...base, requestedId: null }).kind).toBe('none');
  });

  // ==========================================================================
  // Κ6-Κ8 — Ο ΚΑΔΟΣ: ανάκτηση, όχι «δεν βρέθηκε» (πρότυπο GitLab / Drive)
  // ==========================================================================

  it('Κ6 βρέθηκε στον κάδο ⇒ archived (ώστε να μπει πανό επαναφοράς)', () => {
    const state = deriveEntitySelection<Thing>({
      ...base,
      requestedId: 'bld_G',
      archivedItems: [GONE],
    });
    expect(state).toEqual({ kind: 'archived', item: GONE });
  });

  it('Κ7 η ενεργή λίστα προηγείται του κάδου για την ίδια ταυτότητα', () => {
    // Παροδική κατάσταση αμέσως μετά την επαναφορά: η εγγραφή υπάρχει και στις
    // δύο λίστες. Η ζωντανή αλήθεια είναι η ενεργή.
    const state = deriveEntitySelection<Thing>({ ...base, archivedItems: [A] });
    expect(state.kind).toBe('selected');
  });

  it('Κ8 το κατηγόρημα χαρακτηρίζει ό,τι έφερε η ΕΦΕΔΡΕΙΑ, που δεν ξέρει λίστα', () => {
    const state = deriveEntitySelection<Thing>({
      ...base,
      requestedId: 'bld_G',
      fallback: { phase: 'settled', item: GONE },
      isArchived: (t) => Boolean(t.deletedAt),
    });
    expect(state).toEqual({ kind: 'archived', item: GONE });
  });

  // ==========================================================================
  // Κ9 — 🔴 Η ΑΓΚΥΡΑ ΠΟΥ ΘΑ ΕΙΧΕ ΠΙΑΣΕΙ ΤΟ ΖΩΝΤΑΝΟ ΕΛΑΤΤΩΜΑ
  // ==========================================================================

  it('Κ9 🔴 ρητή ταυτότητα ⇒ ΠΟΤΕ αυτόματη επιλογή άλλης εγγραφής', () => {
    /*
     * 🔴 ΤΟ ΖΩΝΤΑΝΟ ΕΛΑΤΤΩΜΑ. Το `useBuildingsPageState` ήταν ο **μόνος** από τους
     * τέσσερις καταναλωτές που δεν δήλωνε `autoSelectFirstItem` ⇒ προεπιλογή
     * `true` ⇒ σύνδεσμος για το κτίριο Α που δεν ήταν στη φορτωμένη λίστα
     * εμφάνιζε **το πρώτο κτίριο**, χωρίς καμία ένδειξη.
     *
     * Ελέγχεται με `autoSelectFirstItem === true` **επίτηδες**: η εγγύηση δεν
     * επιτρέπεται να εξαρτάται από το αν κάποιος θυμήθηκε τη σημαία.
     */
    const withId: EntitySelection<Thing>[] = [
      { kind: 'resolving', requestedId: 'bld_A' },
      { kind: 'selected', item: A },
      { kind: 'archived', item: GONE },
      { kind: 'not-found', requestedId: 'bld_A' },
    ];

    for (const selection of withId) {
      expect(mayAutoSelectFirst(selection, true)).toBe(false);
    }

    // Χωρίς ρητή ταυτότητα η λίστα ξαναγίνεται ελεύθερη — η σημαία μετρά ΜΟΝΟ εκεί.
    expect(mayAutoSelectFirst<Thing>({ kind: 'none' }, true)).toBe(true);
    expect(mayAutoSelectFirst<Thing>({ kind: 'none' }, false)).toBe(false);
  });

  // ==========================================================================
  // Κ10-Κ12 — Η ΕΦΕΔΡΕΙΑ, ΚΑΙ ΤΟ ΚΑΡΕ ΑΝΑΜΕΣΑ ΣΤΙΣ ΔΥΟ ΑΠΑΝΤΗΣΕΙΣ
  // ==========================================================================

  it('Κ10 🔴 εφεδρεία εν εξελίξει ⇒ resolving — «δεν βρέθηκε» θα ήταν ΠΡΟΩΡΟ', () => {
    /*
     * Χωρίς αυτό το βήμα, το καρέ ανάμεσα στο «η λίστα απάντησε» και «η εφεδρεία
     * απάντησε» ανακοινώνει **διαγραφή** για εγγραφή που υπάρχει — το ελάττωμα Α
     * του §8.30, μια στάση πιο μέσα.
     */
    const state = deriveEntitySelection<Thing>({
      ...base,
      requestedId: 'bld_X',
      fallback: { phase: 'pending', item: null },
    });
    expect(state.kind).toBe('resolving');
  });

  it('Κ11 εφεδρεία που απάντησε «δεν υπάρχει» ⇒ not-found', () => {
    const state = deriveEntitySelection<Thing>({
      ...base,
      requestedId: 'bld_X',
      fallback: { phase: 'settled', item: null },
    });
    expect(state.kind).toBe('not-found');
  });

  it('Κ12 χωρίς ρυθμισμένη εφεδρεία δεν περιμένουμε κανέναν', () => {
    const state = deriveEntitySelection<Thing>({
      ...base,
      requestedId: 'bld_X',
      fallback: { phase: 'unavailable', item: null },
    });
    expect(state.kind).toBe('not-found');
  });

  // ==========================================================================
  // Κ13 — ΕΞΑΝΤΛΗΤΙΚΟΤΗΤΑ: καμία έκτη κατάσταση δεν τρυπώνει
  // ==========================================================================

  it('Κ13 κάθε συνδυασμός εισόδων καταλήγει σε ΜΙΑ από τις πέντε καταστάσεις', () => {
    const kinds = new Set<string>();

    for (const requestedId of [null, 'bld_A', 'bld_G', 'bld_X']) {
      for (const hasAnswered of [true, false]) {
        for (const items of [[], [A, B]] as Thing[][]) {
          for (const archivedItems of [undefined, [GONE]] as (Thing[] | undefined)[]) {
            for (const fallback of [
              undefined,
              { phase: 'pending' as const, item: null },
              { phase: 'settled' as const, item: null },
              { phase: 'settled' as const, item: GONE },
            ]) {
              kinds.add(
                deriveEntitySelection<Thing>({
                  requestedId,
                  hasAnswered,
                  items,
                  archivedItems,
                  fallback,
                }).kind,
              );
            }
          }
        }
      }
    }

    expect([...kinds].sort()).toEqual(
      ['archived', 'none', 'not-found', 'resolving', 'selected'].filter((k) => kinds.has(k)),
    );
    expect(kinds.size).toBeLessThanOrEqual(5);
  });
});
