/**
 * ADR-798 Φάση 3 (Κ4) — ΑΓΚΥΡΕΣ για τον **γραφέα** του δηλωμένου επαγγέλματος.
 *
 * Το `DeclaredOccupation` **τεκμηριώνει** ότι τα τρία πεδία ESCO πάνε πάντα μαζί
 * και δηλώνει ρητά ότι *«ο τύπος δεν μπορεί να το επιβάλει· ο **γραφέας**
 * οφείλει»*. Αυτές οι άγκυρες είναι το «οφείλει» — αλλιώς η πρόταση θα ήταν
 * σχόλιο *(CHECK 3.36: «ένα anchor χωρίς gate είναι σχόλιο»)*.
 *
 *   Γ-1  🔴 Χωρίς `escoUri` **ΣΒΗΝΟΝΤΑΙ** και το `escoLabel` και το `iscoCode`
 *   Γ-2  Το κενό **σβήνει** (`deleteField`), ποτέ δεν γράφεται `''`
 *   Γ-3  Πλήρης ταξινόμηση γράφεται **ακέραιη**
 *   Γ-4  Επιστρέφει ό,τι **γράφτηκε**, όχι ό,τι δόθηκε
 *   Γ-5  Ιδεμποτεντικό — δεύτερη κλήση, ίδιο αποτέλεσμα (N.7.2 #3)
 */

import type { Firestore } from 'firebase/firestore';
import { saveDeclaredOccupation } from '../auth-context-profile';

/** Δείκτης-φρουρός: ό,τι φέρει αυτό, ζητήθηκε **διαγραφή** πεδίου. */
const DELETE = Symbol('deleteField');

const writes: Array<Record<string, unknown>> = [];

