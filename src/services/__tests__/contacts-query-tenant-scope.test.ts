/**
 * Anchor — `getAllContacts` ΠΡΕΠΕΙ να στέλνει tenant-scoped query (ADR-745)
 *
 * ## Γιατί υπάρχει
 *
 * Το `buildContactsQuery` έχτιζε `collection('contacts').orderBy('updatedAt').limit(N)`
 * **χωρίς κανένα `where('companyId', …)`**, ενώ ο κανόνας READ
 * (`firestore.rules:1579-1589`) κρίνει με `resource.data.companyId` για κάθε
 * μη-super-admin. Σε **list** ό,τι διαβάζει ο κανόνας και δεν το περιορίζει το query
 * είναι `undefined` ⇒ απόρριψη ολόκληρου του query. Αποτέλεσμα: η αναζήτηση επαφών
 * απέτυχε για **κάθε πραγματικό χρήστη** και δούλευε μόνο για super admin.
 *
 * ## Γιατί ΔΕΝ αρκεί το rules test
 *
 * Το `tests/firestore-rules/suites/contacts-list-tenant-query.rules.test.ts`
 * αποδεικνύει τη συμπεριφορά του **κανόνα** — στέλνει το query μόνο του. Αν αύριο
 * κάποιος αφαιρέσει το φίλτρο από τον παραγωγικό κώδικα, εκείνο το suite μένει
 * **πράσινο**. Αυτό εδώ είναι το μόνο που βλέπει τι **παράγει** ο κώδικας.
 * (Ακριβώς το σχήμα που κατέρρευσε: το `contacts.rules.test.ts` δηλώνει
 * `listFilter: companyId` και έτσι δοκίμαζε query που η εφαρμογή δεν κάνει ποτέ.)
 *
 * @module services/__tests__/contacts-query-tenant-scope
 * @see ADR-745
 * @see ADR-356 — `resolveEffectiveCompanyId` SSoT + super-admin switcher
 */

// ---------------------------------------------------------------------------
// Καταγραφή constraints: κάθε `where/orderBy/limit` γίνεται περιγράψιμο object
// ---------------------------------------------------------------------------

interface WhereClause {
  readonly __kind: 'where';
  readonly field: string;
  readonly op: string;
  readonly value: unknown;
}

/** Τα constraints της τελευταίας κλήσης `query()`. */
let lastQueryConstraints: unknown[] = [];

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({ __collection: true })),
  doc: jest.fn(() => ({ __doc: true })),
  where: jest.fn((field: string, op: string, value: unknown) => ({
    __kind: 'where', field, op, value,
  })),
  orderBy: jest.fn((field: string, dir?: string) => ({ __kind: 'orderBy', field, dir })),
  limit: jest.fn((n: number) => ({ __kind: 'limit', n })),
  startAfter: jest.fn(() => ({ __kind: 'startAfter' })),
  query: jest.fn((_ref: unknown, ...constraints: unknown[]) => {
    lastQueryConstraints = constraints;
    return { __query: true, constraints };
  }),
  getDocs: jest.fn(async () => ({ docs: [], size: 0, empty: true })),
  writeBatch: jest.fn(),
  serverTimestamp: jest.fn(() => ({ __serverTimestamp: true })),
  DocumentSnapshot: class {},
  QuerySnapshot: class {},
}));

// ---------------------------------------------------------------------------
// Auth: πραγματικά claims, ώστε να δοκιμάζεται η ΑΛΥΣΙΔΑ claim → φίλτρο
// (δεν κάνουμε mock το `auth-context` — αυτό είναι το υπό δοκιμή συμβόλαιο)
// ---------------------------------------------------------------------------

const COMPANY_A = 'comp_aaaaaaaaaaaaaaaaaaaaaa';
const COMPANY_B = 'comp_bbbbbbbbbbbbbbbbbbbbbb';

let mockClaims: { companyId?: string; globalRole?: string } = {};

jest.mock('@/lib/firebase', () => ({
  db: { __mockDb: true },
  auth: {
    get currentUser() {
      return {
        uid: 'user_test',
        getIdTokenResult: async () => ({ claims: mockClaims }),
      };
    },
  },
}));

