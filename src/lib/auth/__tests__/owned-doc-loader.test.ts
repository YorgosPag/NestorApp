/**
 * `lib/auth/owned-doc-loader` — **η ΣΕΙΡΑ**, καρφωμένη· και στις δύο μορφές
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ (ADR-742 §7undecies)
 * ─────────────────────────────────────────────────────────────────────────────
 * Η αλυσίδα *φόρτωσε→υπάρχει;→δικό μου;* στέκεται μπροστά σε **κάθε**
 * μεταναστευμένο πόρο, και μέχρι σήμερα δοκιμαζόταν **μόνο έμμεσα**, μέσα από
 * τα tests των διαδρομών. Η Ομάδα 6 της πρόσθεσε **δεύτερη μορφή επιβολής**
 * ({@link loadOwnedDocOrRefusal}) για τις διαδρομές που απαντούν αντί να
 * ρίχνουν — δηλαδή ακριβώς την ώρα που ο πυρήνας απέκτησε δεύτερο καλούντα,
 * απέκτησε και τον τρόπο να αποκλίνουν οι δύο μορφές σιωπηλά.
 *
 * 🔴 Το βάρος δεν πέφτει στο «τι απαντά» αλλά στο **τι ΤΡΕΧΕΙ και με ποια
 * σειρά** (μάθημα #13): ένας φορτωτής που κρίνει **πριν** ρωτήσει «υπάρχει;»
 * κατεβάζει φάντασμα εγγράφου στον υπεργραφέα· ένας που κρίνει **μετά** τη
 * χρήση έχει ήδη διαβάσει ξένο έγγραφο. Και τα δύο απαντούν σωστά.
 *
 * @module lib/auth/__tests__/owned-doc-loader
 * @see adrs/ADR-742 §7.1, §7undecies
 */

import type { DocumentData } from 'firebase-admin/firestore';
import type { ResourceAccessVerdict } from '../resource-ownership-guard';

// ─── Ελεγχόμενη «βάση» ───────────────────────────────────────────────────────
// Κλειδί: `${collection}/${id}`. Απόν κλειδί ⇒ έγγραφο που δεν υπάρχει.
const store = new Map<string, Record<string, unknown>>();
const reads: string[] = [];

function fakeDb() {
  return {
    collection: (collection: string) => ({
      doc: (id: string) => ({
        id,
        path: `${collection}/${id}`,
        get: async () => {
          reads.push(`${collection}/${id}`);
          const data = store.get(`${collection}/${id}`);
          return { exists: data !== undefined, id, data: () => data };
        },
      }),
    }),
  };
}

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => fakeDb(),
}));

import { loadOwnedDoc, loadOwnedDocOrRefusal } from '../owned-doc-loader';

const COLLECTION = 'δοκιμαστικά';
const LOCATOR = { collection: COLLECTION, docId: 'doc-1', action: 'δοκιμή', resourceLabel: 'Δοκιμή' };

beforeEach(() => {
  store.clear();
  reads.length = 0;
});

// ============================================================================
describe('⚓ ο πυρήνας βρίσκει όντως έγγραφα (μετρητής που δεν μετράει τίποτα δεν αποδεικνύει τίποτα)', () => {
  it('το στημένο έγγραφο διαβάζεται', async () => {
    store.set(`${COLLECTION}/doc-1`, { companyId: 'co-a', name: 'ν' });

    const outcome = await loadOwnedDocOrRefusal({
      ...LOCATOR,
      decide: () => 'owned' as ResourceAccessVerdict,
      refusal: () => 'ΟΧΙ',
    });

    expect(reads).toEqual([`${COLLECTION}/doc-1`]);
    expect(outcome.doc?.data).toEqual({ companyId: 'co-a', name: 'ν' });
    expect(outcome.doc?.id).toBe('doc-1');
    expect(outcome.doc?.ref).toBeDefined();
  });
});

