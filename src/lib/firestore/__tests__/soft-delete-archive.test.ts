/**
 * ⚓ Η μηχανή κύκλου ζωής — το **αρχείο** (ADR-281 · ADR-329 §3.9)
 *
 * Κάδος και αρχείο είναι δύο έννοιες στην ΙΔΙΑ μηχανή και στο ΙΔΙΟ πεδίο. Αυτό το αρχείο
 * καρφώνει ό,τι τις ξεχωρίζει και ό,τι τις δένει:
 *   - το αρχείο δεν έχει προθεσμία, και υπάρχει μόνο όπου το δηλώνει το μητρώο·
 *   - το `previousStatus` κρατά πάντα την τελευταία ΖΩΝΤΑΝΗ κατάσταση, όσες αποσύρσεις κι αν
 *     μεσολαβήσουν — αλλιώς η επαναφορά θα γύριζε την εγγραφή σε «deleted» ή «archived»·
 *   - κάθε μετάβαση γράφει ΜΙΑ γραμμή ιστορικού, και καμία όταν δεν άλλαξε τίποτα.
 *
 * @module lib/firestore/__tests__/soft-delete-archive
 */

jest.mock('server-only', () => ({}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() }),
}));

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => 'SERVER_TS', delete: () => 'FIELD_DELETE' },
  Timestamp: { now: () => 'NOW_TS' },
}));

/** Ο ΕΝΑΣ γραφέας της δημόσιας προβολής — εδώ κρίνεται μόνο ότι η μηχανή τον ΚΑΛΕΙ. */
jest.mock('@/services/listings/publish-public-listing', () => ({
  republishListing: jest.fn(async () => 'withdrawn'),
}));

/** Ο engine εισάγει τον φύλακα διαγραφής, που σέρνει `next/server`. */
jest.mock('../deletion-guard', () => ({
  executeDeletion: jest.fn(async () => ({ success: true, entityId: 'x' })),
}));

jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn(async () => 'audit_1') },
  resolveUserDisplayName: jest.fn(async () => 'Γιώργος'),
}));

import { ApiError } from '@/lib/api/api-error-types';
import { EntityAuditService, resolveUserDisplayName } from '@/services/entity-audit.service';
import { republishListing } from '@/services/listings/publish-public-listing';
import {
  archive,
  listArchived,
  restoreFromArchive,
  restoreFromTrash,
  softDelete,
} from '../soft-delete-engine';
import { ARCHIVED_STATUS, SOFT_DELETE_CONFIG, TRASHED_STATUS } from '../soft-delete-config';

const TENANT = 'comp_1';
const PROPERTY_ID = 'prop_1';
const USER = 'uid_1';

const recordChange = EntityAuditService.recordChange as jest.Mock;
const resolveName = resolveUserDisplayName as jest.Mock;
const republish = republishListing as jest.Mock;

/** Ελάχιστο Firestore για μία εγγραφή: φόρτωση + καταγραφή του τι γράφτηκε. */
function dbWith(data: Record<string, unknown> | null) {
  const update = jest.fn(async (_payload: Record<string, unknown>) => undefined);
  const db = {} as FirebaseFirestore.Firestore;
  const docRef = {
    get: async () => ({ exists: data !== null, data: () => data ?? undefined }),
    update,
    firestore: db,
  };
  Object.assign(db, { collection: () => ({ doc: () => docRef }) });
  return { db, update };
}

const liveProperty = { companyId: TENANT, name: 'Α2', status: 'available' };

async function refusalOf(run: () => Promise<unknown>): Promise<ApiError> {
  try {
    await run();
  } catch (err) {
    return err as ApiError;
  }
  throw new Error('περίμενα άρνηση, δεν ρίχτηκε τίποτα');
}

beforeEach(() => {
  recordChange.mockClear();
  resolveName.mockClear();
  republish.mockClear();
  republish.mockImplementation(async () => 'withdrawn');
});

