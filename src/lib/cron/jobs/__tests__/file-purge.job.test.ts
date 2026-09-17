/**
 * @jest-environment node
 *
 * =============================================================================
 * 🔑 ΑΓΚΥΡΑ: Η ΕΚΚΑΘΑΡΙΣΗ ΣΑΡΩΝΕΙ **ΚΑΙ ΤΑ ΔΥΟ** ΔΙΑΜΕΡΙΣΜΑΤΑ (ADR-866 §2.6.9 · §5.2 σημείο 8)
 * =============================================================================
 *
 * **Το ερώτημα**: *«λήγει προσωπικό αρχείο στον κάδο — και γράφεται η λήξη στη ΣΩΣΤΗ συλλογή;»*
 *
 * 🔴 **Η ΜΕΤΑΛΛΑΞΗ που πρέπει να πιάσει**: `CUSTODY_KINDS.map(...)` → `['company'].map(...)` στο job ⇒
 * το προσωπικό αρχείο δεν ερωτάται ποτέ ⇒ **Δ1 · Δ2 κόκκινα**. Και ανταλλαγή του διαμερίσματος που
 * περνά στο `purgeFileRecord` ⇒ **Δ3 κόκκινο**.
 *
 * ⚠️ Ο δίσκος είναι **ελάχιστο στιγμιότυπο** που καταγράφει ΠΟΙΑ συλλογή ρωτήθηκε με ΠΟΙΟ φίλτρο —
 * το `FakeFirestore` δεν υποστηρίζει `<` (Φάση Β). Ο γραφέας (`purgeFileRecord`) είναι mock: εδώ
 * κρίνεται η **σάρωση**, όχι η εγγραφή (εκείνη έχει δική της άγκυρα).
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

import { COLLECTIONS } from '@/config/firestore-collections';

interface StubDoc {
  readonly id: string;
  readonly data: Record<string, unknown>;
}

/** Ποια συλλογή ρωτήθηκε, με ποιο πρώτο πεδίο φίλτρου. */
let queried: string[] = [];
/** Τα έγγραφα του κάδου ανά συλλογή — επιστρέφονται **μόνο** στη Φάση Α (`isDeleted`). */
let trash: Record<string, StubDoc[]> = {};

function stubDb() {
  return {
    collection(name: string) {
      let firstField: string | null = null;
      const query = {
        where(field: string) {
          firstField ??= field;
          return query;
        },
        limit() {
          return query;
        },
        async get() {
          queried.push(`${name}:${firstField ?? '-'}`);
          const docs = firstField === 'isDeleted' ? (trash[name] ?? []) : [];
          return { size: docs.length, docs: docs.map((d) => ({ id: d.id, data: () => d.data })) };
        },
      };
      return query;
    },
  };
}

const purgeFileRecord = jest.fn(async (_params: { fileId: string; custody: string }) => ({
  success: true,
  storageDeleted: true,
}));

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => stubDb() }));
jest.mock('@/services/file-record/file-purge-helpers', () => ({
  purgeFileRecord: (params: { fileId: string; custody: string }) => purgeFileRecord(params),
  isFileHeld: () => false,
  PENDING_FILE_TTL_MS: 1000,
}));

import { purgeExpiredTrash, purgeFiles } from '../file-purge.job';

beforeEach(() => {
  queried = [];
  trash = {};
  purgeFileRecord.mockClear();
});

describe('Δ — η εκκαθάριση ανά διαμέρισμα', () => {
  it('🔴 Δ1 — Φάση Α ρωτά ΚΑΙ το `files` ΚΑΙ το `files_personal`', async () => {
    await purgeExpiredTrash(stubDb() as never, '2026-09-17T00:00:00.000Z');

    expect(queried.sort()).toEqual([
      `${COLLECTIONS.FILES}:isDeleted`,
      `${COLLECTIONS.FILES_PERSONAL}:isDeleted`,
    ]);
  });

  it('🔴 Δ2 — ολόκληρο το job: και οι δύο φάσεις σε ΚΑΙ τα δύο διαμερίσματα', async () => {
    await purgeFiles();

    expect(queried.sort()).toEqual([
      `${COLLECTIONS.FILES}:isDeleted`,
      `${COLLECTIONS.FILES}:status`,
      `${COLLECTIONS.FILES_PERSONAL}:isDeleted`,
      `${COLLECTIONS.FILES_PERSONAL}:status`,
    ]);
  });

  it('🔑 Δ3 — το διαμέρισμα ταξιδεύει ΑΠΟ ΤΟ ΕΡΩΤΗΜΑ στον γραφέα', async () => {
    trash[COLLECTIONS.FILES] = [{ id: 'file_company', data: { purgeAt: 'x' } }];
    trash[COLLECTIONS.FILES_PERSONAL] = [{ id: 'file_personal', data: { purgeAt: 'x' } }];

    const tally = await purgeExpiredTrash(stubDb() as never, '2026-09-17T00:00:00.000Z');

    const calls = purgeFileRecord.mock.calls.map(([p]) => [p.fileId, p.custody]).sort();
    expect(calls).toEqual([
      ['file_company', 'company'],
      ['file_personal', 'personal'],
    ]);
    expect(tally).toEqual({ purged: 2, skipped: 0, checked: 2 });
  });
});
