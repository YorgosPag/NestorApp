/**
 * ADR-340 D4 · ADR-899 §2.2 — όταν το τελευταίο υπόβαθρο ενός αρχείου σβηστεί, το `files/{fileId}` **παραδίδεται στην
 * ΜΙΑ αγωγό εκκαθάρισης** (κάδος με `purgeAt = τώρα`) — το trigger **δεν** σβήνει bytes ούτε την εγγραφή.
 *
 * 🔴 Ως τις 2026-10-31 το trigger έσβηνε μόνο το `storagePath` και μετά το `files/{id}`: τα συνοδευτικά (μικρογραφίες,
 * σκηνές) έχαναν τον τελευταίο δείκτη τους και έμεναν για πάντα, και καμία δέσμευση δεν ρωτιόταν. Τώρα τα κάνει ο
 * γραφέας της εφαρμογής (`purgeFileRecord`), που το cron καλεί για κάθε `isDeleted == true && purgeAt <= now`.
 *
 * | άγκυρα | μετάλλαξη που πιάνει |
 * |---|---|
 * | Π1 ref-count 0 ⇒ πεδία κάδου που ταιριάζουν στο ερώτημα του cron | `purgeAt` στο μέλλον / χωρίς `isDeleted` |
 * | Π2 καμία επαφή με Storage, καμία διαγραφή εγγραφής | επιστροφή στη διαγραφή bytes/εγγραφής |
 * | Π3 ήδη στην ουρά (`isDeleted`) ⇒ τίποτα — η διατήρηση του ανθρώπου δεν συντομεύεται | update χωρίς φρουρό |
 * | Π4 υπάρχουν αναφορές / λείπει η εγγραφή ⇒ τίποτα | χωρίς ref-count |
 * | Κ1 κανένας κώδικας Functions (εκτός sweeper ορφανών) δεν σβήνει bytes | νέα πόρτα διαγραφής δίπλα στον γραφέα |
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { COLLECTIONS } from '../../config/firestore-collections';

const SERVER_TS = { __fieldValue: 'serverTimestamp' };

/** Φρέσκο module ανά test. Κανένα `admin.storage` στο mock: αν το trigger το άγγιζε, θα έσκαγε. */
function loadWithMocks(opts: {
  remaining: number;
  fileExists: boolean;
  fileData?: Record<string, unknown>;
  updateSpy: jest.Mock;
  docDeleteSpy: jest.Mock;
}): (snap: { data: () => unknown }, context: { params: { rbgId: string } }) => Promise<null> {
  jest.resetModules();

  jest.doMock('firebase-functions/v1', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    runWith: () => ({
      firestore: { document: () => ({ onDelete: (fn: unknown) => fn }) },
    }),
  }));

  const firestore = Object.assign(
    () => ({
      collection: (name: string) => {
        if (name === COLLECTIONS.FLOORPLAN_BACKGROUNDS) {
          return {
            where: () => ({
              count: () => ({ get: async () => ({ data: () => ({ count: opts.remaining }) }) }),
            }),
          };
        }
        return {
          doc: () => ({
            get: async () => ({
              exists: opts.fileExists,
              data: () => opts.fileData,
              get: (field: string) => opts.fileData?.[field],
            }),
            update: opts.updateSpy,
            delete: opts.docDeleteSpy,
          }),
        };
      },
    }),
    { FieldValue: { serverTimestamp: () => SERVER_TS } },
  );
  jest.doMock('firebase-admin', () => ({ firestore }));

  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  return require('../onDeleteFloorplanBackground').onDeleteFloorplanBackground;
}

const snapWithFileId = (fileId: string) => ({ data: () => ({ fileId }) });
const CONTEXT = { params: { rbgId: 'rbg_1' } };
const ACTIVE_FILE = { storagePath: `${COLLECTIONS.FILES}/file_1.dxf`, lifecycleState: 'active', isDeleted: false };