describe('archive — ζωντανό → αρχείο', () => {
  it('γράφει την κατάσταση, την προηγούμενη ζωντανή και τις σφραγίδες του αρχείου', async () => {
    const { db, update } = dbWith(liveProperty);

    await expect(archive(db, 'property', PROPERTY_ID, USER, TENANT)).resolves.toEqual({
      success: true,
      entityId: PROPERTY_ID,
    });

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).toMatchObject({
      status: ARCHIVED_STATUS,
      previousStatus: 'available',
      archivedAt: 'SERVER_TS',
      archivedBy: USER,
      _lastModifiedBy: USER,
    });
  });

  it('🔴 γράφει ΜΙΑ γραμμή ιστορικού: status_changed, από τη ζωντανή κατάσταση στο αρχείο', async () => {
    const { db } = dbWith(liveProperty);

    await archive(db, 'property', PROPERTY_ID, USER, TENANT, 'g@example.com');

    expect(recordChange).toHaveBeenCalledTimes(1);
    expect(recordChange.mock.calls[0][0]).toMatchObject({
      entityType: 'property',
      entityId: PROPERTY_ID,
      entityName: 'Α2',
      action: 'status_changed',
      changes: [{ field: 'status', oldValue: 'available', newValue: ARCHIVED_STATUS, label: 'status' }],
      performedBy: USER,
      companyId: TENANT,
    });
  });

  it('είναι ιδεμποτική: ήδη στο αρχείο ⇒ καμία γραφή, καμία γραμμή', async () => {
    const { db, update } = dbWith({ ...liveProperty, status: ARCHIVED_STATUS, previousStatus: 'available' });

    await expect(archive(db, 'property', PROPERTY_ID, USER, TENANT)).resolves.toMatchObject({ success: true });

    expect(update).not.toHaveBeenCalled();
    expect(recordChange).not.toHaveBeenCalled();
  });
});

describe('archive — πότε ΑΡΝΕΙΤΑΙ', () => {
  it('🔴 οντότητα χωρίς αρχείο στο μητρώο ⇒ 400, καμία γραφή', async () => {
    expect(SOFT_DELETE_CONFIG.building.archive).toBeUndefined();
    const { db, update } = dbWith({ companyId: TENANT, name: 'Κτίριο', status: 'active' });

    const refused = await refusalOf(() => archive(db, 'building', 'bld_1', USER, TENANT));

    expect([refused.statusCode, refused.errorCode]).toEqual([400, 'ARCHIVE_UNSUPPORTED']);
    expect(update).not.toHaveBeenCalled();
  });

  it('🔴 ακίνητο με αγοραστή δεν αποσύρεται ούτε στο αρχείο', async () => {
    const { db, update } = dbWith({ ...liveProperty, commercial: { owners: [{ contactId: 'c1' }] } });

    const refused = await refusalOf(() => archive(db, 'property', PROPERTY_ID, USER, TENANT));

    expect([refused.statusCode, refused.errorCode]).toEqual([409, 'ARCHIVE_BLOCKED']);
    expect(update).not.toHaveBeenCalled();
  });

  it('ο άνθρωπος δεν αρχειοθετεί από τον κάδο', async () => {
    const { db, update } = dbWith({ ...liveProperty, status: TRASHED_STATUS, previousStatus: 'available' });

    const refused = await refusalOf(() => archive(db, 'property', PROPERTY_ID, USER, TENANT));

    expect([refused.statusCode, refused.errorCode]).toEqual([409, 'ARCHIVE_FROM_TRASH']);
    expect(update).not.toHaveBeenCalled();
  });

  it('ξένη εγγραφή ⇒ το ίδιο 404 με την ανύπαρκτη', async () => {
    const foreign = await refusalOf(() =>
      archive(dbWith({ ...liveProperty, companyId: 'other' }).db, 'property', PROPERTY_ID, USER, TENANT),
    );
    const missing = await refusalOf(() => archive(dbWith(null).db, 'property', PROPERTY_ID, USER, TENANT));

    expect([foreign.statusCode, foreign.message]).toEqual([missing.statusCode, missing.message]);
    expect(missing.statusCode).toBe(404);
  });
});

