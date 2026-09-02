/**
 * @jest-environment node
 *
 * @fileoverview **Η ΑΓΚΥΡΑ ΤΗΣ ΣΥΛΛΟΓΗΣ ΤΟΥ ΓΡΑΦΕΙΟΥ** — από το `properties/{id}` ως το ράφι.
 * @related ADR-841 §7 Α14 · services/listings/agency-media-publication · agency-media.reader
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΡΩΤΑ ΑΥΤΗ Η ΣΟΥΙΤΑ ΠΟΥ ΚΑΜΙΑ ΑΛΛΗ ΔΕΝ ΡΩΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   **Έφτασε ΤΙΜΗ από τη συλλογή `files` ως το δημόσιο ράφι;**
 *
 * Το `publishedMedia` είναι **προαιρετικό** πεδίο. Αντικείμενο **χωρίς** αυτό ικανοποιεί
 * τον τύπο ⇒ ο μεταγλωττιστής είναι **δομικά ανίκανος** να δει ότι κανείς δεν το γεμίζει.
 * Μετρημένο **τρεις** φορές στο ίδιο ADR *(Α2.10 εύρημα 3 · Α13 εύρημα 3 · Α14)*:
 *
 *   > **Ο φρουρός των υποχρεωτικών πεδίων είναι ο τύπος.**
 *   > **Ο φρουρός των ΠΡΟΑΙΡΕΤΙΚΩΝ είναι μόνο άγκυρα που περνά ΤΙΜΗ από το σύνορο.**
 *
 * Γι' αυτό ο επιλυτής φωτογραφιών εδώ **ΔΕΝ είναι mock**: τρέχει ο αληθινός αναγνώστης
 * πάνω σε αληθινό ερώτημα, και ο αληθινός κανόνας επιλογής. Ό,τι φτάνει στο ράφι ήρθε
 * από έγγραφα `files`. **Μετάλλαξη**: σβήσε το `resolveMedia(...)` από τον γραφέα ⇒ το
 * Κ1 κοκκινίζει.
 *
 * ⛔ **Και η δεύτερη ερώτηση είναι εξίσου σοβαρή**: *μπήκε στο ράφι κάτι που κανείς δεν
 * επέλεξε;* Το Κ2 κρατά τον δεύτερο φρουρό ζωντανό — **κατόψεις και συμβόλαια δεν
 * δημοσιεύονται ΟΥΤΕ ΚΑΝ όταν κάποιος τα σημάνει `public`**.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { PublicShelfReport } from '../public-shelf.service';
import type { AgencyMediaCandidate } from '../agency-media-publication';

const reconcilePublicShelf = jest.fn<Promise<PublicShelfReport>, [string, readonly unknown[]]>();

jest.mock('../public-shelf.service', () => ({
  reconcilePublicShelf: (...args: [string, readonly unknown[]]) => reconcilePublicShelf(...args),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { republishListing } = require('../publish-public-listing') as
  typeof import('../publish-public-listing');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { publishedAgencyMediaSources } = require('../agency-media-publication') as
  typeof import('../agency-media-publication');

const LISTING = 'prop_a0000002-7777-4aaa-8aaa-000000000002';
const COMPANY = 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757';

/** Το ωμό `properties/{id}` — **χωρίς κανένα πεδίο αρχείων**, όπως στη ζωντανή βάση. */
const PROPERTY = {
  id: LISTING,
  companyId: COMPANY,
  name: 'ΔΟΚΙΜΗ Β',
  type: 'apartment',
  commercialStatus: 'for-sale',
  areas: { gross: 70 },
  commercial: { askingPrice: 150000 },
} as const;

/** Ένα `FileRecord` όπως το γράφει ο enterprise αγωγός — τα πεδία που κρίνουν. */
function fileDoc(over: Partial<AgencyMediaCandidate> & { id: string }): AgencyMediaCandidate {
  return {
    entityType: 'property',
    storagePath: `companies/${COMPANY}/entities/property/${LISTING}/photos/${over.id}.jpg`,
    category: 'photos',
    classification: 'public',
    contentType: 'image/jpeg',
    status: 'ready',
    createdAt: '2026-08-20T10:00:00.000Z',
    lifecycleState: 'active',
    isDeleted: false,
    ...over,
  };
}

/** Τα έγγραφα που θα «βρει» το ερώτημα αυτού του περάσματος. */
let filesInCollection: AgencyMediaCandidate[] = [];
/** Τα φίλτρα που ζήτησε πράγματι ο αναγνώστης — το Κ4 τα διαβάζει. */
let askedFilters: [string, string, unknown][] = [];

