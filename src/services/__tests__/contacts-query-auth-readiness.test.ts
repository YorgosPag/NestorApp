/**
 * Άγκυρα — **Η ΑΝΑΓΝΩΣΗ ΠΕΡΙΜΕΝΕΙ ΝΑ ΜΑΘΕΙ ΠΟΙΟΣ ΡΩΤΑ** (ADR-834 §6.5.στ)
 *
 * ## Γιατί υπάρχει — μετρημένο ζωντανά 2026-08-31
 *
 * Στην οθόνη «νέα αγγελία για πελάτη» ο επιλογέας επαφών ήταν **άδειος**. Ίδιος
 * χρήστης, ίδια βάση, ίδιος κώδικας — και **μη ντετερμινιστικά**:
 *
 * | Διαδρομή | επιλογές στο dropdown |
 * |---|---|
 * | άμεση φόρτωση URL (κρύο) | **0** |
 * | δεύτερη φόρτωση / SPA remount | **9** |
 *
 * Η μόνη μεταβλητή ήταν **πότε** ρωτήθηκε. Το `getAllContacts` άνοιγε με
 * `if (!auth.currentUser) return { contacts: [] }`, και το `auth.currentUser` είναι
 * `null` για τα πρώτα χιλιοστά κάθε φόρτωσης — το Firebase αποκαθιστά τη συνεδρία
 * **ασύγχρονα**. Το `useEffect(…, [])` του καταναλωτή δεν ξαναρωτά ποτέ, οπότε η
 * πρώτη — και μοναδική — προσπάθεια χανόταν σιωπηλά.
 *
 * 🔑 **Ο σωστός φρουρός ΥΠΗΡΧΕ ΗΔΗ ένα βήμα πιο κάτω και δεν εκτελέστηκε ΠΟΤΕ.**
 * Το `buildContactsQuery` → `requireAuthContext()` κάνει
 * `if (!auth.currentUser) await waitForAuthReady()`. Η πρόωρη επιστροφή τον
 * **προλάβαινε**: αδρανής φρουρός, σχήμα ADR-749 §5.
 *
 * ## Γιατί ΑΥΤΗ η άγκυρα και όχι το `contacts-query-tenant-scope.test.ts`
 *
 * Εκείνο ρωτά *«τι constraints παράγει το query;»* με τον `auth.currentUser`
 * **πάντα παρόντα** — δηλαδή δοκιμάζει έναν κόσμο όπου η κούρσα **δεν υπάρχει**, και
 * έμενε πράσινο σε όλη τη διάρκεια του ελαττώματος. Αυτό εδώ ρωτά το μόνο ερώτημα που
 * το ξεχωρίζει: *«όταν η ταυτότητα **δεν έχει λυθεί ακόμη**, φτάνει η ερώτηση στη
 * Firestore ή γυρίζει κενό;»*
 *
 * ⛔ **Η αγκυρωμένη συμπεριφορά δεν είναι «να μην πετάει»** — είναι **να μην ψεύδεται**:
 * όταν η ταυτότητα λυθεί σε **κανέναν**, η ανάγνωση οφείλει να **αποτύχει ορατά** αντί
 * να προσποιηθεί κενή λίστα. Ίδιο δόγμα με τον χρήστη χωρίς claim εταιρείας
 * (`contacts-query-tenant-scope.test.ts`: «αποτυγχάνει **ΟΡΑΤΑ**»).
 *
 * @module services/__tests__/contacts-query-auth-readiness
 * @see ADR-834 §6.5.στ
 * @see services/firestore/auth-context.ts — `requireAuthContext` / `waitForAuthReady`
 */

// ---------------------------------------------------------------------------
// Καταγραφή: κλήθηκε ΠΟΤΕ το `query()`; (το ερώτημα «εστάλη η ερώτηση;»)
// ---------------------------------------------------------------------------