describe('κάδος ↔ αρχείο — το previousStatus μένει η τελευταία ΖΩΝΤΑΝΗ κατάσταση', () => {
  it('🔴 εκκαθάριση: κάδος → αρχείο κρατά την κατάσταση πριν από τον κάδο και σβήνει τις σφραγίδες του', async () => {
    const { db, update } = dbWith({
      ...liveProperty,
      status: TRASHED_STATUS,
      previousStatus: 'for-sale',
      deletedAt: 'x',
      deletedBy: USER,
    });

    await archive(db, 'property', PROPERTY_ID, 'system:cron-purge', TENANT, undefined, { fromTrash: true });

    expect(update.mock.calls[0][0]).toMatchObject({
      status: ARCHIVED_STATUS,
      previousStatus: 'for-sale',
      deletedAt: 'FIELD_DELETE',
      deletedBy: 'FIELD_DELETE',
      archivedBy: 'system:cron-purge',
    });
    expect(recordChange.mock.calls[0][0].changes[0]).toMatchObject({
      oldValue: TRASHED_STATUS,
      newValue: ARCHIVED_STATUS,
    });
  });

  it('🔴 αρχείο → κάδος κρατά την κατάσταση πριν από το αρχείο και σβήνει τις σφραγίδες του', async () => {
    const { db, update } = dbWith({
      ...liveProperty,
      status: ARCHIVED_STATUS,
      previousStatus: 'for-sale',
      archivedAt: 'x',
      archivedBy: USER,
    });

    await softDelete(db, 'property', PROPERTY_ID, USER, TENANT);

    expect(update.mock.calls[0][0]).toMatchObject({
      status: TRASHED_STATUS,
      previousStatus: 'for-sale',
      archivedAt: 'FIELD_DELETE',
      archivedBy: 'FIELD_DELETE',
      deletedBy: USER,
    });
  });

  it('ο κάδος μιας ζωντανής εγγραφής ΔΕΝ αγγίζει σφραγίδες αρχείου', async () => {
    const { db, update } = dbWith(liveProperty);

    await softDelete(db, 'property', PROPERTY_ID, USER, TENANT);

    expect(update.mock.calls[0][0]).not.toHaveProperty('archivedAt');
    expect(recordChange.mock.calls[0][0].action).toBe('soft_deleted');
  });
});

describe('εκτελεστής: άνθρωπος ή μηχανή', () => {
  it('🔴 η μηχανή γράφεται ως «System» και ΔΕΝ αναζητείται ως χρήστης', async () => {
    const { db, update } = dbWith({ ...liveProperty, status: TRASHED_STATUS, previousStatus: 'available' });

    await archive(db, 'property', PROPERTY_ID, 'system:cron-purge', TENANT, undefined, { fromTrash: true });

    expect(resolveName).not.toHaveBeenCalled();
    expect(update.mock.calls[0][0]._lastModifiedByName).toBe('System');
    expect(recordChange.mock.calls[0][0]).toMatchObject({
      performedBy: 'system:cron-purge',
      performedByName: 'System',
    });
  });
});

