/**
 * ΑΓΚΥΡΑ — ο φορητός πυρήνας της ιδεμποτίας των Cloud Functions (ADR-873 Φ1 §9.1).
 *
 * 🔑 **Γιατί εδώ και όχι δίπλα στα triggers**: ο κριτής και οι σπόροι είναι **καθαροί**.
 * Ελέγχονται με μηδέν mock, μηδέν Firestore, μηδέν `firebase-functions` — δηλαδή η
 * καρδιά της σημασιολογίας δεν εξαρτάται από το αν το ψεύτικο SDK είναι σωστό.
 *
 * ⚠️ Το αρχείο ελέγχεται **από την πλευρά του `src/`**. Το `functions/` τρέχει το
 * **προβαλλόμενο αντίγραφο** και η ισοτιμία των δύο είναι δουλειά της CHECK 3.93 —
 * όχι αυτού του αρχείου. Αν γράψεις εδώ test που περνά και εκεί όχι, το λάθος είναι
 * στην προβολή, και η πύλη το λέει.
 */

import {
  EVENT_CLAIM_LEASE_MS,
  EVENT_CLAIM_TTL_MS,
  businessSeed,
  firestoreChangeSeed,
  isEventClaimExpired,
  judgeEventClaim,
  scheduledRunSeed,
  storageObjectSeed,
  type EventClaimRecord,
} from '../event-claim';

const record = (over: Partial<EventClaimRecord> = {}): EventClaimRecord => ({
  state: 'in-flight',
  seed: 'σπόρος',
  lockedAtMs: 1_000_000,
  ...over,
});

describe('σπόροι — η ταυτότητα της ΑΛΛΑΓΗΣ', () => {
  const change = {
    path: 'purchase_orders/po-42',
    beforeUpdateTime: '2026-09-22T10:00:00.000Z',
    afterUpdateTime: '2026-09-22T10:00:05.000Z',
  };

  it('ίδια αλλαγή ⇒ ίδιος σπόρος — αυτό ΕΙΝΑΙ ο μηχανισμός', () => {
    expect(firestoreChangeSeed(change)).toBe(firestoreChangeSeed({ ...change }));
  });

  it('🔴 ο χρόνος ΠΡΙΝ μετράει: δύο μεταβάσεις στο ίδιο commit ΔΕΝ συγχέονται', () => {
    // Χωρίς τον `before` και οι δύο θα κατέληγαν στο ίδιο έγγραφο-δείκτη, δηλαδή η
    // δεύτερη θα θεωρούνταν σιωπηλά «έγινε ήδη».
    const other = { ...change, beforeUpdateTime: '2026-09-22T09:00:00.000Z' };
    expect(firestoreChangeSeed(other)).not.toBe(firestoreChangeSeed(change));
  });

  it('🔴 δύο ΔΙΑΓΡΑΦΕΣ του ίδιου εγγράφου ξεχωρίζουν', () => {
    const first = { path: 'files/f-1', beforeUpdateTime: '2026-01-01T00:00:00Z', afterUpdateTime: null };
    const second = { ...first, beforeUpdateTime: '2026-02-01T00:00:00Z' };
    expect(firestoreChangeSeed(second)).not.toBe(firestoreChangeSeed(first));
  });

  it('δημιουργία και διαγραφή του ίδιου εγγράφου ΔΕΝ ταυτίζονται', () => {
    const created = { path: 'files/f-1', beforeUpdateTime: null, afterUpdateTime: 'T' };
    const deleted = { path: 'files/f-1', beforeUpdateTime: 'T', afterUpdateTime: null };
    expect(firestoreChangeSeed(created)).not.toBe(firestoreChangeSeed(deleted));
  });

  it('🏆 το διαχωριστικό δεν μπορεί να πλαστογραφηθεί από τα ίδια τα δεδομένα', () => {
    // Με διαχωριστικό `:` ή `|` αυτά τα δύο θα έδιναν ΤΟΝ ΙΔΙΟ σπόρο («a:b»+«c» ≡ «a»+«b:c»),
    // δηλαδή μια αλλαγή θα «ακύρωνε» μια εντελώς άλλη. Οι ταυτότητες εγγράφων Firestore
    // επιτρέπουν και τους δύο χαρακτήρες — μόνο το NUL δεν επιτρέπεται πουθενά.
    const a = firestoreChangeSeed({ path: 'c/a:b', beforeUpdateTime: 'c', afterUpdateTime: 'x' });
    const b = firestoreChangeSeed({ path: 'c/a', beforeUpdateTime: 'b:c', afterUpdateTime: 'x' });
    expect(a).not.toBe(b);
  });

  it('ο τύπος του γεγονότος είναι μέρος του σπόρου — Firestore ≠ Storage ≠ cron', () => {
    const seeds = new Set([
      firestoreChangeSeed({ path: 'x', beforeUpdateTime: 'y', afterUpdateTime: null }),
      storageObjectSeed({ bucket: 'x', name: 'y', generation: '', metageneration: '' }),
      scheduledRunSeed({ job: 'x', periodUtc: 'y' }),
      businessSeed('x', ['y']),
    ]);
    expect(seeds.size).toBe(4);
  });

  it('Storage: νέο περιεχόμενο (generation) και νέα μεταδεδομένα ξεχωρίζουν', () => {
    const base = { bucket: 'b', name: 'n', generation: '1', metageneration: '1' };
    expect(storageObjectSeed({ ...base, generation: '2' })).not.toBe(storageObjectSeed(base));
    expect(storageObjectSeed({ ...base, metageneration: '2' })).not.toBe(storageObjectSeed(base));
  });

  it('προγραμματισμένο: άλλη περίοδος ⇒ άλλος σπόρος, ίδια περίοδος ⇒ ίδιος', () => {
    expect(scheduledRunSeed({ job: 'purge', periodUtc: '2026-09-22' }))
      .toBe(scheduledRunSeed({ job: 'purge', periodUtc: '2026-09-22' }));
    expect(scheduledRunSeed({ job: 'purge', periodUtc: '2026-09-23' }))
      .not.toBe(scheduledRunSeed({ job: 'purge', periodUtc: '2026-09-22' }));
  });

  it('επιχειρηματικός σπόρος: ΑΛΛΗ γραμμή του ίδιου υλικού είναι ΑΛΛΗ πράξη (απόφαση Giorgio)', () => {
    const line = (id: string) => businessSeed('price-sync', ['comp-1', 'po-42', 'mat-7', id]);
    expect(line('L2')).not.toBe(line('L1'));
    expect(line('L1')).toBe(line('L1'));
  });
});

