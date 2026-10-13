/**
 * @jest-environment node
 *
 * @fileoverview **Ο ΕΝΑΣ ΔΡΟΜΟΣ ΤΗΣ ΠΑΡΟΥΣΙΑΣ ΠΕΡΙΗΓΗΣΗΣ** — ADR-777 §8.88 · ADR-884.
 * @related services/listings/listing-tour-refresh.ts
 *
 * 🔴 **ΤΙ ΦΥΛΑΕΙ**: ότι μια αλλαγή περιήγησης ξαναπροβάλλει την αγγελία **μόνο όταν άλλαξε η απάντηση** (πρώιμη αποκοπή),
 * ότι κάθε είδος ρίζας πηγαίνει στον **δικό του** υπάρχοντα γραφέα, και —το σημαντικότερο— ότι μια **αποτυχία ανάγνωσης**
 * του κριτή δεν σβήνει ποτέ το σήμα μιας αγγελίας που έχει περιήγηση.
 *
 * 🔑 Οι γραφείς και ο κριτής είναι **mock επίτηδες**: έχουν δικές τους άγκυρες. Εδώ ρωτάμε «τους καλεί; πότε; με τι;».
 */

import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

jest.mock('server-only', () => ({}));

const readTourPresence = jest.fn(async (..._args: unknown[]): Promise<unknown> => null);
jest.mock('@/server/spatial-tour/tour-presence', () => ({
  readTourPresence: (...args: unknown[]) => readTourPresence(...args),
}));
jest.mock('@/server/spatial-tour/tour-locate', () => ({
  TOUR_SUBJECT_COLLECTION: { 'owner-property': 'owner_properties', 'company-property': 'properties' },
}));

const republishListing = jest.fn(async (..._args: unknown[]): Promise<string> => 'published');
jest.mock('../publish-public-listing', () => ({
  republishListing: (...args: unknown[]) => republishListing(...args),
}));

const republishOwnerProperty = jest.fn(async (..._args: unknown[]) => ({ publish: 'published', property: {} }));
jest.mock('@/services/owner-property/owner-property-publication.service', () => ({
  republishOwnerProperty: (...args: unknown[]) => republishOwnerProperty(...args),
}));

const OWNER = { id: 'ownp_1', title: 'Σπίτι' };
jest.mock('@/lib/owner-property/owner-property-from-document', () => ({
  ownerPropertyFromDocument: (data: unknown) => (data === undefined ? null : OWNER),
}));

/** Ο δέτης του γραφέα δεν εκτελείται εδώ (οι γραφείς είναι mock) — κρατιέται μόνο η καθαρή περικοπή. */
jest.mock('../listing-publication-facts', () => ({
  listedTourFromPresence: (presence: { readonly visibility: string } | null) =>
    presence === null ? null : { visibility: presence.visibility },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const refresh = require('../listing-tour-refresh') as typeof import('../listing-tour-refresh');
const { refreshListingAfterTourChange, refreshListingOfTour, reconcileListingTours, sameListedTour } = refresh;

const COMPANY_SUBJECT = { kind: 'company-property', id: 'prop_1' } as const;
const OWNER_SUBJECT = { kind: 'owner-property', id: 'ownp_1' } as const;
const PUBLIC = { visibility: 'public' } as const;

type Docs = Readonly<Record<string, Record<string, unknown> | undefined>>;

/** Βάση-λεξικό `συλλογή/id → έγγραφο`. Καταγράφει κάθε ανάγνωση, ώστε η αποκοπή να **μετριέται**. */
function dbWith(docs: Docs): { readonly db: Firestore; readonly reads: string[] } {
  const reads: string[] = [];
  const snapshot = (path: string) => {
    const data = docs[path];
    return { exists: data !== undefined, data: () => data };
  };
  const db = {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          reads.push(`${name}/${id}`);
          return snapshot(`${name}/${id}`);
        },
      }),
      select: () => ({
        get: async () => ({
          docs: Object.keys(docs)
            .filter((path) => path.startsWith(`${name}/`))
            .map((path) => ({ id: path.slice(name.length + 1) })),
        }),
      }),
    }),
  } as unknown as Firestore;
  return { db, reads };
}

const listed = (tour: unknown) => ({ title: 'Αγγελία', type: 'apartment', tour, schemaVersion: 20 });

beforeEach(() => {
  jest.clearAllMocks();
  readTourPresence.mockResolvedValue(null);
});