describe('onDeleteFloorplanBackground — παράδοση στην ΜΙΑ αγωγό εκκαθάρισης (ADR-899 §2.2)', () => {
  it('🔴 Π1 — ref-count 0 ⇒ πεδία κάδου που το cron διαλέγει ΑΜΕΣΑ (`isDeleted` + `purgeAt <= now`)', async () => {
    const updateSpy = jest.fn().mockResolvedValue(undefined);
    const handler = loadWithMocks({ remaining: 0, fileExists: true, fileData: ACTIVE_FILE, updateSpy, docDeleteSpy: jest.fn() });

    const before = new Date().toISOString();
    await handler(snapWithFileId('file_1'), CONTEXT);

    expect(updateSpy).toHaveBeenCalledTimes(1);
    const fields = updateSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(fields).toEqual({
      lifecycleState: 'trashed',
      trashedAt: SERVER_TS,
      trashedBy: 'system:floorplan-background',
      purgeAt: expect.any(String),
      isDeleted: true,
      deletedAt: SERVER_TS,
      deletedBy: 'system:floorplan-background',
      updatedAt: SERVER_TS,
    });
    // Το ερώτημα του cron: `purgeAt <= nowISO()` ως συμβολοσειρά.
    expect(fields.purgeAt >= before && (fields.purgeAt as string) <= new Date().toISOString()).toBe(true);
  });

  it('🔴 Π2 — καμία διαγραφή εγγραφής (το επιτύμβιο + το ίχνος τα γράφει ο γραφέας)', async () => {
    const docDeleteSpy = jest.fn();
    const handler = loadWithMocks({
      remaining: 0, fileExists: true, fileData: ACTIVE_FILE, updateSpy: jest.fn().mockResolvedValue(undefined), docDeleteSpy,
    });

    await handler(snapWithFileId('file_1'), CONTEXT);

    expect(docDeleteSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['στον κάδο από άνθρωπο, με δική του διατήρηση', { ...ACTIVE_FILE, lifecycleState: 'trashed', isDeleted: true, purgeAt: '2099-01-01T00:00:00.000Z' }],
    ['ήδη επιτύμβιο', { ...ACTIVE_FILE, lifecycleState: 'purged', isDeleted: true }],
  ])('🔑 Π3 — %s ⇒ τίποτα (ιδεμπότητο)', async (_label, fileData) => {
    const updateSpy = jest.fn();
    const handler = loadWithMocks({ remaining: 0, fileExists: true, fileData, updateSpy, docDeleteSpy: jest.fn() });

    await handler(snapWithFileId('file_1'), CONTEXT);

    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('Π4 — ακόμη υπάρχουν αναφορές (remaining > 0) ⇒ καμία επαφή με το files/{id}', async () => {
    const updateSpy = jest.fn();
    const docDeleteSpy = jest.fn();
    const handler = loadWithMocks({ remaining: 1, fileExists: true, fileData: ACTIVE_FILE, updateSpy, docDeleteSpy });

    await handler(snapWithFileId('file_1'), CONTEXT);

    expect(updateSpy).not.toHaveBeenCalled();
    expect(docDeleteSpy).not.toHaveBeenCalled();
  });

  it('Π4β — η εγγραφή λείπει ⇒ τίποτα', async () => {
    const updateSpy = jest.fn();
    const handler = loadWithMocks({ remaining: 0, fileExists: false, updateSpy, docDeleteSpy: jest.fn() });

    await handler(snapWithFileId('file_1'), CONTEXT);

    expect(updateSpy).not.toHaveBeenCalled();
  });
});

describe('Κ — τα Cloud Functions δεν σβήνουν bytes αρχείου (μία αγωγός: `purgeFileRecord` της εφαρμογής)', () => {
  const SRC = join(__dirname, '..', '..');
  /** Ο ΜΟΝΟΣ επιτρεπτός: ο sweeper ορφανών (ADR-694 Α3) — σβήνει μόνο αντικείμενα με ΑΠΟΔΕΔΕΙΓΜΕΝΑ ανύπαρκτο ιδιοκτήτη. */
  const ALLOWED = new Set(['storage/orphan-sweeper.ts']);

  function productionSources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return name === '__tests__' || name === 'generated' ? [] : productionSources(path);
      return name.endsWith('.ts') ? [path] : [];
    });
  }

  /**
   * Αρχείο που πιάνει αντικείμενα Storage (`.file(`) **και** καλεί `.delete(` / `.deleteFiles(`. Όχι μόνο η αλυσίδα
   * `.file(p).delete(`: η παλιά αγωγός έγραφε `const file = bucket.file(p); … await file.delete()` (μετάλλαξη 2026-10-31 —
   * ο στενός ανιχνευτής την άφηνε να περάσει).
   */
  const deletesStorageObjects = (source: string): boolean => /\.file\(/.test(source) && /\.delete\(|\.deleteFiles\(/.test(source);

  it('🔴 Κ1 — κανένα αρχείο Functions δεν σβήνει αντικείμενα Storage, έξω από τον sweeper ορφανών', () => {
    const offenders = productionSources(SRC)
      .map((path) => relative(SRC, path).replace(/\\/g, '/'))
      .filter((rel) => !ALLOWED.has(rel))
      .filter((rel) => deletesStorageObjects(readFileSync(join(SRC, rel), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('🔑 Κ1β — παρονομαστής: ο ανιχνευτής ΒΡΙΣΚΕΙ τον sweeper και τη μορφή «μεταβλητή» (αλλιώς το «0» δεν σημαίνει τίποτα)', () => {
    expect(deletesStorageObjects(readFileSync(join(SRC, 'storage/orphan-sweeper.ts'), 'utf8'))).toBe(true);
    expect(deletesStorageObjects('const file = bucket.file(storagePath);\nawait file.delete();')).toBe(true);
  });

  it('🔴 Κ2 — η δεύτερη αγωγός εκκαθάρισης (`scheduledFilePurge`) δεν εξάγεται', () => {
    const index = readFileSync(join(SRC, 'index.ts'), 'utf8');
    expect(index).not.toMatch(/export const scheduledFilePurge|\.where\('purgeAt'/);
  });
});