describe('ο κριτής — τι σημαίνει ένας υπάρχων δείκτης', () => {
  it('ολοκληρωμένος ⇒ «done»', () => {
    expect(judgeEventClaim(record({ state: 'done' }), 'σπόρος', 1_000_000)).toBe('done');
  });

  it('εντός lease ⇒ «in-flight» (ο καλών ρίχνει ώστε να ξαναδοκιμάσει η πλατφόρμα)', () => {
    const now = 1_000_000 + EVENT_CLAIM_LEASE_MS - 1;
    expect(judgeEventClaim(record(), 'σπόρος', now)).toBe('in-flight');
  });

  it('🏆 ΑΚΡΙΒΩΣ στο lease ⇒ «unknown» — ΠΟΤΕ σιωπηλή δεύτερη εκτέλεση', () => {
    // Το όριο είναι κλειστό προς τα πάνω επίτηδες: στο σημείο της αμφιβολίας
    // διαλέγουμε «ρώτα άνθρωπο», όχι «ξανακάν' το».
    const now = 1_000_000 + EVENT_CLAIM_LEASE_MS;
    expect(judgeEventClaim(record(), 'σπόρος', now)).toBe('unknown');
  });

  it('🔴 άλλος σπόρος στην ίδια ταυτότητα ⇒ «collision», ΠΟΤΕ σιωπή', () => {
    // Σύγκρουση κατακερματισμού. Αν επέστρεφε «done», μια πραγματική αλλαγή θα
    // εξαφανιζόταν επειδή μια άσχετη έτυχε να πέσει στο ίδιο έγγραφο.
    expect(judgeEventClaim(record({ seed: 'άλλος' }), 'σπόρος', 1_000_000)).toBe('collision');
  });

  it('η σύγκρουση κρίνεται ΠΡΙΝ από την κατάσταση', () => {
    expect(judgeEventClaim(record({ seed: 'άλλος', state: 'done' }), 'σπόρος', 1_000_000)).toBe('collision');
  });
});

describe('λήξη — γιατί κρίνεται από αριθμό', () => {
  it('ληγμένος δείκτης ισοδυναμεί με ανύπαρκτο (η TTL σβήνει με καθυστέρηση)', () => {
    expect(isEventClaimExpired(record(), 1_000_000 + EVENT_CLAIM_TTL_MS)).toBe(true);
    expect(isEventClaimExpired(record(), 1_000_000 + EVENT_CLAIM_TTL_MS - 1)).toBe(false);
  });

  it('η διάρκεια ζωής ΞΕΠΕΡΝΑ το παράθυρο επαναλήψεων της Firestore (24 ώρες)', () => {
    // Αλλιώς ένα καθυστερημένο διπλότυπο δεν θα έβρισκε τον δείκτη του και θα
    // ξαναεκτελούσε — δηλαδή ο μηχανισμός θα απέτυχε ακριβώς στην περίπτωση που υπάρχει.
    expect(EVENT_CLAIM_TTL_MS).toBeGreaterThan(24 * 60 * 60 * 1000);
  });

  it('το lease ΞΕΠΕΡΝΑ το όριο 540s των event-driven συναρτήσεων 2ης γενιάς', () => {
    // Lease μικρότερο από τον μέγιστο χρόνο εκτέλεσης θα έλεγε «unknown» για εκτέλεση
    // που απλώς ΤΡΕΧΕΙ ακόμη.
    expect(EVENT_CLAIM_LEASE_MS).toBeGreaterThan(540_000);
  });
});