// ============================================================================
describe('⚓ η μορφή που ΕΠΙΣΤΡΕΦΕΙ — `loadOwnedDocOrRefusal`', () => {
  it('🔴 ανύπαρκτο έγγραφο ⇒ άρνηση, και ο φύλακας ΔΕΝ ΤΡΕΧΕΙ ΚΑΝ', async () => {
    const decide = jest.fn<ResourceAccessVerdict, [DocumentData | undefined]>(() => 'owned');

    const outcome = await loadOwnedDocOrRefusal({ ...LOCATOR, decide, refusal: () => 'ΟΧΙ' });

    expect(outcome.refusal).toBe('ΟΧΙ');
    expect(outcome.doc).toBeUndefined();
    // Η σειρά ΕΙΝΑΙ το συμβόλαιο: «υπάρχει;» πριν από «δικό μου;». Αν ο φύλακας
    // έτρεχε πρώτος, ο υπεργραφέας θα έπαιρνε `'cross-tenant-bypass'` πάνω σε
    // `undefined` και θα κατέβαινε φάντασμα εγγράφου.
    expect(decide).not.toHaveBeenCalled();
  });

  it('🔴 `denied` ⇒ ΤΟ ΙΔΙΟ «όχι» με την απουσία — από το ΙΔΙΟ εργοστάσιο', async () => {
    store.set(`${COLLECTION}/doc-1`, { companyId: 'co-ξένη' });
    const refusal = jest.fn(() => ({ status: 404, error: 'Δεν βρέθηκε' }));

    const foreign = await loadOwnedDocOrRefusal({ ...LOCATOR, decide: () => 'denied', refusal });

    store.delete(`${COLLECTION}/doc-1`);
    const missing = await loadOwnedDocOrRefusal({ ...LOCATOR, decide: () => 'denied', refusal });

    expect(foreign.refusal).toEqual(missing.refusal);
    expect(foreign.doc).toBeUndefined();
    expect(refusal).toHaveBeenCalledTimes(2);
    // Μηδέν ορίσματα: δεν υπάρχει τιμή που θα μπορούσε να διαφέρει ανάμεσα στους
    // δύο κλάδους, άρα δεν υπάρχει τρόπος να αποκλίνουν (§7.1).
    expect(refusal).toHaveBeenCalledWith();
  });

  it('🔴 `cross-tenant-bypass` ΔΕΝ είναι άρνηση — αλλιώς το JIT δεν θα είχε πού να μπει', async () => {
    store.set(`${COLLECTION}/doc-1`, { companyId: 'co-ξένη' });

    const outcome = await loadOwnedDocOrRefusal({
      ...LOCATOR,
      decide: () => 'cross-tenant-bypass',
      refusal: () => 'ΟΧΙ',
    });

    expect(outcome.refusal).toBeUndefined();
    expect(outcome.doc?.data).toEqual({ companyId: 'co-ξένη' });
  });

  it('ο φύλακας βλέπει το ΩΜΟ φορτίο, όχι στενεμένο (§7.5)', async () => {
    store.set(`${COLLECTION}/doc-1`, { companyId: '', άσχετο: 1 });
    const seen: Array<DocumentData | undefined> = [];

    await loadOwnedDocOrRefusal({
      ...LOCATOR,
      decide: (data) => {
        seen.push(data);
        return 'owned';
      },
      refusal: () => 'ΟΧΙ',
    });

    expect(seen).toEqual([{ companyId: '', άσχετο: 1 }]);
  });
});

// ============================================================================
describe('⚓ η μορφή που ΡΙΧΝΕΙ — `loadOwnedDoc` (η συμπεριφορά της δεν άλλαξε)', () => {
  it('🔴 ανύπαρκτο έγγραφο ⇒ ρίχνει, και ο φύλακας ΔΕΝ ΤΡΕΧΕΙ ΚΑΝ', async () => {
    const assertOwned = jest.fn();
    const notFound = jest.fn(() => new Error('Δεν βρέθηκε'));

    await expect(loadOwnedDoc({ ...LOCATOR, notFound, assertOwned })).rejects.toThrow('Δεν βρέθηκε');
    expect(assertOwned).not.toHaveBeenCalled();
  });

  it('υπαρκτό έγγραφο ⇒ ο φύλακας κρίνει ΠΡΙΝ επιστραφεί οτιδήποτε', async () => {
    store.set(`${COLLECTION}/doc-1`, { companyId: 'co-ξένη' });

    await expect(
      loadOwnedDoc({
        ...LOCATOR,
        notFound: () => new Error('Δεν βρέθηκε'),
        assertOwned: () => {
          throw new Error('Δεν βρέθηκε');
        },
      }),
    ).rejects.toThrow('Δεν βρέθηκε');
  });

  it('εγκεκριμένο ⇒ id + ref + ωμό φορτίο', async () => {
    store.set(`${COLLECTION}/doc-1`, { companyId: 'co-a' });

    const doc = await loadOwnedDoc({
      ...LOCATOR,
      notFound: () => new Error('Δεν βρέθηκε'),
      assertOwned: () => undefined,
    });

    expect(doc.id).toBe('doc-1');
    expect(doc.data).toEqual({ companyId: 'co-a' });
    expect(doc.ref).toBeDefined();
  });
});

// ============================================================================
describe('⚓ η δοσμένη σύνδεση χρησιμοποιείται — αλλιώς ανοίγουν δύο στιγμιότυπα ανά αίτημα', () => {
  it('το `db` του καλούντος προτιμάται από το καθολικό', async () => {
    const ownReads: string[] = [];
    const ownDb = {
      collection: (collection: string) => ({
        doc: (id: string) => ({
          id,
          get: async () => {
            ownReads.push(`${collection}/${id}`);
            return { exists: true, id, data: () => ({ companyId: 'co-a' }) };
          },
        }),
      }),
    };

    const outcome = await loadOwnedDocOrRefusal({
      ...LOCATOR,
      db: ownDb as unknown as Parameters<typeof loadOwnedDocOrRefusal>[0]['db'],
      decide: () => 'owned',
      refusal: () => 'ΟΧΙ',
    });

    expect(ownReads).toEqual([`${COLLECTION}/doc-1`]);
    expect(reads).toEqual([]);
    expect(outcome.doc).toBeDefined();
  });
});
