/**
 * ⚓ Φύλακας διαγραφής ↔ αρχείο (ADR-226 · ADR-329 §3.9)
 *
 * «Πότε προσφέρεται η αρχειοθέτηση;» το απαντά ο ΔΙΑΚΟΜΙΣΤΗΣ, σε ένα σημείο. Λάθος απάντηση
 * εδώ = κουμπί «Αρχειοθέτηση» σε μπλοκάρισμα που δεν λύνεται έτσι (αγοραστής), ή σε έλεγχο που
 * απλώς απέτυχε.
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn(async () => undefined) },
}));
jest.mock('@/services/file-record/file-purge-helpers', () => ({ isFileHeld: () => false }));
jest.mock('../deletion-storage-cleanup', () => ({ executeStorageCleanup: jest.fn() }));
jest.mock('@/lib/api/ApiErrorHandler', () => jest.requireActual('@/lib/api/api-error-types'));

import { ApiError } from '@/lib/api/api-error-types';
import type { DependencyCheckResult } from '@/config/deletion-registry';
import { assertDeletionAllowed, isArchiveOffered } from '../deletion-guard';
import { conditionalBlockMessage } from '../deletion-common';

const dependency = (count: number) => ({
  label: 'Επιμετρήσεις (BOQ)',
  collection: 'boq_items',
  count,
  documentIds: [],
});

const blockedBy = (count: number): DependencyCheckResult => ({
  allowed: false,
  dependencies: [dependency(count)],
  totalDependents: Math.max(0, count),
  message: 'blocked',
});

describe('isArchiveOffered', () => {
  it('ναι: ακίνητο που το κρατούν μετρημένες αναφορές', () => {
    expect(isArchiveOffered('property', blockedBy(2))).toBe(true);
  });

  it('🔴 όχι: ο έλεγχος ΑΠΕΤΥΧΕ (count −1) — «δεν ξέρω» δεν είναι λόγος απόσυρσης', () => {
    expect(isArchiveOffered('property', blockedBy(-1))).toBe(false);
  });

  it('🔴 όχι: αποκλεισμός υπό όρο (αγοραστής) — καμία αναφορά, καμία έξοδος προς το αρχείο', () => {
    const conditional: DependencyCheckResult = {
      allowed: false,
      dependencies: [],
      totalDependents: 0,
      message: 'έχει αγοραστή',
    };

    expect(isArchiveOffered('property', conditional)).toBe(false);
  });

  it('όχι: οντότητα χωρίς αρχείο στο μητρώο, ή χωρίς κύκλο ζωής', () => {
    expect(isArchiveOffered('building', blockedBy(2))).toBe(false);
    expect(isArchiveOffered('floor', blockedBy(2))).toBe(false);
  });

  it('όχι: όταν η διαγραφή επιτρέπεται δεν υπάρχει τίποτα να αποφύγεις', () => {
    const allowed: DependencyCheckResult = { allowed: true, dependencies: [], totalDependents: 0, message: '' };

    expect(isArchiveOffered('property', allowed)).toBe(false);
  });
});

describe('conditionalBlockMessage', () => {
  it('ακίνητο με αγοραστή ⇒ το μήνυμα του μητρώου', () => {
    expect(conditionalBlockMessage('property', { commercial: { owners: [{}] } })).toMatch(/αγοραστή/);
  });

  it('ακίνητο χωρίς αγοραστή, ή χωρίς έγγραφο ⇒ null', () => {
    expect(conditionalBlockMessage('property', { commercial: {} })).toBeNull();
    expect(conditionalBlockMessage('property', undefined)).toBeNull();
  });

  it('οντότητα χωρίς υπό όρο αποκλεισμό ⇒ null', () => {
    expect(conditionalBlockMessage('building', { anything: true })).toBeNull();
  });
});

describe('assertDeletionAllowed', () => {
  /** Firestore όπου ΜΟΝΟ οι επιμετρήσεις με `linkedUnitId` επιστρέφουν αναφορά. */
  function dbWithBoqReference(): FirebaseFirestore.Firestore {
    const queryFor = (collection: string) => {
      const filters: Array<[string, string]> = [];
      const query = {
        where(field: string, op: string) {
          filters.push([field, op]);
          return query;
        },
        limit: () => query,
        get: async () => {
          const hit = collection === 'boq_items' && filters.some(([f, op]) => f === 'linkedUnitId' && op === '==');
          return { size: hit ? 1 : 0, docs: hit ? [{ id: 'boq_1' }] : [] };
        },
      };
      return query;
    };

    return {
      collection: (name: string) => ({
        ...queryFor(name),
        doc: () => ({ get: async () => ({ exists: true, data: () => ({ companyId: 'comp_1' }) }) }),
      }),
      collectionGroup: (name: string) => queryFor(name),
    } as unknown as FirebaseFirestore.Firestore;
  }

  it('🔴 ακίνητο με επιμέτρηση ⇒ 409 DELETION_BLOCKED, και το σώμα λέει ότι αρχειοθετείται', async () => {
    let thrown: ApiError | undefined;
    try {
      await assertDeletionAllowed(dbWithBoqReference(), 'property', 'prop_1', 'comp_1');
    } catch (err) {
      thrown = err as ApiError;
    }

    expect([thrown?.statusCode, thrown?.errorCode]).toEqual([409, 'DELETION_BLOCKED']);
    expect(thrown?.details).toEqual({ archivable: true });
  });
});
