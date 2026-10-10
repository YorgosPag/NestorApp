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
 *
 * 🏢 **ΦΑ — η φρεσκάδα των αδελφών αγγελιών** *(ADR-907 §11.8)*: ο ΕΝΑΣ τόπος της διάδοσης. Μονάδα που άλλαξε ξυπνά
 * μόνο ορόφους **με δήλωση**, μία φορά τον καθένα· αρχείο ορόφου περνά από τον ίδιο δρόμο· το ακίνητο ξαναπροβάλλει
 * πρώτα τη δική του αγγελία· και **καμία** πόρτα δεν καλεί πια τον γραφέα απευθείας (ΦΑ-5, κλειστότητα).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

import { ROLE_REQUIRES_LINK } from '@/types/floorplan-overlays';

jest.mock('server-only', () => ({}));

const republishListing = jest.fn(async (..._args: unknown[]): Promise<string> => 'published');
const reportProjectionFailure = jest.fn((..._args: unknown[]): string => 'failed');
jest.mock('../publish-public-listing', () => ({
  republishListing: (...args: unknown[]) => republishListing(...args),
  reportProjectionFailure: (...args: unknown[]) => reportProjectionFailure(...args),
}));

/** Ο αναγνώστης ορόφου και ο βρόχος με εμβέλεια έχουν δικές τους άγκυρες (ΑΟ-5 · ΕΒ) — εδώ κρίνεται η **καλωδίωση**. */
const readFloorsShowingUnit = jest.fn(async (..._args: unknown[]): Promise<readonly string[]> => []);
const hasFloorPlateDeclaration = jest.fn(async (..._args: unknown[]): Promise<boolean> => true);
jest.mock('../floor-plate.reader', () => ({
  readFloorsShowingUnit: (...args: unknown[]) => readFloorsShowingUnit(...args),
  hasFloorPlateDeclaration: (...args: unknown[]) => hasFloorPlateDeclaration(...args),
}));