const listingRef = {
  set: jest.fn(async () => undefined),
  delete: jest.fn(async () => undefined),
};

function filesQuery() {
  const query = {
    where: (field: string, op: string, value: unknown) => {
      askedFilters.push([field, op, value]);
      return query;
    },
    get: async () => ({
      docs: filesInCollection.map((file) => ({ id: file.id, data: () => file })),
    }),
  };
  return query;
}

const adminDb = {
  collection: (name: string) =>
    name === COLLECTIONS.FILES ? filesQuery() : { doc: () => listingRef },
} as never;

/** Το γραφείο έχει επωνυμία — δεν είναι το θέμα εδώ, οπότε δίνεται έτοιμη. */
const resolveAgency = async () => ({ id: COMPANY, name: 'ΠΑΓΩΝΗΣ Α.Ε.' });

/** Τα μονοπάτια που ζητήθηκαν από το ράφι, στη σειρά που ζητήθηκαν. */
function shelfPaths(): string[] {
  const call = reconcilePublicShelf.mock.calls[0];
  return ((call?.[1] ?? []) as { privateStoragePath: string }[]).map((s) => s.privateStoragePath);
}

beforeEach(() => {
  filesInCollection = [];
  askedFilters = [];
  listingRef.set.mockClear();
  listingRef.delete.mockClear();
  reconcilePublicShelf.mockReset();
  reconcilePublicShelf.mockResolvedValue({
    outcome: 'reconciled',
    published: [],
    removed: 0,
    rejected: 0,
  });
});

describe('Κ1 — Η ΤΙΜΗ ΤΑΞΙΔΕΥΕΙ: `files` → γραφέας → ράφι', () => {
  it('🔴 φωτογραφία σημασμένη δημόσια ΦΤΑΝΕΙ στο ράφι, από ακίνητο ΧΩΡΙΣ πεδίο αρχείων', async () => {
    filesInCollection = [fileDoc({ id: 'file_a' })];

    const outcome = await republishListing(adminDb, LISTING, PROPERTY, resolveAgency);

    expect(outcome).toBe('published');
    expect(reconcilePublicShelf).toHaveBeenCalledTimes(1);
    expect(shelfPaths()).toEqual([
      `companies/${COMPANY}/entities/property/${LISTING}/photos/file_a.jpg`,
    ]);
  });

  it('κανένα δημόσιο αρχείο ⇒ κενό ράφι, και η αγγελία δημοσιεύεται ΚΑΝΟΝΙΚΑ', async () => {
    filesInCollection = [fileDoc({ id: 'file_a', classification: 'internal' })];

    const outcome = await republishListing(adminDb, LISTING, PROPERTY, resolveAgency);

    expect(outcome).toBe('published');
    expect(shelfPaths()).toEqual([]);
  });
});

describe('Κ2 — ⛔ Ο ΔΕΥΤΕΡΟΣ ΦΡΟΥΡΟΣ: τι ΔΕΝ γίνεται δημόσιο, ούτε κατά λάθος', () => {
  it('🔴 ΚΑΤΟΨΗ σημασμένη `public` ΔΕΝ δημοσιεύεται — η κατηγορία είναι χωριστή ερώτηση', async () => {
    filesInCollection = [
      fileDoc({
        id: 'file_dxf',
        category: 'floorplans',
        contentType: 'application/dxf',
        classification: 'public',
      }),
    ];

    await republishListing(adminDb, LISTING, PROPERTY, resolveAgency);

    expect(shelfPaths()).toEqual([]);
  });

  it('🔴 ΣΥΜΒΟΛΑΙΟ σημασμένο `public` ΔΕΝ δημοσιεύεται', async () => {
    filesInCollection = [
      fileDoc({
        id: 'file_pdf',
        category: 'contracts',
        contentType: 'application/pdf',
        classification: 'public',
      }),
    ];

    await republishListing(adminDb, LISTING, PROPERTY, resolveAgency);

    expect(shelfPaths()).toEqual([]);
  });

  it('🔴 αρχείο ΧΩΡΙΣ `classification` ΔΕΝ δημοσιεύεται — η σιωπή σημαίνει ιδιωτικό', () => {
    const untouched = fileDoc({ id: 'file_x' });
    delete (untouched as { classification?: unknown }).classification;

    expect(publishedAgencyMediaSources([untouched])).toEqual([]);
  });

  it('`confidential` και `internal` ΔΕΝ δημοσιεύονται', () => {
    expect(
      publishedAgencyMediaSources([
        fileDoc({ id: 'f1', classification: 'confidential' }),
        fileDoc({ id: 'f2', classification: 'internal' }),
      ]),
    ).toEqual([]);
  });

  it('στα σκουπίδια, αρχειοθετημένο, ή μη έτοιμο ⇒ ΔΕΝ δημοσιεύεται', () => {
    expect(
      publishedAgencyMediaSources([
        fileDoc({ id: 'f1', isDeleted: true }),
        fileDoc({ id: 'f2', lifecycleState: 'trashed' }),
        fileDoc({ id: 'f3', lifecycleState: 'archived' }),
        fileDoc({ id: 'f4', status: 'pending' }),
      ]),
    ).toEqual([]);
  });

  it('αρχείο άλλης οντότητας ΔΕΝ δημοσιεύεται, ακόμη κι αν το ερώτημα το επέστρεφε', () => {
    expect(publishedAgencyMediaSources([fileDoc({ id: 'f1', entityType: 'project' })])).toEqual([]);
  });
});

