/**
 * @fileoverview **Η ΣΦΡΑΓΙΔΑ ΓΡΑΦΕΤΑΙ ΜΙΑ ΦΟΡΑ** — και η επαναδημοσίευση δεν τη μηδενίζει.
 * @related ADR-777 §8.61 · services/listings/listed-at-stamp.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΕΙ — ΤΟ ΣΕΝΑΡΙΟ ΤΟΥ ΚΛΑΔΟΥ, ΕΚΤΕΛΕΣΜΕΝΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το «Days on Market» των αμερικανικών portals μηδενίζεται με **απόσυρση και
 * επαναδημοσίευση**. Η **Σ3** εκτελεί ακριβώς αυτή τη διαδρομή πάνω στον δικό μας
 * κώδικα και απαιτεί η τιμή να **μην αλλάξει**.
 *
 * ⚠️ Η άγκυρα δεν ρωτά «είναι write-once;» — **το κάνει**: σφραγίζει, αποσύρει
 * (δηλαδή σβήνει την **προβολή**, όχι το ακίνητο), ξαναδημοσιεύει, και συγκρίνει.
 */

import { resolveListedAt } from '../listed-at-stamp';

const AT_FIRST = '2026-03-01T08:00:00.000Z';
const AT_LATER = '2026-09-06T20:00:00.000Z';
const PROPERTIES = 'properties';
const ID = 'prop_a0000001-7777-4aaa-8aaa-000000000001';

/**
 * Ελάχιστη Firestore με **πραγματική** σημασιολογία συναλλαγής: η ανάγνωση βλέπει ό,τι
 * υπάρχει τη στιγμή της, και η εγγραφή είναι ορατή στην επόμενη.
 *
 * `onBeforeTransactionRead` είναι η **λαβή του αγώνα**: επιτρέπει σε άλλον γραφέα να
 * προλάβει **ανάμεσα** στην έξω ανάγνωση και τη συναλλαγή — που είναι ακριβώς η
 * συνθήκη που το CAS υπάρχει για να λύσει.
 */
function storeOf(
  initial: Record<string, unknown> | undefined,
  options: { readonly alreadyPublished?: boolean } = {},
) {
  const state: { doc: Record<string, unknown> | undefined } = { doc: initial };
  const counters = { transactions: 0, updates: 0, projectionReads: 0 };
  let onBeforeTransactionRead: (() => void) | null = null;
  let failUpdate = false;

  const adminDb = {
    collection: (name: string) => ({ doc: () => ({ __collection: name }) }),
    runTransaction: async <T,>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      counters.transactions += 1;
      const tx = {
        get: async (ref: { readonly __collection: string }) => {
          // 🔑 Οι **δύο** αναγνώσεις της συναλλαγής απαντούν σε **δύο** ερωτήσεις: το
          //    έγγραφο πηγής (*«έχει ήδη σφραγίδα;»*) και η προβολή (*«ήταν ήδη
          //    δημοσιευμένο;»*). Ένα ψεύτικο που τις μπέρδευε θα έκανε την Σ8 να
          //    περνά χωρίς να μετρά τίποτα.
          if (ref.__collection === 'public_listings') {
            counters.projectionReads += 1;
            return { exists: options.alreadyPublished === true };
          }
          onBeforeTransactionRead?.();
          return { data: () => state.doc };
        },
        update: (_ref: unknown, patch: Record<string, unknown>) => {
          if (failUpdate) throw new Error('PERMISSION_DENIED');
          counters.updates += 1;
          state.doc = { ...(state.doc ?? {}), ...patch };
        },
      };
      return fn(tx);
    },
  } as never;

  return {
    adminDb,
    counters,
    state,
    /** Ό,τι θα διάβαζε ο γραφέας **έξω** από τη συναλλαγή. */
    current: () => state.doc?.listedAt,
    race: (fn: () => void) => {
      onBeforeTransactionRead = fn;
    },
    breakUpdate: () => {
      failUpdate = true;
    },
  };
}