describe('restoreFromArchive — αρχείο → ζωντανό', () => {
  it('επιστρέφει στην προηγούμενη κατάσταση και καθαρίζει τις σφραγίδες', async () => {
    const { db, update } = dbWith({ ...liveProperty, status: ARCHIVED_STATUS, previousStatus: 'available' });

    await expect(restoreFromArchive(db, 'property', PROPERTY_ID, USER, TENANT)).resolves.toEqual({
      success: true,
      entityId: PROPERTY_ID,
      restoredStatus: 'available',
      // Δεν ήταν σε αγγελία ⇒ η επαναφορά δεν έκανε τίποτε άλλο.
      outcomes: [],
    });

    expect(update.mock.calls[0][0]).toMatchObject({
      status: 'available',
      previousStatus: 'FIELD_DELETE',
      archivedAt: 'FIELD_DELETE',
      archivedBy: 'FIELD_DELETE',
      restoredBy: USER,
    });
    expect(update.mock.calls[0][0]).not.toHaveProperty('commercialStatus');
    expect(recordChange.mock.calls[0][0]).toMatchObject({
      // 🔴 ΟΧΙ `restored`: ο αναγνώστης το διαβάζει «επαναφέρθηκε από τον ΚΑΔΟ».
      action: 'status_changed',
      changes: [{ field: 'status', oldValue: ARCHIVED_STATUS, newValue: 'available', label: 'status' }],
    });
  });

  it('χωρίς previousStatus πέφτει στην προεπιλογή του μητρώου', async () => {
    const { db } = dbWith({ ...liveProperty, status: ARCHIVED_STATUS });

    const result = await restoreFromArchive(db, 'property', PROPERTY_ID, USER, TENANT);

    expect(result.restoredStatus).toBe(SOFT_DELETE_CONFIG.property.defaultRestoreStatus);
  });

  it('🔴 εγγραφή του ΚΑΔΟΥ δεν επαναφέρεται από το αρχείο', async () => {
    const { db, update } = dbWith({ ...liveProperty, status: TRASHED_STATUS });

    const refused = await refusalOf(() => restoreFromArchive(db, 'property', PROPERTY_ID, USER, TENANT));

    expect([refused.statusCode, refused.message]).toEqual([409, 'Property is not in archive']);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('🔴 η δημόσια αγγελία ακολουθεί τον κύκλο ζωής — ΜΙΑ κλήση, κάθε πόρτα', () => {
  const listed = { ...liveProperty, status: 'for-sale', commercialStatus: 'for-sale' };

  /** Το ακίνητο όπως το παρέλαβε ο γραφέας της προβολής. */
  const republished = () => republish.mock.calls[0][2] as Record<string, unknown>;

  it('κάδος ⇒ ο γραφέας καλείται με το έγγραφο ΗΔΗ αποσυρμένο', async () => {
    const { db } = dbWith(listed);

    await softDelete(db, 'property', PROPERTY_ID, USER, TENANT);

    expect(republish).toHaveBeenCalledTimes(1);
    expect(republish.mock.calls[0].slice(0, 2)).toEqual([db, PROPERTY_ID]);
    expect(republished()).toMatchObject({ id: PROPERTY_ID, status: TRASHED_STATUS, commercialStatus: 'for-sale' });
  });

  it('αρχείο ⇒ το ίδιο', async () => {
    const { db } = dbWith(listed);

    await archive(db, 'property', PROPERTY_ID, USER, TENANT);

    expect(republished()).toMatchObject({ status: ARCHIVED_STATUS });
  });

  it('ιδεμποτική απόσυρση ⇒ καμία κλήση', async () => {
    const { db } = dbWith({ ...listed, status: ARCHIVED_STATUS, previousStatus: 'for-sale' });

    await archive(db, 'property', PROPERTY_ID, USER, TENANT);

    expect(republish).not.toHaveBeenCalled();
  });

  it('επαναφορά από τον ΚΑΔΟ ⇒ γυρίζει όπως ήταν, και ξαναδημοσιεύεται', async () => {
    const { db, update } = dbWith({ ...listed, status: TRASHED_STATUS, previousStatus: 'for-sale' });

    const result = await restoreFromTrash(db, 'property', PROPERTY_ID, USER, TENANT);

    expect(update.mock.calls[0][0]).not.toHaveProperty('commercialStatus');
    expect(republished()).toMatchObject({ status: 'for-sale', commercialStatus: 'for-sale' });
    expect(recordChange.mock.calls[0][0].changes).toHaveLength(1);
    expect(result.outcomes).toEqual([]);
  });

  it('🔴 η επαναφορά από το ΑΡΧΕΙΟ ΔΗΛΩΝΕΙ ότι γύρισε εκτός αγοράς — η οθόνη δεν το μαντεύει', async () => {
    const { db } = dbWith({ ...listed, status: ARCHIVED_STATUS, previousStatus: 'for-sale' });

    const result = await restoreFromArchive(db, 'property', PROPERTY_ID, USER, TENANT);

    expect(result.outcomes).toEqual(['taken-off-market']);
  });

  it('🔴 επαναφορά από το ΑΡΧΕΙΟ ⇒ γυρίζει ΕΚΤΟΣ ΑΓΟΡΑΣ, στην ίδια εγγραφή και στην ίδια γραμμή', async () => {
    const { db, update } = dbWith({ ...listed, status: ARCHIVED_STATUS, previousStatus: 'for-sale' });

    const result = await restoreFromArchive(db, 'property', PROPERTY_ID, USER, TENANT);

    // 🔴 `status` ≡ `commercialStatus` (commercial-statuses.ts): το `previousStatus` ΔΕΝ
    //    ξαναφέρνει το `for-sale` δίπλα σε `commercialStatus: 'unavailable'`.
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).toMatchObject({ status: 'unavailable', commercialStatus: 'unavailable' });
    expect(republished()).toMatchObject({ status: 'unavailable', commercialStatus: 'unavailable' });
    expect(result.restoredStatus).toBe('unavailable');
    expect(recordChange).toHaveBeenCalledTimes(1);
    expect(recordChange.mock.calls[0][0].changes).toEqual([
      { field: 'status', oldValue: ARCHIVED_STATUS, newValue: 'unavailable', label: 'status' },
      { field: 'commercialStatus', oldValue: 'for-sale', newValue: 'unavailable', label: 'commercialStatus' },
    ]);
  });

  it('🔴 παλιό έγγραφο, όπου το `status` ΕΙΝΑΙ η εμπορική κατάσταση ⇒ πάλι εκτός αγοράς, και τα δύο πεδία', async () => {
    const { db, update } = dbWith({ ...liveProperty, status: ARCHIVED_STATUS, previousStatus: 'for-sale' });

    await restoreFromArchive(db, 'property', PROPERTY_ID, USER, TENANT);

    expect(update.mock.calls[0][0]).toMatchObject({ status: 'unavailable', commercialStatus: 'unavailable' });
  });

  it('🔴 ήδη εκτός αγοράς με `previousStatus` που ΑΠΟΚΛΙΝΕΙ ⇒ το `status` ακολουθεί το `commercialStatus`, χωρίς ψεύτικη εμπορική γραμμή', async () => {
    const { db, update } = dbWith({
      ...liveProperty,
      status: ARCHIVED_STATUS,
      previousStatus: 'for-sale',
      commercialStatus: 'unavailable',
    });

    const result = await restoreFromArchive(db, 'property', PROPERTY_ID, USER, TENANT);

    expect(update.mock.calls[0][0]).toMatchObject({ status: 'unavailable' });
    expect(update.mock.calls[0][0]).not.toHaveProperty('commercialStatus');
    expect(recordChange.mock.calls[0][0].changes).toEqual([
      { field: 'status', oldValue: ARCHIVED_STATUS, newValue: 'unavailable', label: 'status' },
    ]);
    // Τίποτα δεν κατέβηκε από την αγορά ⇒ η οθόνη δεν το ανακοινώνει.
    expect(result.outcomes).toEqual([]);
  });

  it('συναλλαγή που επιβιώνει της απόσυρσης (κράτηση) ⇒ το `status` την ακολουθεί, όχι «μη διαθέσιμο»', async () => {
    const offers = [
      { id: 'offr_sell', kind: 'sell', lifecycle: 'reserved', askingPrice: 200000 },
      { id: 'offr_lease', kind: 'leaseOut', lifecycle: 'active', rentPrice: 900 },
    ];
    const { db, update } = dbWith({
      ...liveProperty,
      status: ARCHIVED_STATUS,
      previousStatus: 'for-sale-and-rent',
      commercialStatus: 'for-sale-and-rent',
      offers,
    });

    await restoreFromArchive(db, 'property', PROPERTY_ID, USER, TENANT);

    expect(update.mock.calls[0][0]).toMatchObject({ status: 'reserved', commercialStatus: 'reserved' });
  });

  it('επαναφορά από τον ΚΑΔΟ με το ίδιο αποκλίνον έγγραφο ⇒ ΔΕΝ αγγίζεται: γυρίζει στο `previousStatus`', async () => {
    const { db, update } = dbWith({
      ...liveProperty,
      status: TRASHED_STATUS,
      previousStatus: 'for-sale',
      commercialStatus: 'unavailable',
    });

    await restoreFromTrash(db, 'property', PROPERTY_ID, USER, TENANT);

    expect(update.mock.calls[0][0]).toMatchObject({ status: 'for-sale' });
  });

  it('🔴 αποτυχία της προβολής ΔΕΝ ρίχνει την πράξη', async () => {
    republish.mockImplementation(async () => {
      throw new Error('boom');
    });
    const { db, update } = dbWith(listed);

    await expect(archive(db, 'property', PROPERTY_ID, USER, TENANT)).resolves.toMatchObject({ success: true });
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('οντότητα χωρίς δηλωμένη παρενέργεια ⇒ καμία κλήση', async () => {
    const { db } = dbWith({ companyId: TENANT, name: 'Κτίριο', status: 'active' });

    await softDelete(db, 'building', 'bld_1', USER, TENANT);

    expect(republish).not.toHaveBeenCalled();
  });
});

describe('listArchived — ίδιες γραμμές, άλλη κατάσταση', () => {
  function listDb() {
    const filters: Array<{ field: string; op: string; value: unknown }> = [];
    const query = {
      where(field: string, op: string, value: unknown) {
        filters.push({ field, op, value });
        return query;
      },
      get: async () => ({ docs: [{ id: 'p2', data: () => ({ name: 'Β' }) }, { id: 'p1', data: () => ({ name: 'Α' }) }] }),
    };
    const db = { collection: () => query } as unknown as FirebaseFirestore.Firestore;
    return { db, filters };
  }

  it('ρωτά την εταιρεία και ΜΟΝΟ το αρχείο, ταξινομημένα όπως ο κάδος', async () => {
    const { db, filters } = listDb();

    const rows = await listArchived(db, 'property', TENANT);

    expect(filters).toEqual([
      { field: 'companyId', op: '==', value: TENANT },
      { field: 'status', op: '==', value: ARCHIVED_STATUS },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['p1', 'p2']);
  });

  it('αρνείται οντότητα χωρίς αρχείο', async () => {
    await expect(listArchived(listDb().db, 'building', TENANT)).rejects.toThrow(/archive list/);
  });
});