jest.mock('firebase/firestore', () => ({
  doc: (_db: unknown, collection: string, id: string) => ({ path: `${collection}/${id}` }),
  deleteField: () => DELETE,
  setDoc: (ref: { path: string }, payload: Record<string, unknown>, options: unknown) => {
    writes.push({ ...payload, __path: ref.path, __options: options });
    return Promise.resolve();
  },
  getDoc: jest.fn(),
  increment: jest.fn(),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

const db = {} as Firestore;

/** Το φορτίο της τελευταίας εγγραφής, χωρίς τα μεταδεδομένα του διπλού. */
function lastWrite(): Record<string, unknown> {
  const payload = writes[writes.length - 1];
  expect(payload).toBeDefined();
  return payload;
}

beforeEach(() => {
  writes.length = 0;
});

const CLASSIFIED = {
  profession: 'Τοπογράφος',
  escoUri: 'http://data.europa.eu/esco/occupation/abcd-1234',
  escoLabel: 'τοπογράφος',
  iscoCode: '2165',
};

// ============================================================================

describe('Γ-1 🔴 — χωρίς `escoUri` δεν επιβιώνει ΜΙΣΗ ταξινόμηση', () => {
  it('ο ορφανός `iscoCode` ΣΒΗΝΕΤΑΙ, δεν αποθηκεύεται', () => {
    // Είναι η **δεύτερη** άμυνα (belt-and-suspenders, N.7.2 #4): ο αναγνώστης
    // αρνείται να **εκθέσει** ορφανό κωδικό, ο γραφέας αρνείται να τον
    // **γεννήσει**. Χωρίς αυτό, μια εγγραφή με κωδικό αλλά χωρίς αυθεντία θα
    // κατέληγε στη βάση και θα ζούσε εκεί για πάντα.
    return saveDeclaredOccupation(db, 'u1', {
      profession: 'Κάτι',
      escoLabel: 'κάτι',
      iscoCode: '2611',
    }).then((written) => {
      const payload = lastWrite();
      expect(payload.escoUri).toBe(DELETE);
      expect(payload.escoLabel).toBe(DELETE);
      expect(payload.iscoCode).toBe(DELETE);
      expect(payload.profession).toBe('Κάτι');

      expect(written.iscoCode).toBeUndefined();
      expect(written.escoLabel).toBeUndefined();
    });
  });

  it('κενό `escoUri` μετρά ως απουσία, όχι ως τιμή', async () => {
    await saveDeclaredOccupation(db, 'u1', { ...CLASSIFIED, escoUri: '   ' });
    const payload = lastWrite();
    expect(payload.escoUri).toBe(DELETE);
    expect(payload.iscoCode).toBe(DELETE);
  });
});

describe('Γ-2 — το κενό ΣΒΗΝΕΙ, ποτέ δεν γράφεται ως κενή συμβολοσειρά', () => {
  it('καμία εγγραφή δεν αφήνει `\'\'` πίσω της', async () => {
    // Κενό string θα ήταν **ψεύτικο δεδομένο**: κάθε επόμενος αναγνώστης θα
    // έπρεπε να θυμηθεί να το φιλτράρει. Σύμβαση: `contacts.service.ts:334`.
    await saveDeclaredOccupation(db, 'u1', { profession: '', escoUri: '', escoLabel: '', iscoCode: '' });
    const payload = lastWrite();
    for (const field of ['profession', 'escoUri', 'escoLabel', 'iscoCode']) {
      expect(payload[field]).toBe(DELETE);
    }
    expect(Object.values(payload)).not.toContain('');
  });

  it('τα κενά διαστήματα κόβονται', async () => {
    await saveDeclaredOccupation(db, 'u1', { profession: '  Δικηγόρος  ' });
    expect(lastWrite().profession).toBe('Δικηγόρος');
  });

  it('γράφει με `merge` — ποτέ δεν αντικαθιστά το έγγραφο του χρήστη', async () => {
    // Χωρίς `merge`, μια δήλωση επαγγέλματος θα **έσβηνε** email, ρόλο, claims.
    await saveDeclaredOccupation(db, 'u42', CLASSIFIED);
    const payload = lastWrite();
    expect(payload.__options).toEqual({ merge: true });
    expect(payload.__path).toContain('u42');
  });
});

describe('Γ-3 — η πλήρης ταξινόμηση γράφεται ΑΚΕΡΑΙΗ', () => {
  it('και τα τέσσερα πεδία φτάνουν στη βάση', async () => {
    await saveDeclaredOccupation(db, 'u1', CLASSIFIED);
    const payload = lastWrite();
    expect(payload.profession).toBe('Τοπογράφος');
    expect(payload.escoUri).toBe(CLASSIFIED.escoUri);
    expect(payload.escoLabel).toBe('τοπογράφος');
    expect(payload.iscoCode).toBe('2165');
  });

  it('⛔ ΠΟΤΕ δεν γράφει `occupationVerification` — είναι server-owned', () => {
    // Τα `firestore.rules` θα το απέρριπταν (σωστά, ADR-798 §7), αλλά η άγκυρα
    // υπάρχει ώστε το λάθος να πιαστεί **εδώ** και όχι ως σιωπηλή άρνηση.
    return saveDeclaredOccupation(db, 'u1', CLASSIFIED).then(() => {
      expect(Object.keys(lastWrite())).not.toContain('occupationVerification');
    });
  });
});

describe('Γ-4 — επιστρέφει ό,τι ΓΡΑΦΤΗΚΕ, όχι ό,τι δόθηκε', () => {
  it('η οθόνη δεν μπορεί να δείξει ταξινόμηση που δεν αποθηκεύτηκε', async () => {
    const given = { profession: ' Μεσίτης ', escoLabel: 'μεσίτης', iscoCode: '3334' };
    const written = await saveDeclaredOccupation(db, 'u1', given);

    // Δόθηκε ημιτελής ταξινόμηση· ό,τι επιστρέφεται είναι η **αλήθεια**.
    expect(written).toEqual({
      profession: 'Μεσίτης',
      escoUri: undefined,
      escoLabel: undefined,
      iscoCode: undefined,
    });
    expect(written.profession).not.toBe(given.profession);
  });
});

describe('Γ-5 — ιδεμποτεντικό (N.7.2 #3)', () => {
  it('δεύτερη κλήση με την ίδια είσοδο γράφει ΤΟ ΙΔΙΟ', async () => {
    const first = await saveDeclaredOccupation(db, 'u1', CLASSIFIED);
    const firstPayload = { ...lastWrite() };
    const second = await saveDeclaredOccupation(db, 'u1', CLASSIFIED);
    const secondPayload = { ...lastWrite() };

    expect(second).toEqual(first);
    // Το `updatedAt` είναι ρολόι — εξαιρείται από τη σύγκριση επίτηδες.
    delete firstPayload.updatedAt;
    delete secondPayload.updatedAt;
    expect(secondPayload).toEqual(firstPayload);
  });
});