describe('Σ. Η ΣΦΡΑΓΙΔΑ ΕΙΣΟΔΟΥ ΣΤΗΝ ΑΓΟΡΑ', () => {
  it('Σ1 — ακίνητο ΧΩΡΙΣ σφραγίδα σφραγίζεται με τη στιγμή που του δόθηκε', async () => {
    const store = storeOf({});

    const result = await resolveListedAt(store.adminDb, PROPERTIES, ID, store.current(), AT_FIRST);

    expect(result).toEqual({ kind: 'known', at: AT_FIRST });
    // ⚠️ Η στιγμή είναι το **όρισμα**, ποτέ δεύτερη ανάγνωση ρολογιού: αλλιώς το
    //    `listedAt` θα διαφωνούσε με το `projectedAt` του ίδιου περάσματος.
    expect(store.state.doc?.listedAt).toEqual({ kind: 'known', at: AT_FIRST });
    expect(store.counters.updates).toBe(1);
  });

  it('🔴 Σ2 — ΣΦΡΑΓΙΣΜΕΝΟ ακίνητο ΔΕΝ ξαναγράφεται, και ΔΕΝ ανοίγει καν συναλλαγή', async () => {
    const store = storeOf({ listedAt: { kind: 'known', at: AT_FIRST } });

    const result = await resolveListedAt(store.adminDb, PROPERTIES, ID, store.current(), AT_LATER);

    expect(result).toEqual({ kind: 'known', at: AT_FIRST });
    // 🔑 Το «μηδέν συναλλαγές» δεν είναι βελτιστοποίηση — είναι η **απόδειξη** ότι η
    //    ώριμη αγγελία δεν πληρώνει τίποτα, μία φορά στη ζωή της.
    expect(store.counters.transactions).toBe(0);
    expect(store.counters.updates).toBe(0);
  });

  it('🏆 Σ3 — ΑΠΟΣΥΡΣΗ ΚΑΙ ΕΠΑΝΑΔΗΜΟΣΙΕΥΣΗ ΔΕΝ ΜΗΔΕΝΙΖΟΥΝ ΤΟΝ ΜΕΤΡΗΤΗ', async () => {
    const store = storeOf({});

    // 1. Πρώτη δημοσίευση — εδώ γεννιέται η αλήθεια.
    const first = await resolveListedAt(store.adminDb, PROPERTIES, ID, store.current(), AT_FIRST);

    // 2. **Απόσυρση**: ο γραφέας σβήνει το έγγραφο της *προβολής* (`public_listings`).
    //    Το έγγραφο του **ακινήτου** δεν αγγίζεται — αυτό ακριβώς είναι το σχέδιο, και
    //    εδώ αναπαρίσταται με το ότι το `state.doc` μένει ως έχει.
    expect(store.state.doc?.listedAt).toBeDefined();

    // 3. Επαναδημοσίευση, μήνες αργότερα.
    const again = await resolveListedAt(store.adminDb, PROPERTIES, ID, store.current(), AT_LATER);

    expect(again).toEqual(first);
    expect(again).toEqual({ kind: 'known', at: AT_FIRST });
  });

  it('🔴 Σ4 — ΤΑΥΤΟΧΡΟΝΗ πρώτη δημοσίευση: νικά ΕΝΑΣ, και ο άλλος επιστρέφει τον νικητή', async () => {
    const store = storeOf({});
    const currentBeforeRace = store.current(); // `undefined` — κενό, όπως το είδε ο καλών

    // Άλλος γραφέας προλαβαίνει **ανάμεσα** στην έξω ανάγνωση και τη συναλλαγή.
    store.race(() => {
      store.state.doc = { listedAt: { kind: 'known', at: AT_FIRST } };
    });

    const result = await resolveListedAt(store.adminDb, PROPERTIES, ID, currentBeforeRace, AT_LATER);

    // Χωρίς τη δεύτερη ανάγνωση **μέσα** στη συναλλαγή, εδώ θα γραφόταν το `AT_LATER`
    // πάνω από τον νικητή — δηλαδή η σφραγίδα θα ήταν write-once μόνο στα λόγια.
    expect(result).toEqual({ kind: 'known', at: AT_FIRST });
    expect(store.counters.updates).toBe(0);
  });

  it('🔴 Σ5 — αποτυχία γραφής ⇒ «δεν καταγράφηκε», ΠΟΤΕ εξαίρεση, ΠΟΤΕ ψεύτικη ημερομηνία', async () => {
    const store = storeOf({});
    store.breakUpdate();

    const result = await resolveListedAt(store.adminDb, PROPERTIES, ID, store.current(), AT_FIRST);

    // ⚠️ `not-recorded`, **όχι** `predates-record`: το δεύτερο σημαίνει «ήταν ήδη στην
    //    αγορά», που εδώ θα ήταν **ψέμα**. Η βλάβη οφείλει να είναι μετρήσιμη.
    expect(result).toEqual({ kind: 'unknown', reason: 'not-recorded' });
    expect(store.state.doc?.listedAt).toBeUndefined();
  });

  it('Σ6 — ήδη δηλωμένο «άγνωστο» ΔΕΝ αντικαθίσταται με σημερινή ημερομηνία', async () => {
    // Αυτό είναι το αποτέλεσμα της μετανάστευσης των ήδη δημοσιευμένων: τα 9 σημερινά
    // έγγραφα φέρουν ρητό «άγνωστο». Αν η σφραγίδα το θεωρούσε «κενό», θα τους έδινε
    // **σήμερα** — ακριβώς η ψεύτικη ιστορία που απαγορεύεται.
    const store = storeOf({ listedAt: { kind: 'unknown', reason: 'predates-record' } });

    const result = await resolveListedAt(store.adminDb, PROPERTIES, ID, store.current(), AT_LATER);

    expect(result).toEqual({ kind: 'unknown', reason: 'predates-record' });
    expect(store.counters.transactions).toBe(0);
  });

  it('Σ7 — ΣΚΟΥΠΙΔΙ στο πεδίο δεν γίνεται δεκτό ως σφραγίδα', async () => {
    const store = storeOf({ listedAt: { kind: 'known' } }); // χωρίς `at`

    const result = await resolveListedAt(store.adminDb, PROPERTIES, ID, store.current(), AT_LATER);

    // Μια «γνωστή» ημερομηνία χωρίς ημερομηνία δεν είναι γνώση. Σφραγίζεται κανονικά.
    expect(result).toEqual({ kind: 'known', at: AT_LATER });
  });

  it('🏆 Σ8 — ΗΔΗ ΔΗΜΟΣΙΕΥΜΕΝΟ ΧΩΡΙΣ ΣΦΡΑΓΙΔΑ ⇒ «predates-record», ΠΟΤΕ «σήμερα»', async () => {
    // 🔴 **ΑΥΤΗ Η ΑΓΚΥΡΑ ΚΑΝΕΙ ΤΗ ΣΕΙΡΑ ΤΗΣ ΑΝΑΠΤΥΞΗΣ ΑΔΙΑΦΟΡΗ.**
    //
    // Είναι η κατάσταση **κάθε** αγγελίας που υπάρχει σήμερα τη στιγμή που φεύγει
    // αυτός ο κώδικας: δημοσιευμένη, χωρίς σφραγίδα. Χωρίς το δίχτυ, η πρώτη
    // επαναδημοσίευση θα τους έδινε **τη σημερινή ημερομηνία** — και η μόνη άμυνα θα
    // ήταν να θυμηθεί κάποιος να τρέξει πρώτα μια μετανάστευση.
    const store = storeOf({}, { alreadyPublished: true });

    const result = await resolveListedAt(store.adminDb, PROPERTIES, ID, store.current(), AT_LATER);

    expect(result).toEqual({ kind: 'unknown', reason: 'predates-record' });
    expect(store.state.doc?.listedAt).toEqual({ kind: 'unknown', reason: 'predates-record' });
    expect(store.counters.projectionReads).toBe(1);
  });

  it('Σ9 — ΠΡΩΤΗ δημοσίευση (καμία προβολή ακόμη) ⇒ σφραγίζεται κανονικά', async () => {
    // Το άλλο σκέλος της Σ8: χωρίς αυτό, το δίχτυ θα μπορούσε να μπλοκάρει **κάθε**
    // σφραγίδα και η άγκυρα Σ8 θα περνούσε για λάθος λόγο.
    const store = storeOf({}, { alreadyPublished: false });

    const result = await resolveListedAt(store.adminDb, PROPERTIES, ID, store.current(), AT_FIRST);

    expect(result).toEqual({ kind: 'known', at: AT_FIRST });
    expect(store.counters.projectionReads).toBe(1);
  });
});