// Το `auth-context` εισάγει `onAuthStateChanged`· χωρίς mock ο jest τραβά το
// node build του `@firebase/auth` που απαιτεί global `fetch` (απών σε jsdom).
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn((_auth: unknown, cb: (u: unknown) => void) => {
    cb({ uid: 'user_test' });
    return () => undefined;
  }),
}));

let mockSuperAdminActiveCompany: string | null = null;
jest.mock('@/services/firestore/super-admin-active-company', () => ({
  getSuperAdminActiveCompanyId: () => mockSuperAdminActiveCompany,
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

jest.mock('@/services/firestore/firestore-query.service', () => ({
  firestoreQueryService: { getAll: jest.fn(), subscribe: jest.fn() },
}));

jest.mock('@/services/enterprise-id.service', () => ({
  generateContactId: jest.fn(() => 'cont_test'),
}));

// SUT — import AFTER mocks
import { getAllContacts } from '../contacts-query.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tenantFilters(): WhereClause[] {
  return lastQueryConstraints.filter(
    (c): c is WhereClause =>
      typeof c === 'object' && c !== null &&
      (c as WhereClause).__kind === 'where' &&
      (c as WhereClause).field === 'companyId',
  );
}

beforeEach(() => {
  lastQueryConstraints = [];
  mockClaims = {};
  mockSuperAdminActiveCompany = null;
});

describe('getAllContacts — tenant scope (ADR-745)', () => {
  it('στέλνει where(companyId) για κανονικό χρήστη', async () => {
    mockClaims = { companyId: COMPANY_A, globalRole: 'company_admin' };

    await getAllContacts();

    expect(tenantFilters()).toEqual([
      { __kind: 'where', field: 'companyId', op: '==', value: COMPANY_A },
    ]);
  });

  it('κρατά το φίλτρο ΚΑΙ όταν συνυπάρχουν άλλα options', async () => {
    mockClaims = { companyId: COMPANY_A, globalRole: 'internal_user' };

    await getAllContacts({ type: 'individual', onlyFavorites: true, limitCount: 20 });

    // Το tenant φίλτρο δεν «χάνεται» σε κανένα κλαδί — και τα indexes
    // [7]/[8]/[9] του `firestore.indexes.json` καλύπτουν ήδη τους συνδυασμούς.
    expect(tenantFilters()).toEqual([
      { __kind: 'where', field: 'companyId', op: '==', value: COMPANY_A },
    ]);
  });

  it('το φίλτρο προηγείται των υπόλοιπων constraints', async () => {
    mockClaims = { companyId: COMPANY_A, globalRole: 'internal_user' };

    await getAllContacts({ type: 'company' });

    const first = lastQueryConstraints[0] as WhereClause;
    expect(first.__kind).toBe('where');
    expect(first.field).toBe('companyId');
  });

  it('super admin ΜΕ επιλογή switcher φιλτράρει στην ΕΠΙΛΕΓΜΕΝΗ εταιρεία, όχι στο claim του', async () => {
    mockClaims = { companyId: COMPANY_A, globalRole: 'super_admin' };
    mockSuperAdminActiveCompany = COMPANY_B;

    await getAllContacts();

    expect(tenantFilters()).toEqual([
      { __kind: 'where', field: 'companyId', op: '==', value: COMPANY_B },
    ]);
  });

  it('super admin ΧΩΡΙΣ επιλογή δεν φιλτράρει (cross-tenant προβολή που ο κανόνας επιτρέπει)', async () => {
    mockClaims = { companyId: COMPANY_A, globalRole: 'super_admin' };
    mockSuperAdminActiveCompany = null;

    await getAllContacts();

    expect(tenantFilters()).toEqual([]);
  });

  it('χρήστης χωρίς claim εταιρείας αποτυγχάνει ΟΡΑΤΑ, δεν διαρρέει ανφίλτραρο query', async () => {
    mockClaims = { globalRole: 'internal_user' };

    await expect(getAllContacts()).rejects.toThrow(/AUTHORIZATION_ERROR/);
    expect(lastQueryConstraints).toEqual([]);
  });
});