let queryCallCount = 0;

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({ __collection: true })),
  doc: jest.fn(() => ({ __doc: true })),
  where: jest.fn((field: string, op: string, value: unknown) => ({ __kind: 'where', field, op, value })),
  orderBy: jest.fn((field: string, dir?: string) => ({ __kind: 'orderBy', field, dir })),
  limit: jest.fn((n: number) => ({ __kind: 'limit', n })),
  startAfter: jest.fn(() => ({ __kind: 'startAfter' })),
  query: jest.fn((_ref: unknown, ...constraints: unknown[]) => {
    queryCallCount += 1;
    return { __query: true, constraints };
  }),
  getDocs: jest.fn(async () => ({ docs: [], size: 0, empty: true })),
  writeBatch: jest.fn(),
  serverTimestamp: jest.fn(() => ({ __serverTimestamp: true })),
  DocumentSnapshot: class {},
  QuerySnapshot: class {},
}));

// ---------------------------------------------------------------------------
// 🔑 Ο ΠΥΡΗΝΑΣ ΤΟΥ ΠΕΙΡΑΜΑΤΟΣ: `auth.currentUser` που ΞΕΚΙΝΑ `null`
//
// Έτσι ακριβώς συμπεριφέρεται το Firebase σε κάθε φόρτωση σελίδας. Το
// `waitForAuthReady()` είναι η στιγμή που η συνεδρία **αποκαθίσταται** — και μόνο
// τότε το `currentUser` παύει να είναι `null`.
//
// ⚠️ Το mock δεν «βοηθά» τον κώδικα: αν η υπό δοκιμή συνάρτηση δεν περιμένει,
// θα δει `null` και θα φύγει — που είναι ακριβώς το ελάττωμα που μετρήθηκε.
// ---------------------------------------------------------------------------

type AuthUser = { uid: string; getIdTokenResult: () => Promise<{ claims: Record<string, unknown> }> };

/** Ποιος θα ΕΜΦΑΝΙΣΤΕΙ όταν λυθεί η ταυτότητα — `null` = δεν υπάρχει κανείς. */
let mockSettledUser: AuthUser | null = null;
/** Έχει ήδη λυθεί η ταυτότητα τη στιγμή της κλήσης; */
let mockIdentitySettled = false;
/** Πόσες φορές ζητήθηκε αναμονή — αποδεικνύει ότι η ροή ΠΕΡΑΣΕ από εκεί. */
let mockWaitCallCount = 0;

// ⚠️ Το αντικείμενο γράφεται ΜΕΣΑ στο factory (και όχι ως `const` απ' έξω): το
// `jest.mock` ανυψώνεται πάνω από τα imports, οπότε μια εξωτερική `const` θα
// διαβαζόταν στη ζώνη νεκρού χρόνου της. Ίδιο ιδίωμα με το
// `contacts-query-tenant-scope.test.ts` — ο getter διαβάζεται στην ΚΛΗΣΗ, όχι στο import.
jest.mock('@/lib/firebase', () => ({
  db: { __mockDb: true },
  auth: {
    get currentUser() {
      return mockIdentitySettled ? mockSettledUser : null;
    },
  },
  waitForAuthReady: jest.fn(async () => {
    mockWaitCallCount += 1;
    mockIdentitySettled = true;
    return mockSettledUser !== null;
  }),
}));

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn((_auth: unknown, cb: (u: unknown) => void) => {
    cb(mockSettledUser);
    return () => undefined;
  }),
}));

jest.mock('@/services/firestore/super-admin-active-company', () => ({
  getSuperAdminActiveCompanyId: () => null,
  onSuperAdminActiveCompanyChange: () => () => undefined,
}));

jest.mock('@/lib/firestore/utils', () => ({
  getCol: jest.fn(() => ({ __collection: true })),
  mapDocs: jest.fn(() => []),
  chunk: jest.fn((arr: unknown[]) => [arr]),
  asDate: jest.fn((v: unknown) => (v instanceof Date ? v : new Date(0))),
  startAfterDocId: jest.fn(async () => null),
}));

jest.mock('@/lib/firestore/converters/contact.converter', () => ({
  contactConverter: { toFirestore: jest.fn(), fromFirestore: jest.fn() },
}));

const mockGetAll = jest.fn(async () => ({ documents: [] as Record<string, unknown>[] }));
jest.mock('@/services/firestore/firestore-query.service', () => ({
  firestoreQueryService: { getAll: (...args: unknown[]) => mockGetAll(...(args as [])), subscribe: jest.fn() },
}));

jest.mock('@/services/enterprise-id.service', () => ({
  generateContactId: jest.fn(() => 'cont_test'),
}));

// SUT — import AFTER mocks
import { getAllContacts, searchContacts } from '../contacts-query.service';

