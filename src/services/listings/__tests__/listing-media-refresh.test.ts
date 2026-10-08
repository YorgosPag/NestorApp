/**
 * @jest-environment node
 *
 * @fileoverview **Η ΔΕΥΤΕΡΗ ΠΗΓΗ ΤΗΣ ΠΡΟΒΟΛΗΣ** — ADR-845 §7.16 (Ο-35).
 * @related services/listings/listing-media-refresh.ts
 *
 * 🔴 **ΤΙ ΦΥΛΑΕΙ**: ότι η αλλαγή ενός αρχείου φτάνει στον **ΕΝΑ** γραφέα με το έγγραφο του
 * ακινήτου **όπως είναι τώρα στη βάση**, και ότι ακίνητο ξένου μισθωτή **δεν** ξαναπροβάλλεται.
 *
 * 🔑 Ο γραφέας είναι **mock επίτηδες**: η κρίση του *(δημοσιεύεται; τι ψήνεται;)* έχει δικές της
 * άγκυρες. Εδώ ρωτάμε μόνο *«τον καλεί; με τι; και τι επιστρέφει όταν δεν πρέπει;»*.
 */

jest.mock('server-only', () => ({}));

const republishListing = jest.fn(async (..._args: unknown[]): Promise<string> => 'published');
const reportProjectionFailure = jest.fn((..._args: unknown[]): string => 'failed');
jest.mock('../publish-public-listing', () => ({
  republishListing: (...args: unknown[]) => republishListing(...args),
  reportProjectionFailure: (...args: unknown[]) => reportProjectionFailure(...args),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { refreshListingAfterMediaChange } = require('../listing-media-refresh') as
  typeof import('../listing-media-refresh');

const PROPERTY = 'prop_48a7caf6-ddeb-4f6b-a074-2d3ddb9daa3b';
const COMPANY = 'comp_alfa';

/** Η βάση όσο τη χρειάζεται η ανάγνωση: ένα έγγραφο, ή ρίψη. */
function dbWith(stored: Record<string, unknown> | undefined | Error): never {
  const requested: string[] = [];
  const db = {
    requested,
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          requested.push(`${name}/${id}`);
          if (stored instanceof Error) throw stored;
          return { data: () => stored };
        },
      }),
    }),
  };
  return db as never;
}

describe('ADR-845 Ο-35 — άλλαξε υλικό της αγγελίας ⇒ ξαναπρόβαλε', () => {
  beforeEach(() => jest.clearAllMocks());

  it('🏆 Α1 — το έγγραφο διαβάζεται ΑΠΟ ΤΗ ΒΑΣΗ και φτάνει στον ΕΝΑ γραφέα, με το `id` δεμένο', async () => {
    const stored = { companyId: COMPANY, publishedFloorplans: ['file_x'], commercialStatus: 'for-sale' };
    const db = dbWith(stored);

    const outcome = await refreshListingAfterMediaChange(db, PROPERTY, COMPANY);

    expect(outcome).toBe('published');
    expect((db as unknown as { requested: string[] }).requested).toEqual([`properties/${PROPERTY}`]);
    expect(republishListing).toHaveBeenCalledTimes(1);
    // 🔑 Ό,τι δήλωσε ο άνθρωπος στο ακίνητο ταξιδεύει **αυτούσιο** — αλλιώς η επαναπροβολή θα
    //    έσβηνε τις κατόψεις και τη σειρά που διαβάζει το `agencyMediaDeclaration`.
    expect(republishListing).toHaveBeenCalledWith(db, PROPERTY, { ...stored, id: PROPERTY });
  });

  it('🔐 Α2 — ακίνητο ΑΛΛΟΥ μισθωτή δεν ξαναπροβάλλεται — `absent`, και ο γραφέας δεν καλείται', async () => {
    const outcome = await refreshListingAfterMediaChange(
      dbWith({ companyId: 'comp_ΑΛΛΗ_ΕΤΑΙΡΕΙΑ' }), PROPERTY, COMPANY,
    );

    expect(outcome).toBe('absent');
    expect(republishListing).not.toHaveBeenCalled();
  });

  it('🔐 Α2β — ακίνητο ΧΩΡΙΣ μισθωτή δεν είναι «κανενός, άρα όλων»', async () => {
    const outcome = await refreshListingAfterMediaChange(dbWith({}), PROPERTY, COMPANY);

    expect(outcome).toBe('absent');
    expect(republishListing).not.toHaveBeenCalled();
  });

  it('Α3 — ακίνητο που ΔΕΝ υπάρχει ⇒ `absent`, όχι `failed`', async () => {
    const outcome = await refreshListingAfterMediaChange(dbWith(undefined), PROPERTY, COMPANY);

    expect(outcome).toBe('absent');
    expect(reportProjectionFailure).not.toHaveBeenCalled();
  });

  it('🔑 Α4 — βλάβη ανάγνωσης ΔΕΝ πετά: ονομάζεται `failed` από τη ΜΙΑ διατύπωση', async () => {
    const down = new Error('firestore unavailable');

    await expect(refreshListingAfterMediaChange(dbWith(down), PROPERTY, COMPANY)).resolves.toBe('failed');

    expect(reportProjectionFailure).toHaveBeenCalledWith(PROPERTY, down);
    expect(republishListing).not.toHaveBeenCalled();
  });

  it('Α5 — η έκβαση του γραφέα ταξιδεύει αυτούσια (`withdrawn` = εκτός αγοράς, όχι σφάλμα)', async () => {
    republishListing.mockImplementationOnce(async () => 'withdrawn');

    await expect(
      refreshListingAfterMediaChange(dbWith({ companyId: COMPANY }), PROPERTY, COMPANY),
    ).resolves.toBe('withdrawn');
  });
});
