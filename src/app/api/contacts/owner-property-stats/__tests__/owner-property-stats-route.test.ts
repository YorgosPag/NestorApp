/**
 * =============================================================================
 * ADR-842 §7.6.13 Δ — **Η ΔΙΑΔΡΟΜΗ ΠΟΥ ΜΕΤΡΑ, ΧΩΡΙΣ ΝΑ ΣΤΕΛΝΕΙ ΕΓΓΡΑΦΑ**
 * =============================================================================
 *
 * Το ερώτημα: *«συναθροίζει ο **διακομιστής**, περνά από το **ΕΝΑ** σύνορο, και
 * φεύγουν από το δίκτυο **μόνο** δύο αριθμοί ανά ιδιοκτήτη;»*
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ, ΚΑΙ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΟΣ ΛΟΓΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο **N.17** απαγορεύει στον πράκτορα να τρέξει `tsc`. Άρα ένα λάθος **υπογραφής**
 * σε διαδρομή API — λάθος όνομα επιλογής, λάθος σειρά σύνθεσης middleware — δεν
 * πιάνεται από τίποτα μέχρι το pre-commit hook του Giorgio.
 *
 * ⚠️ **Και δεν είναι υποθετικό**: γράφοντας αυτή τη διαδρομή, **δύο** υπογραφές
 * γράφτηκαν λάθος από μνήμη και διορθώθηκαν **μόνο** επειδή κάποιος άνοιξε την πηγή:
 *
 * | Τι γράφτηκε | Τι ισχύει |
 * |---|---|
 * | `withStandardRateLimit(request, () => handler(request))` | είναι **περιτύλιγμα** χειριστή: `withStandardRateLimit(handler)` |
 * | `{ permission: 'contacts:contacts:view' }` | το πεδίο είναι **`permissions`** και η άδεια **`crm:contacts:view`** |
 *
 * ⇒ Αυτή η άγκυρα **εκτελεί** τη διαδρομή. Δεν επικυρώνει τύπους — κάνει κάτι
 * ισχυρότερο: αποδεικνύει ότι η σύνθεση **τρέχει** και ότι απαντά αυτό που υπόσχεται.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΟ ΣΚΕΛΟΣ ΠΟΥ ΔΕΝ ΕΙΝΑΙ ΠΡΟΦΑΝΕΣ: **ΤΙ ΔΕΝ ΦΕΥΓΕΙ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο νεκρός πρόγονος κατέβαζε **ολόκληρα** τα ακίνητα στον browser για να τα μετρήσει.
 * Η θεραπεία δεν είναι «μετράει σωστά» — είναι *«κανένα έγγραφο δεν διασχίζει το
 * δίκτυο»*. Μια άγκυρα που ελέγχει μόνο τα νούμερα θα έμενε **πράσινη** αν κάποιος
 * πρόσθετε αύριο ένα `properties: [...]` στην απάντηση «για ευκολία» — δηλαδή θα
 * φύλαγε το αποτέλεσμα και όχι την **αρχή**.
 */

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withStandardRateLimit: <T>(handler: T) => handler,
}));

const authCtx = { uid: 'user_1', companyId: 'comp_1', globalRole: 'company_admin' };

/** Οι επιλογές που δέχτηκε το `withAuth` — η άγκυρα της **άδειας**. */
const withAuthOptions: Record<string, unknown>[] = [];

jest.mock('@/lib/auth', () => ({
  withAuth: (
    callback: (...args: unknown[]) => Promise<unknown>,
    options: Record<string, unknown>,
  ) => {
    withAuthOptions.push(options);
    return async (request: unknown) => callback(request, authCtx, {});
  },
}));

/** Η εμβέλεια μισθωτή — καταγράφουμε ότι **ζητήθηκε**, δεν την ξαναϋλοποιούμε. */
const scopedCollections: string[] = [];
let docsToReturn: { id: string; data: () => Record<string, unknown> }[] = [];
const whereCalls: unknown[][] = [];

jest.mock('@/lib/auth/tenant-scope', () => ({
  resolveTenantListScopeFromUrl: () => ({ companyId: 'comp_1', isSuperAdmin: false }),
  tenantScopeLabel: () => 'comp_1',
}));

jest.mock('@/lib/firestore/tenant-scoped-query', () => ({
  tenantScopedCollection: (path: string) => {
    scopedCollections.push(path);
    const query = {
      where: (...args: unknown[]) => { whereCalls.push(args); return query; },
      get: async () => ({ docs: docsToReturn }),
    };
    return query;
  },
}));

/**
 * 🔴 **ΤΟ ΣΚΕΛΟΣ ΠΟΥ ΕΛΕΙΠΕ, ΚΑΙ ΤΟ ΑΠΕΔΕΙΞΕ Η ΜΕΤΑΛΛΑΞΗ.**
 *
 * Πρώτη γραφή αυτού του αρχείου: **τέσσερις** μεταλλάξεις κοκκίνισαν, μία **όχι** —
 * η αντικατάσταση του `mapPropertyDoc` με ωμό `{ id, ...doc.data() }` **περνούσε
 * πράσινη**. Και ο λόγος είναι διδακτικός: τα `soldTo`/`area` υπάρχουν **και** στο
 * ωμό έγγραφο, άρα τα **νούμερα βγαίνουν ίδια**. Η άγκυρα φύλαγε το **αποτέλεσμα**
 * και όχι την **αρχή** — δηλαδή ήταν εμφάνιση.
 *
 * ⇒ Το σύνορο είναι **ταυτότητα**, όχι τιμή: η υπόσχεση *«η συλλογή έχει ΕΝΑΝ
 * αναγνώστη»* δεν αποδεικνύεται από τα δεδομένα που βγαίνουν, μόνο από το **ποιος
 * ρωτήθηκε**. Ο κατάσκοπος **εκτελεί τον πραγματικό** mapper (`requireActual`), ώστε
 * η μέτρηση να μένει αληθινή.
 */