describe('πρώιμη αποκοπή — ίσο ⇒ ΚΑΜΙΑ εγγραφή', () => {
  it('η αγγελία λέει ήδη «καμία» και ο κριτής συμφωνεί', async () => {
    const { db } = dbWith({ 'public_listings/prop_1': listed(null) });
    await expect(refreshListingAfterTourChange(db, COMPANY_SUBJECT)).resolves.toBe('unchanged');
    expect(republishListing).not.toHaveBeenCalled();
  });

  it('η αγγελία λέει ήδη `public` και ο κριτής συμφωνεί — η ρίζα δεν διαβάζεται καν', async () => {
    readTourPresence.mockResolvedValue({ subject: COMPANY_SUBJECT, visibility: 'public' });
    const { db, reads } = dbWith({ 'public_listings/prop_1': listed(PUBLIC), 'properties/prop_1': { companyId: 'c' } });
    await expect(refreshListingAfterTourChange(db, COMPANY_SUBJECT)).resolves.toBe('unchanged');
    expect(reads).toEqual(['public_listings/prop_1']);
  });

  it('χωρίς δημόσια αγγελία ⇒ `unlisted`, και ο κριτής δεν ρωτιέται', async () => {
    const { db } = dbWith({});
    await expect(refreshListingAfterTourChange(db, COMPANY_SUBJECT)).resolves.toBe('unlisted');
    expect(readTourPresence).not.toHaveBeenCalled();
  });

  it('παλιό έγγραφο χωρίς το πεδίο διαβάζεται ως «καμία» (κρίκος 20), όχι ως αλλαγή', async () => {
    const { db } = dbWith({ 'public_listings/prop_1': { title: 'Παλιά', type: 'apartment' } });
    await expect(refreshListingAfterTourChange(db, COMPANY_SUBJECT)).resolves.toBe('unchanged');
  });
});

describe('η απάντηση άλλαξε ⇒ ο ΥΠΑΡΧΩΝ γραφέας της ρίζας, μία φορά', () => {
  it('εταιρικό ακίνητο → `republishListing`, με το έγγραφο όπως είναι ΤΩΡΑ και το id ως ταυτότητα', async () => {
    readTourPresence.mockResolvedValue({ subject: COMPANY_SUBJECT, visibility: 'public' });
    const { db } = dbWith({ 'public_listings/prop_1': listed(null), 'properties/prop_1': { companyId: 'comp_a', name: 'Α1' } });

    await expect(refreshListingAfterTourChange(db, COMPANY_SUBJECT)).resolves.toBe('published');
    expect(republishListing).toHaveBeenCalledTimes(1);
    expect(republishListing).toHaveBeenCalledWith(db, 'prop_1', { companyId: 'comp_a', name: 'Α1', id: 'prop_1' });
    expect(republishOwnerProperty).not.toHaveBeenCalled();
  });

  it('ακίνητο ιδιώτη → `republishOwnerProperty`, μέσα από το σύνορο ανάγνωσής του', async () => {
    readTourPresence.mockResolvedValue({ subject: OWNER_SUBJECT, visibility: 'on-request' });
    const { db } = dbWith({ 'public_listings/ownp_1': listed(null), 'owner_properties/ownp_1': { title: 'Σπίτι' } });

    await expect(refreshListingAfterTourChange(db, OWNER_SUBJECT)).resolves.toBe('published');
    expect(republishOwnerProperty).toHaveBeenCalledWith(db, OWNER);
    expect(republishListing).not.toHaveBeenCalled();
  });

  it('αλλαγή ΟΡΑΤΟΤΗΤΑΣ (`public` → `on-request`) είναι αλλαγή απάντησης', async () => {
    readTourPresence.mockResolvedValue({ subject: COMPANY_SUBJECT, visibility: 'on-request' });
    const { db } = dbWith({ 'public_listings/prop_1': listed(PUBLIC), 'properties/prop_1': { companyId: 'c' } });
    await expect(refreshListingAfterTourChange(db, COMPANY_SUBJECT)).resolves.toBe('published');
  });

  it('η περιήγηση χάθηκε (`public` → καμία) ⇒ ξαναπροβάλλεται για να ΦΥΓΕΙ το σήμα', async () => {
    const { db } = dbWith({ 'public_listings/prop_1': listed(PUBLIC), 'properties/prop_1': { companyId: 'c' } });
    await expect(refreshListingAfterTourChange(db, COMPANY_SUBJECT)).resolves.toBe('published');
    expect(republishListing).toHaveBeenCalledTimes(1);
  });

  it('αγγελία χωρίς ρίζα ⇒ `absent`, κανένας γραφέας', async () => {
    readTourPresence.mockResolvedValue({ subject: COMPANY_SUBJECT, visibility: 'public' });
    const { db } = dbWith({ 'public_listings/prop_1': listed(null) });
    await expect(refreshListingAfterTourChange(db, COMPANY_SUBJECT)).resolves.toBe('absent');
    expect(republishListing).not.toHaveBeenCalled();
  });
});

