/**
 * ⚓ Εκκαθάριση κάδου — «τίποτα δεν σαπίζει στον κάδο» (ADR-281 · ADR-329 §3.9)
 *
 * Εγγραφή του κάδου που απέκτησε αναφορές δεν σβήνεται ποτέ: ο φύλακας την αρνείται κάθε
 * μέρα. Μέχρι τις 2026-10-06 μετριόταν ως `skipped` για πάντα. Αυτό το αρχείο καρφώνει ότι
 * περνά στο αρχείο — και ΜΟΝΟ όταν πρόκειται για αποκλεισμό, ΜΟΝΟ όπου υπάρχει αρχείο.
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/lib/cron-auth', () => ({ TRASH_RETENTION_MS: 1000 }));

const mockExecuteDeletion = jest.fn();
const mockArchive = jest.fn();
const mockDb = { collection: jest.fn() };

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => mockDb }));
jest.mock('@/lib/firestore/deletion-guard', () => ({
  executeDeletion: (...args: unknown[]) => mockExecuteDeletion(...args),
}));
jest.mock('@/lib/firestore/soft-delete-engine', () => ({
  archive: (...args: unknown[]) => mockArchive(...args),
}));

import { ApiError } from '@/lib/api/api-error-types';
import { SOFT_DELETE_CONFIG } from '@/lib/firestore/soft-delete-config';
import { purgeDeletedEntities } from '../purge-deleted-entities.job';

/** Ο κάδος έχει ΜΙΑ ληγμένη εγγραφή στη δοσμένη συλλογή, και καμία αλλού. */
function expiredRowIn(collection: string): void {
  mockDb.collection.mockImplementation((name: string) => {
    const query = {
      where: () => query,
      limit: () => query,
      get: async () => {
        const docs = name === collection ? [{ id: 'row_1', data: () => ({ companyId: 'comp_1' }) }] : [];
        return { docs, size: docs.length };
      },
    };
    return query;
  });
}

const blocked = () => new ApiError(409, 'έχει αναφορές', 'DELETION_BLOCKED');

beforeEach(() => {
  mockExecuteDeletion.mockReset();
  mockArchive.mockReset();
});

describe('purgeDeletedEntities — μπλοκαρισμένη εγγραφή', () => {
  it('🔴 ακίνητο που ο φύλακας αρνείται ⇒ στο αρχείο, από τον κάδο, με εκτελεστή τη μηχανή', async () => {
    expiredRowIn(SOFT_DELETE_CONFIG.property.collection);
    mockExecuteDeletion.mockRejectedValue(blocked());
    mockArchive.mockResolvedValue({ success: true, entityId: 'row_1' });

    const report = await purgeDeletedEntities();

    expect(mockArchive).toHaveBeenCalledWith(
      mockDb, 'property', 'row_1', 'system:cron-purge', 'comp_1', undefined, { fromTrash: true },
    );
    expect(report.results.property).toMatchObject({ purged: 0, skipped: 0, archived: 1, checked: 1 });
    expect(report.totalArchived).toBe(1);
  });

  it('🔴 οντότητα ΧΩΡΙΣ αρχείο ⇒ παραλείπεται όπως πάντα, καμία αρχειοθέτηση', async () => {
    expect(SOFT_DELETE_CONFIG.building.archive).toBeUndefined();
    expiredRowIn(SOFT_DELETE_CONFIG.building.collection);
    mockExecuteDeletion.mockRejectedValue(blocked());

    const report = await purgeDeletedEntities();

    expect(mockArchive).not.toHaveBeenCalled();
    expect(report.results.building).toMatchObject({ skipped: 1, archived: 0 });
  });

  it('🔴 αποτυχία που ΔΕΝ είναι αποκλεισμός ⇒ παραλείπεται, δεν αρχειοθετείται', async () => {
    expiredRowIn(SOFT_DELETE_CONFIG.property.collection);
    mockExecuteDeletion.mockRejectedValue(new Error('UNAVAILABLE'));

    const report = await purgeDeletedEntities();

    expect(mockArchive).not.toHaveBeenCalled();
    expect(report.results.property).toMatchObject({ skipped: 1, archived: 0 });
  });

  it('αν και η αρχειοθέτηση αρνηθεί (π.χ. αγοραστής) ⇒ παραλείπεται, η σάρωση συνεχίζει', async () => {
    expiredRowIn(SOFT_DELETE_CONFIG.property.collection);
    mockExecuteDeletion.mockRejectedValue(blocked());
    mockArchive.mockRejectedValue(new ApiError(409, 'έχει αγοραστή', 'ARCHIVE_BLOCKED'));

    const report = await purgeDeletedEntities();

    expect(report.results.property).toMatchObject({ skipped: 1, archived: 0 });
    expect(report.totalSkipped).toBe(1);
  });

  it('ό,τι σβήνεται κανονικά δεν αγγίζει το αρχείο', async () => {
    expiredRowIn(SOFT_DELETE_CONFIG.property.collection);
    mockExecuteDeletion.mockResolvedValue({ success: true, entityId: 'row_1' });

    const report = await purgeDeletedEntities();

    expect(mockArchive).not.toHaveBeenCalled();
    expect(report.results.property).toMatchObject({ purged: 1, archived: 0 });
  });
});