describe('Κ3 — Η ΣΕΙΡΑ ΕΙΝΑΙ ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΗ, και το όριο είναι ΕΝΑ', () => {
  it('🔑 παλαιότερο πρώτο· ίδια στιγμή ⇒ ισοπαλία στο `id`, ποτέ στην τύχη του `sort`', () => {
    const sources = publishedAgencyMediaSources([
      fileDoc({ id: 'file_c', createdAt: '2026-08-20T12:00:00.000Z' }),
      fileDoc({ id: 'file_b', createdAt: '2026-08-20T10:00:00.000Z' }),
      fileDoc({ id: 'file_a', createdAt: '2026-08-20T10:00:00.000Z' }),
    ]);

    expect(sources.map((s) => s.privateStoragePath.split('/').pop())).toEqual([
      'file_a.jpg',
      'file_b.jpg',
      'file_c.jpg',
    ]);
  });

  it('δέχεται Firestore Timestamp όπως τον επιστρέφει το Admin SDK, όχι μόνο ISO', () => {
    const sources = publishedAgencyMediaSources([
      fileDoc({ id: 'file_new', createdAt: { _seconds: 1787240938, _nanoseconds: 0 } as never }),
      fileDoc({ id: 'file_old', createdAt: { _seconds: 1787240527, _nanoseconds: 0 } as never }),
    ]);

    expect(sources.map((s) => s.privateStoragePath.split('/').pop())).toEqual([
      'file_old.jpg',
      'file_new.jpg',
    ]);
  });

  it('🔑 το όριο είναι ΤΟ ΙΔΙΟ με του ιδιώτη — 24, μία σταθερά', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PUBLISHED_MEDIA_LIMIT } = require('@/lib/owner-property/owner-media-publication') as
      typeof import('@/lib/owner-property/owner-media-publication');

    const many = Array.from({ length: PUBLISHED_MEDIA_LIMIT + 5 }, (_, index) =>
      fileDoc({ id: `file_${String(index).padStart(3, '0')}` }),
    );

    expect(publishedAgencyMediaSources(many)).toHaveLength(PUBLISHED_MEDIA_LIMIT);
  });
});

describe('Κ4 — ΚΗΔΕΜΟΝΙΑ: το ερώτημα ΔΕΝ γίνεται ποτέ πλατύτερο από τον μισθωτή', () => {
  it('🔴 ρωτά με `companyId` + οντότητα + κατηγορία — ποτέ σάρωση όλης της `files`', async () => {
    filesInCollection = [fileDoc({ id: 'file_a' })];

    await republishListing(adminDb, LISTING, PROPERTY, resolveAgency);

    expect(askedFilters).toEqual([
      ['companyId', '==', COMPANY],
      ['entityType', '==', 'property'],
      ['entityId', '==', LISTING],
      ['category', '==', 'photos'],
    ]);
  });

  it('🔴 ακίνητο ΧΩΡΙΣ `companyId` ⇒ ΚΑΝΕΝΑ ερώτημα, κενό ράφι', async () => {
    filesInCollection = [fileDoc({ id: 'file_a' })];

    await republishListing(
      adminDb,
      LISTING,
      { ...PROPERTY, companyId: null },
      async () => ({ id: null, name: null }),
    );

    expect(askedFilters).toEqual([]);
    expect(shelfPaths()).toEqual([]);
  });
});
