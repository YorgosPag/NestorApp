/**
 * ⚓ ADR-742 §7novies — **ο μηχανισμός συνάθροισης των φυλάκων, μία φορά**
 *
 * Το `deletion-guard` και το `deletion-link-guard` είχαν **πανομοιότυπο** σώμα
 * σε τρία σημεία (16 + 13 + 15 γραμμές· το `jscpd` το επιβεβαίωσε τη στιγμή που
 * η κεντρικοποίηση του φίλτρου μισθωτή έφερε τα δύο σώματα σε επαφή —
 * **μάθημα #3: η κεντρικοποίηση μπορεί να γεννήσει τον κλώνο**).
 *
 * 🔴 Η μπλοκαρισμένη διαδρομή **δεν καλυπτόταν από κανένα test** πριν από αυτό
 * το αρχείο: οι δύο φύλακες δοκιμάζονταν μόνο με κενά αποτελέσματα. Ένα
 * `count !== 0` που θα γινόταν `count > 0` θα άφηνε το **σφάλμα ελέγχου** (-1)
 * να μη μπλοκάρει — δηλαδή διαγραφή οντότητας της οποίας τις εξαρτήσεις δεν
 * καταφέραμε να δούμε.
 *
 * @module lib/firestore/__tests__/deletion-common
 * @see ADR-742 §7novies · ADR-226 (Deletion Guard)
 */

jest.mock('server-only', () => ({}));

import {
  MAX_PREVIEW_IDS,
  summarizeDependencyCheck,
  toDependencyOutcome,
  unavailableDependencyOutcome,
  type DependencyCheckCopy,
} from '../deletion-common';

const COPY: DependencyCheckCopy = {
  allowed: 'ΚΑΘΑΡΟ',
  blocked: (total, labels) => `ΜΠΛΟΚ ${total} :: ${labels}`,
  unavailable: (labels) => `ΑΓΝΩΣΤΟ :: ${labels}`,
};

const DEP = { label: 'Ευκαιρίες', collection: 'opportunities' } as const;

const snapshotOf = (ids: string[]) => ({
  size: ids.length,
  docs: ids.map((id) => ({ id })),
});

describe('toDependencyOutcome — η αναφορά μιας μετρημένης εξάρτησης', () => {
  it('κρατά το πλήθος από το snapshot και κόβει τα ids στο όριο προεπισκόπησης', () => {
    const ids = Array.from({ length: MAX_PREVIEW_IDS + 5 }, (_, i) => `doc_${i}`);

    const outcome = toDependencyOutcome(DEP, snapshotOf(ids));

    // Το πλήθος είναι **του query** (που ζητά MAX+1), τα ids είναι της οθόνης.
    expect(outcome.count).toBe(ids.length);
    expect(outcome.documentIds).toHaveLength(MAX_PREVIEW_IDS);
    expect(outcome.documentIds[0]).toBe('doc_0');
  });

  it('η ρητή οδηγία αποκατάστασης της εξάρτησης υπερισχύει της προεπιλογής', () => {
    const explicit = toDependencyOutcome({ ...DEP, remediation: 'ΔΙΚΗ ΜΟΥ' }, snapshotOf([]));
    const fallback = toDependencyOutcome(DEP, snapshotOf([]));

    expect(explicit.remediation).toBe('ΔΙΚΗ ΜΟΥ');
    expect(fallback.remediation).toBeTruthy();
    expect(fallback.remediation).not.toBe('ΔΙΚΗ ΜΟΥ');
  });
});

describe('unavailableDependencyOutcome — «δεν ξέρω» δεν είναι «μηδέν»', () => {
  it('🔴 σημαδεύει με -1, όχι με 0', () => {
    expect(unavailableDependencyOutcome(DEP).count).toBe(-1);
  });
});