const mapperCalls: string[] = [];

jest.mock('@/lib/firestore-mappers', () => {
  const actual = jest.requireActual('@/lib/firestore-mappers');
  return {
    ...actual,
    mapPropertyDoc: (id: string, data: Record<string, unknown>) => {
      mapperCalls.push(id);
      return actual.mapPropertyDoc(id, data);
    },
  };
});

import { GET } from '../route';
import { COLLECTIONS } from '@/config/firestore-collections';

const doc = (id: string, data: Record<string, unknown>) => ({ id, data: () => data });

async function callRoute() {
  const response = await GET({ url: 'http://localhost/api/contacts/owner-property-stats' } as never);
  return (response as unknown as { json: () => Promise<Record<string, unknown>> }).json();
}

beforeEach(() => {
  withAuthOptions.length = 0;
  scopedCollections.length = 0;
  whereCalls.length = 0;
  mapperCalls.length = 0;
  docsToReturn = [];
});

describe('ADR-842 §7.6.13 Δ — /api/contacts/owner-property-stats', () => {
  it('συναθροίζει ανά ιδιοκτήτη και επιστρέφει πλήθος + εμβαδόν', async () => {
    docsToReturn = [
      doc('p1', { soldTo: 'c1', area: 50, name: 'Α1', status: 'sold' }),
      doc('p2', { soldTo: 'c1', area: 70, name: 'Α2', status: 'sold' }),
      doc('p3', { soldTo: 'c2', area: 200, name: 'Β1', status: 'sold' }),
    ];

    const body = await callRoute();

    expect(body).toMatchObject({
      success: true,
      ownerCount: 2,
      stats: {
        c1: { propertiesCount: 2, totalArea: 120 },
        c2: { propertiesCount: 1, totalArea: 200 },
      },
    });
  });

  it('🔴 ΔΕΝ στέλνει ΚΑΝΕΝΑ έγγραφο ακινήτου στο δίκτυο', async () => {
    docsToReturn = [
      doc('p1', { soldTo: 'c1', area: 50, name: 'Μυστικό όνομα', price: 999_999 }),
    ];

    const body = await callRoute();
    const serialized = JSON.stringify(body);

    // Ούτε το όνομα, ούτε η τιμή, ούτε καν το αναγνωριστικό του ακινήτου.
    expect(serialized).not.toContain('Μυστικό όνομα');
    expect(serialized).not.toContain('999999');
    expect(serialized).not.toContain('p1');
    // Τα κλειδιά είναι **ιδιοκτήτες**, όχι ακίνητα.
    expect(Object.keys((body as { stats: object }).stats)).toEqual(['c1']);
  });

  it('ζητά τη συλλογή από την ΠΥΛΗ ΕΜΒΕΛΕΙΑΣ, όχι ωμά', async () => {
    await callRoute();
    expect(scopedCollections).toEqual([COLLECTIONS.PROPERTIES]);
  });

  it('εξαιρεί τα διαγραμμένα (ADR-281) — δεν «κατέχεις» ό,τι είναι στον κάδο', async () => {
    await callRoute();
    expect(whereCalls).toContainEqual(['status', '!=', 'deleted']);
  });

  it('🔴 ΚΑΘΕ έγγραφο περνά από το ΕΝΑ σύνορο ανάγνωσης (mapPropertyDoc)', async () => {
    docsToReturn = [
      doc('p1', { soldTo: 'c1', area: 50 }),
      doc('p2', { soldTo: 'c2', area: 60 }),
      doc('p3', { area: 70 }),
    ];

    await callRoute();

    // Και τα τρία — ακόμη και το αζήτητο, γιατί το σύνορο δεν είναι φίλτρο.
    expect(mapperCalls).toEqual(['p1', 'p2', 'p3']);
  });

  it('ζητά την ΙΔΙΑ άδεια με τη διαδρομή «ιδιοκτησίες επαφής»', async () => {
    await callRoute();
    expect(withAuthOptions[0]).toEqual({ permissions: 'crm:contacts:view' });
  });

  it('ακίνητο χωρίς ιδιοκτήτη δεν γεννά εγγραφή', async () => {
    docsToReturn = [doc('p1', { area: 10 }), doc('p2', { soldTo: 'c1', area: 5 })];

    const body = await callRoute();

    expect((body as { ownerCount: number }).ownerCount).toBe(1);
    expect(Object.keys((body as { stats: object }).stats)).toEqual(['c1']);
  });

  it('κενή βάση δίνει κενό πίνακα, όχι σφάλμα', async () => {
    const body = await callRoute();
    expect(body).toMatchObject({ success: true, ownerCount: 0, stats: {} });
  });
});