describe('🔴 δεν πετά ποτέ — και η αποτυχία ΔΕΝ σβήνει σήμα', () => {
  it('ο κριτής απέτυχε ⇒ `failed`, και η αγγελία με περιήγηση ΔΕΝ ξαναγράφεται ως «καμία»', async () => {
    readTourPresence.mockRejectedValue(new Error('firestore unavailable'));
    const { db } = dbWith({ 'public_listings/prop_1': listed(PUBLIC), 'properties/prop_1': { companyId: 'c' } });

    await expect(refreshListingAfterTourChange(db, COMPANY_SUBJECT)).resolves.toBe('failed');
    expect(republishListing).not.toHaveBeenCalled();
  });

  it('ο γραφέας πέταξε ⇒ `failed`, όχι εξαίρεση προς την πράξη που πέτυχε', async () => {
    readTourPresence.mockResolvedValue({ subject: COMPANY_SUBJECT, visibility: 'public' });
    republishListing.mockRejectedValueOnce(new Error('bucket'));
    const { db } = dbWith({ 'public_listings/prop_1': listed(null), 'properties/prop_1': { companyId: 'c' } });
    await expect(refreshListingAfterTourChange(db, COMPANY_SUBJECT)).resolves.toBe('failed');
  });
});

describe('γραφέας που κρατά μόνο την περιήγηση — η ρίζα διαβάζεται από το ΙΔΙΟ το έγγραφο', () => {
  const tourRef = (data: Record<string, unknown> | undefined): DocumentReference =>
    ({ id: 'tour_1', get: async () => ({ exists: data !== undefined, data: () => data }) }) as unknown as DocumentReference;

  it('έγγραφο που δεν διαβάζεται ως περιήγηση ⇒ `absent`, καμία επαναπροβολή', async () => {
    const { db } = dbWith({});
    await expect(refreshListingOfTour(db, tourRef(undefined))).resolves.toBe('absent');
    await expect(refreshListingOfTour(db, tourRef({ άσχετο: true }))).resolves.toBe('absent');
    expect(republishListing).not.toHaveBeenCalled();
  });

  it('ανάγνωση που πετά ⇒ `failed`, όχι εξαίρεση προς τον ψήστη', async () => {
    const broken = { id: 'tour_1', get: async () => { throw new Error('offline'); } } as unknown as DocumentReference;
    await expect(refreshListingOfTour(dbWith({}).db, broken)).resolves.toBe('failed');
  });
});

describe('το βραδινό δίχτυ — ίδιος δρόμος, με λογιστική', () => {
  it('όλα συμφωνούν ⇒ `healed: 0`, καμία εγγραφή (ιδεμποτικό)', async () => {
    const { db } = dbWith({ 'public_listings/prop_1': listed(null), 'public_listings/ownp_1': listed(null) });
    await expect(reconcileListingTours(db)).resolves.toEqual({ scanned: 2, agreed: 2, healed: 0, failed: 0 });
    expect(republishListing).not.toHaveBeenCalled();
    expect(republishOwnerProperty).not.toHaveBeenCalled();
  });

  it('αγγελία με παλιά απάντηση ⇒ διορθώνεται και ΜΕΤΡΙΕΤΑΙ ως γραφέας που ξέφυγε', async () => {
    readTourPresence.mockImplementation(async (_db, id) => (id === 'prop_1' ? { visibility: 'public' } : null));
    const { db } = dbWith({
      'public_listings/prop_1': listed(null),
      'public_listings/ownp_1': listed(null),
      'properties/prop_1': { companyId: 'c' },
    });
    await expect(reconcileListingTours(db)).resolves.toEqual({ scanned: 2, agreed: 1, healed: 1, failed: 0 });
  });

  it('ταυτότητα που δεν είναι αγγελία παραλείπεται χωρίς κόστος βάσης', async () => {
    const { db, reads } = dbWith({ 'public_listings/κάτι_άλλο': listed(null) });
    await expect(reconcileListingTours(db)).resolves.toEqual({ scanned: 0, agreed: 0, healed: 0, failed: 0 });
    expect(reads).toEqual([]);
  });
});

describe('sameListedTour — η μόνη πληροφορία είναι η ορατότητα', () => {
  it.each([
    [null, null, true],
    [PUBLIC, { visibility: 'public' }, true],
    [PUBLIC, null, false],
    [PUBLIC, { visibility: 'on-request' }, false],
  ] as const)('%j ⇄ %j ⇒ %s', (a, b, same) => {
    expect(sameListedTour(a, b)).toBe(same);
  });
});