describe('summarizeDependencyCheck — η ετυμηγορία', () => {
  it('όλα μηδέν ⇒ επιτρέπεται, με το λεξιλόγιο του καλούντος', () => {
    const result = summarizeDependencyCheck(
      [toDependencyOutcome(DEP, snapshotOf([]))],
      COPY,
    );

    expect(result).toEqual({
      allowed: true,
      dependencies: [],
      totalDependents: 0,
      message: 'ΚΑΘΑΡΟ',
    });
  });

  it('θετικές μετρήσεις ⇒ μπλοκάρει και αθροίζει', () => {
    const result = summarizeDependencyCheck(
      [
        toDependencyOutcome(DEP, snapshotOf(['a', 'b'])),
        toDependencyOutcome({ label: 'Τιμολόγια', collection: 'accounting_invoices' }, snapshotOf(['c'])),
      ],
      COPY,
    );

    expect(result.allowed).toBe(false);
    expect(result.totalDependents).toBe(3);
    expect(result.message).toBe('ΜΠΛΟΚ 3 :: Ευκαιρίες (2), Τιμολόγια (1)');
  });

  /**
   * 🔴🔴 ΤΟ ΣΗΜΕΙΟ ΠΟΥ ΚΑΝΕΝΑ TEST ΔΕΝ ΕΠΙΑΝΕ.
   *
   * Σφάλμα ερωτήματος **μπλοκάρει**: «δεν ξέρω αν υπάρχουν εξαρτήσεις» δεν
   * επιτρέπεται να διαβαστεί ως «δεν υπάρχουν». Η μετάλλαξη `count !== 0` →
   * `count > 0` κάνει ακριβώς αυτό, και είναι **αόρατη** σε κάθε test που
   * δοκιμάζει μόνο επιτυχημένα ερωτήματα.
   */
  it('🔴🔴 ΜΟΝΟ σφάλμα ελέγχου (-1) ⇒ ΑΠΟΚΛΕΙΕΤΑΙ, με μηδέν μετρημένες εγγραφές', () => {
    const result = summarizeDependencyCheck([unavailableDependencyOutcome(DEP)], COPY);

    expect(result.allowed).toBe(false);
    expect(result.totalDependents).toBe(0);
    expect(result.message).toBe('ΑΓΝΩΣΤΟ :: Ευκαιρίες (έλεγχος μη διαθέσιμος)');
  });

  /**
   * Το `-1` **δεν αφαιρεί** από το σύνολο. Χωρίς το `Math.max(0, …)` δύο
   * εξαρτήσεις (μία με 1 εγγραφή, μία με σφάλμα) θα εμφανίζονταν ως **0
   * εξαρτώμενες εγγραφές** — και το μήνυμα θα γυρνούσε στο «λόγω σφάλματος»,
   * κρύβοντας ότι υπάρχει **πραγματική** εξάρτηση.
   */
  it('🔴 σφάλμα + πραγματική εξάρτηση ⇒ το σύνολο μετρά ΜΟΝΟ τις μετρημένες', () => {
    const result = summarizeDependencyCheck(
      [unavailableDependencyOutcome(DEP), toDependencyOutcome({ label: 'Αρχεία', collection: 'files' }, snapshotOf(['x']))],
      COPY,
    );

    expect(result.totalDependents).toBe(1);
    expect(result.message).toBe('ΜΠΛΟΚ 1 :: Ευκαιρίες (έλεγχος μη διαθέσιμος), Αρχεία (1)');
    expect(result.dependencies).toHaveLength(2);
  });

  it('οι μηδενικές εξαρτήσεις δεν επιστρέφονται στον καλούντα — μόνο όσες μπλοκάρουν', () => {
    const result = summarizeDependencyCheck(
      [
        toDependencyOutcome(DEP, snapshotOf([])),
        toDependencyOutcome({ label: 'Αρχεία', collection: 'files' }, snapshotOf(['x'])),
      ],
      COPY,
    );

    expect(result.dependencies.map((d) => d.label)).toEqual(['Αρχεία']);
  });
});