const COMPANY = 'comp_aaaaaaaaaaaaaaaaaaaaaa';

function userWithCompany(): AuthUser {
  return {
    uid: 'user_test',
    getIdTokenResult: async () => ({ claims: { companyId: COMPANY } }),
  };
}

beforeEach(() => {
  queryCallCount = 0;
  mockWaitCallCount = 0;
  mockGetAll.mockClear();
  mockSettledUser = userWithCompany();
  mockIdentitySettled = true; // η προεπιλογή είναι ο ΗΔΗ λυμένος κόσμος
});

// ===========================================================================
describe('getAllContacts — αναμονή ταυτότητας (ADR-834 §6.5.στ)', () => {
  // -------------------------------------------------------------------------
  // 🔴 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΠΡΩΤΑ: χωρίς αυτόν, ένα πράσινο «δεν γύρισε κενό» δεν
  // ξεχωρίζει το «ρώτησε σωστά» από το «η άγκυρα δεν μετρά τίποτα».
  // -------------------------------------------------------------------------
  it('ΠΑΡΟΝΟΜΑΣΤΗΣ — με ήδη λυμένη ταυτότητα, η ερώτηση ΦΤΑΝΕΙ στη Firestore', async () => {
    mockIdentitySettled = true;

    await getAllContacts({ limitCount: 500 });

    expect(queryCallCount).toBe(1);
  });

  it('η ερώτηση φτάνει ΚΑΙ όταν η ταυτότητα ΔΕΝ έχει λυθεί τη στιγμή της κλήσης', async () => {
    // Ο κόσμος κάθε φόρτωσης σελίδας: ο χρήστης ΕΙΝΑΙ συνδεδεμένος, αλλά το
    // Firebase δεν το έχει αποκαταστήσει ακόμη.
    mockIdentitySettled = false;

    const result = await getAllContacts({ limitCount: 500 });

    // Η ουσία: ΔΕΝ γύρισε πρόωρα.
    expect(queryCallCount).toBe(1);
    // Και πέρασε όντως από την αναμονή — όχι από τύχη χρονισμού.
    expect(mockWaitCallCount).toBe(1);
    expect(result.contacts).toEqual([]);
  });

  it('ΔΕΝ προσποιείται κενή λίστα όταν η ταυτότητα λυθεί σε ΚΑΝΕΝΑΝ — αποτυγχάνει ΟΡΑΤΑ', async () => {
    mockIdentitySettled = false;
    mockSettledUser = null;

    await expect(getAllContacts({ limitCount: 500 })).rejects.toThrow(/AUTHENTICATION_ERROR/);
    expect(queryCallCount).toBe(0);
  });

  it('ο χρήστης χωρίς claim εταιρείας εξακολουθεί να αποτυγχάνει ΟΡΑΤΑ (ADR-745 αμετάβλητο)', async () => {
    mockIdentitySettled = false;
    mockSettledUser = { uid: 'user_test', getIdTokenResult: async () => ({ claims: {} }) };

    await expect(getAllContacts()).rejects.toThrow(/AUTHORIZATION_ERROR/);
    expect(queryCallCount).toBe(0);
  });
});

// ===========================================================================
describe('searchContacts — η ίδια κλάση, η ίδια απάντηση', () => {
  it('ΠΑΡΟΝΟΜΑΣΤΗΣ — με λυμένη ταυτότητα η αναζήτηση ΦΕΥΓΕΙ προς τα δεδομένα', async () => {
    mockIdentitySettled = true;

    await searchContacts({ searchTerm: 'παπ' });

    expect(mockGetAll).toHaveBeenCalledTimes(1);
  });

  it('η αναζήτηση ΔΕΝ κόβεται πριν σταλεί όταν η ταυτότητα δεν έχει λυθεί ακόμη', async () => {
    // Πριν τη διόρθωση: `return []` εδώ σήμαινε «κανένα αποτέλεσμα» για ερώτηση
    // που ΔΕΝ εστάλη ποτέ — και ο άνθρωπος συμπέραινε ότι δεν έχει τον πελάτη του.
    mockIdentitySettled = false;

    await searchContacts({ searchTerm: 'παπ' });

    expect(mockGetAll).toHaveBeenCalledTimes(1);
  });
});