const PASS = { resolveAgency: async () => null, resolveMedia: async () => [] };
const republishListingsInScope = jest.fn(async (..._args: unknown[]): Promise<readonly unknown[]> => []);
jest.mock('../listing-scope-republish', () => ({
  createListingPass: () => PASS,
  republishListingsInScope: (...args: unknown[]) => republishListingsInScope(...args),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const refresh = require('../listing-media-refresh') as typeof import('../listing-media-refresh');
const { refreshListingAfterMediaChange } = refresh;

const PROPERTY = 'prop_48a7caf6-ddeb-4f6b-a074-2d3ddb9daa3b';
const COMPANY = 'comp_alfa';
const REPO_SRC = join(__dirname, '..', '..', '..');

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

// ============================================================================
// ΦΑ — Η ΦΡΕΣΚΑΔΑ ΤΩΝ ΑΔΕΛΦΩΝ ΑΓΓΕΛΙΩΝ (ADR-907 §11.8)
// ============================================================================

const DB = { name: 'η βάση — αδιαφανής, την αγγίζουν μόνο οι mock αναγνώστες' } as never;
const floorScope = (floorId: string) => ({ kind: 'floor', floorId, companyId: COMPANY });
const scopes = (): unknown[] => republishListingsInScope.mock.calls.map((call) => call[1]);

/** Κάθε αρχείο παραγωγής κάτω από έναν φάκελο του `src/` — για την κλειστότητα της ΦΑ-5. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

describe('ADR-907 §11.8 — ΦΑ: άλλαξε μονάδα ⇒ οι αγγελίες των ορόφων όπου φαίνεται συμφωνούν ξανά', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    readFloorsShowingUnit.mockImplementation(async () => []);
    hasFloorPlateDeclaration.mockImplementation(async () => true);
    republishListingsInScope.mockImplementation(async () => []);
  });

  it('🏆 ΦΑ-1 — μόνο όροφος ΜΕ ΔΗΛΩΣΗ ξυπνά· χωρίς δήλωση σταματά στη μία ανάγνωση', async () => {
    readFloorsShowingUnit.mockImplementation(async () => ['flr_declared', 'flr_plain']);
    hasFloorPlateDeclaration.mockImplementation(async (_db, _company, floorId) => floorId === 'flr_declared');
    republishListingsInScope.mockImplementation(async () => [{ propertyId: 'prop_sister', outcome: 'published' }]);

    const reports = await refresh.refreshFloorPlateNeighbours(DB, [{ link: 'parkingId', unitId: 'park_1', companyId: COMPANY }]);

    expect(readFloorsShowingUnit).toHaveBeenCalledWith(DB, COMPANY, expect.objectContaining({ link: 'parkingId', unitId: 'park_1' }));
    expect(scopes()).toEqual([floorScope('flr_declared')]);
    expect(reports).toEqual([{ propertyId: 'prop_sister', outcome: 'published' }]);
  });

  it('ΦΑ-2 — δύο μονάδες του ΙΔΙΟΥ ορόφου ⇒ ΕΝΑ πέρασμα· μονάδα χωρίς χώρο δεν ρωτά καν', async () => {
    readFloorsShowingUnit.mockImplementation(async () => ['flr_1']);

    await refresh.refreshFloorPlateNeighbours(DB, [
      { link: 'parkingId', unitId: 'park_1', companyId: COMPANY },
      { link: 'storageId', unitId: 'stor_1', companyId: COMPANY },
      { link: 'propertyId', unitId: 'prop_ορφανό', companyId: undefined },
      { link: 'propertyId', unitId: 'prop_κενό', companyId: '  ' },
    ]);

    expect(readFloorsShowingUnit).toHaveBeenCalledTimes(2);
    expect(scopes()).toEqual([floorScope('flr_1')]);
  });

  it('🔑 ΦΑ-3 — δεν πετά ποτέ: βλάβη στα περιγράμματα ή στη δήλωση ⇒ κενή απάντηση, και ο επόμενος όροφος προχωρά', async () => {
    readFloorsShowingUnit.mockImplementationOnce(async () => { throw new Error('UNAVAILABLE'); });
    await expect(
      refresh.refreshFloorPlateNeighbours(DB, [{ link: 'propertyId', unitId: PROPERTY, companyId: COMPANY }]),
    ).resolves.toEqual([]);

    readFloorsShowingUnit.mockImplementation(async () => ['flr_broken', 'flr_ok']);
    hasFloorPlateDeclaration.mockImplementation(async (_db, _company, floorId) => {
      if (floorId === 'flr_broken') throw new Error('UNAVAILABLE');
      return true;
    });
    await refresh.refreshFloorPlateNeighbours(DB, [{ link: 'propertyId', unitId: PROPERTY, companyId: COMPANY }]);

    expect(scopes()).toEqual([floorScope('flr_ok')]);
  });

  it('🏆 ΦΑ-4 — το ακίνητο: η ΔΙΚΗ του αγγελία πρώτη και χωρίς όρους, οι αδελφές μετά, με τον ΙΔΙΟ επιλυτή', async () => {
    const order: string[] = [];
    const property = { id: PROPERTY, companyId: COMPANY, commercialStatus: 'reserved' };
    republishListing.mockImplementationOnce(async () => { order.push('self'); return 'withdrawn'; });
    readFloorsShowingUnit.mockImplementation(async () => { order.push('floors'); return ['flr_1']; });
    republishListingsInScope.mockImplementation(async () => { order.push('sisters'); return []; });

    const outcome = await refresh.republishListingOfChangedUnit(DB, PROPERTY, property as never);

    expect(outcome).toBe('withdrawn');
    expect(order).toEqual(['self', 'floors', 'sisters']);
    expect(republishListing).toHaveBeenCalledWith(DB, PROPERTY, property, PASS.resolveAgency, PASS.resolveMedia);
    expect(readFloorsShowingUnit).toHaveBeenCalledWith(DB, COMPANY, expect.objectContaining({ link: 'propertyId', unitId: PROPERTY }));
    expect(republishListingsInScope).toHaveBeenCalledWith(DB, floorScope('flr_1'), PASS);
  });

  it('ΦΑ-4β — αποτυχία της δικής του αγγελίας δεν κόβει τη διάδοση· αποτυχία της διάδοσης δεν αλλάζει την έκβαση', async () => {
    republishListing.mockImplementationOnce(async () => 'failed');
    readFloorsShowingUnit.mockImplementation(async () => { throw new Error('UNAVAILABLE'); });

    await expect(
      refresh.republishListingOfChangedUnit(DB, PROPERTY, { id: PROPERTY, companyId: COMPANY } as never),
    ).resolves.toBe('failed');
    expect(readFloorsShowingUnit).toHaveBeenCalledTimes(1);
  });

  it('🔴 ΦΑ-5 — ΚΛΕΙΣΤΟΤΗΤΑ: έξω από το `services/listings` ΚΑΝΕΙΣ δεν καλεί τον γραφέα απευθείας', () => {
    const roots = ['app', 'lib', 'services', 'components', 'hooks'].map((dir) => join(REPO_SRC, dir));
    const files = roots.flatMap((root) => sourceFiles(root));
    const rel = (file: string): string => file.split(sep).join('/').split('/src/')[1];

    // Παρονομαστής: το πράσινο δεν επιτρέπεται να σημαίνει «δεν κοίταξα».
    expect(files.length).toBeGreaterThan(3000);
    expect(files.map(rel)).toContain('app/api/properties/[id]/property-publish-projection.ts');
    expect(files.map(rel)).toContain('services/property/property-lifecycle-effects.ts');

    const offenders = files
      .filter((file) => !rel(file).startsWith('services/listings/'))
      .filter((file) => /\brepublishListing\(/.test(readFileSync(file, 'utf8')))
      .map(rel);

    expect(offenders).toEqual([]);
  });

  it('ΦΑ-6 — αρχείο ΟΡΟΦΟΥ είναι υλικό κάθε αγγελίας του: περνά από τον ίδιο δρόμο, μία φορά ανά όροφο', async () => {
    const files = [
      { entityType: 'floor', entityId: 'flr_1', companyId: COMPANY },
      { entityType: 'floor', entityId: 'flr_1', companyId: COMPANY },
      { entityType: 'floor', entityId: 'flr_plain', companyId: COMPANY },
      { entityType: 'contact', entityId: 'cont_1', companyId: COMPANY },
      { entityType: 'floor', entityId: 'flr_ορφανός' },
    ];
    hasFloorPlateDeclaration.mockImplementation(async (_db, _company, floorId) => floorId === 'flr_1');
    republishListingsInScope.mockImplementation(async () => [{ propertyId: 'prop_sister', outcome: 'published' }]);

    const reports = await refresh.refreshListingsAfterFileChanges(DB, files);

    expect(hasFloorPlateDeclaration.mock.calls.map((call) => call[2])).toEqual(['flr_1', 'flr_plain']);
    expect(scopes()).toEqual([floorScope('flr_1')]);
    expect(reports).toEqual([{ propertyId: 'prop_sister', outcome: 'published' }]);
    // Τα περιγράμματα δεν ρωτιούνται: ο όροφος είναι ήδη γνωστός από το ίδιο το αρχείο.
    expect(readFloorsShowingUnit).not.toHaveBeenCalled();
  });

  it('ΦΑ-6β — αρχείο ΑΚΙΝΗΤΟΥ εξακολουθεί να ξαναπροβάλλει το ακίνητό του, και μόνο αυτό', async () => {
    const reports = await refresh.refreshListingsAfterFileChanges(
      dbWith({ companyId: COMPANY }),
      [{ entityType: 'property', entityId: PROPERTY, companyId: COMPANY }],
    );

    expect(reports).toEqual([{ propertyId: PROPERTY, outcome: 'published' }]);
    expect(hasFloorPlateDeclaration).not.toHaveBeenCalled();
  });

  it('ΦΑ-7 — `refreshListingsOfFloor` είναι η εμβέλεια `floor` του ΕΝΟΣ βρόχου, και δεν πετά', async () => {
    await refresh.refreshListingsOfFloor(DB, 'flr_1', COMPANY);
    expect(republishListingsInScope).toHaveBeenCalledWith(DB, floorScope('flr_1'), undefined);

    republishListingsInScope.mockImplementationOnce(async () => { throw new Error('UNAVAILABLE'); });
    await expect(refresh.refreshListingsOfFloor(DB, 'flr_1', COMPANY)).resolves.toEqual([]);
  });

  it('ΦΑ-8 — το κλειδί δεσμού κάθε είδους χώρου είναι αυτό του ΕΝΟΣ μητρώου ρόλων', () => {
    expect(refresh.SPACE_OVERLAY_LINK.parking).toBe(ROLE_REQUIRES_LINK.parking);
    expect(refresh.SPACE_OVERLAY_LINK.storage).toBe(ROLE_REQUIRES_LINK.storage);
  });
});
