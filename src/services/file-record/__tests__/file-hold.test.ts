/**
 * @jest-environment node
 *
 * @fileoverview 🏆 **ΑΓΚΥΡΕΣ Α36 (ADR-864 §19) · Α47-Α48 (ADR-864 §21)** — ένας κριτής δέσμευσης αρχείου, και κάθε
 * διαδρομή οριστικής διαγραφής τον ρωτά.
 *
 * 🔴 Περιστατικό Α36 (μετρημένο 2026-09-17): το `gdpr-delete` έγραφε `data.hold.type !== 'none'` ενώ το `hold` είναι
 * **string** ⇒ κάθε αρχείο με ρητό `hold: 'none'` κρινόταν «σε δέσμευση» και **δεν σβηνόταν ποτέ**.
 *
 * | Άγκυρα | Μετάλλαξη που πιάνει |
 * |---|---|
 * | Α36 `none`/απουσία ⇒ όχι · `legal` ⇒ ναι · μελλοντική διατήρηση ⇒ ναι | επαναφορά `.hold.type` |
 * | Α47 άκυρη διατήρηση ⇒ **δεσμεύεται** (fail-closed) | `new Date(x) > now` |
 * | Α47 κανένα αρχείο δεν ξαναγράφει τον έλεγχο τοπικά | inline `data.hold` / `raw.hold` |
 * | Α48 άρνηση bytes από την πλατφόρμα ⇒ η εγγραφή **δεν** γίνεται `purged` | «non-blocking» αποτυχία bytes |
 * | Α48 σιωπηλή δέσμευση: ο κάδος **δεν** ρωτά τη δέσμευση · η διαγραφή οντότητας **φυλά** τα δεσμευμένα | `throw` στον κάδο · cascade χωρίς φύλαξη |
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const update = jest.fn(async () => undefined);
const set = jest.fn(async () => undefined);
let deletion: () => Promise<void> = async () => undefined;

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminStorage: () => ({ bucket: () => ({ file: () => ({ delete: () => deletion() }) }) }),
  getAdminFirestore: () => ({ collection: () => ({ doc: () => ({ update, set }) }) }),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { isFileHeld, purgeFileRecord } = require('../file-purge-helpers') as typeof import('../file-purge-helpers');
const judge = require('@/lib/files/file-hold') as typeof import('@/lib/files/file-hold');
/* eslint-enable @typescript-eslint/no-require-imports */

const source = (file: string): string => readFileSync(join(process.cwd(), file), 'utf8');

describe('🏆 Α36 — ο κριτής δέσμευσης', () => {
  it('🔴 `hold: none` ή χωρίς hold ⇒ ΔΕΝ δεσμεύεται (το περιστατικό του gdpr-delete)', () => {
    expect(isFileHeld({ hold: 'none' })).toBe(false);
    expect(isFileHeld({})).toBe(false);
  });

  it('🔑 παρονομαστής: νομική δέσμευση ή μελλοντική διατήρηση ⇒ δεσμεύεται', () => {
    expect(isFileHeld({ hold: 'legal' })).toBe(true);
    expect(isFileHeld({ retentionUntil: '2999-01-01T00:00:00.000Z' })).toBe(true);
    expect(isFileHeld({ retentionUntil: '2000-01-01T00:00:00.000Z' })).toBe(false);
  });

  it.each([
    'src/app/api/files/gdpr-delete/route.ts',
    'src/app/api/files/purge/route.ts',
  ])('🔴 %s ρωτά τον ΕΝΑ κριτή — κανένας τοπικός έλεγχος `data.hold`', (file) => {
    expect(source(file)).toContain('isFileHeld(data)');
    expect(source(file)).not.toMatch(/data\.hold\b/);
  });
});

describe('🏆 Α47 — ο καθαρός κριτής (ADR-864 §21)', () => {
  const NOW = Date.parse('2026-09-17T12:00:00.000Z');

  it('🔴 διατήρηση που ΔΕΝ διαβάζεται ⇒ δεσμεύεται (fail-closed)', () => {
    expect(judge.isHoldActive({ retentionUntil: 'not-a-date' }, NOW)).toBe(true);
  });

  it('🔑 το είδος και η αιτιολογία από το σύρμα', () => {
    expect(judge.isPlaceableHoldType('legal')).toBe(true);
    expect(judge.isPlaceableHoldType('none')).toBe(false);
    expect(judge.holdReasonOf('  αγωγή  ')).toBe('αγωγή');
    expect(judge.holdReasonOf('   ')).toBeNull();
    expect(judge.holdReasonOf('x'.repeat(judge.HOLD_REASON_MAX_LENGTH + 1))).toBeNull();
  });

  it.each([
    'src/services/file-record-lifecycle.ts',
    'src/app/api/contacts/[contactId]/route.ts',
    'src/lib/firestore/deletion-guard.ts',
  ])('🔴 %s — κανένας τοπικός έλεγχος `.hold`', (file) => {
    expect(source(file)).not.toMatch(/(?:data|raw)\.hold\b/);
  });

  it('🔴 ο client γραφέας hold ΔΕΝ υπάρχει — γράφει μόνο ο διακομιστής', () => {
    expect(source('src/services/file-record-lifecycle.ts')).not.toMatch(/export async function (?:placeHold|releaseHold)/);
    expect(source('src/services/file-record.service.ts')).not.toMatch(/\b(?:placeHold|releaseHold)\b/);
  });
});

describe('🏆 Α48 — οριστική διαγραφή: ποτέ πάνω σε δεσμευμένα bytes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('🔴 η πλατφόρμα αρνείται (hold) ⇒ ΚΑΜΙΑ εγγραφή `purged`, ΚΑΝΕΝΑ ίχνος διαγραφής', async () => {
    deletion = async () => { throw Object.assign(new Error('temporary hold'), { code: 403 }); };

    const result = await purgeFileRecord({ fileId: 'f1', storagePath: 'companies/c/files/f1.pdf', performedBy: 'system:purge', purgeReason: 'cron_trash' });

    expect(result).toEqual({ success: false, storageDeleted: false, error: 'storage-deletion-refused' });
    expect(update).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it('🔑 παρονομαστής: bytes που λείπουν ήδη (404) ⇒ η εγγραφή γίνεται `purged`', async () => {
    deletion = async () => { throw Object.assign(new Error('not found'), { code: 404 }); };

    const result = await purgeFileRecord({ fileId: 'f1', storagePath: 'p', performedBy: 'system:purge', purgeReason: 'cron_trash' });

    expect(result).toEqual({ success: true, storageDeleted: false });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ lifecycleState: 'purged' }));
  });

  it('🔴 σιωπηλή δέσμευση: ο κάδος ΔΕΝ αρνείται σε δέσμευση (Google Vault · Box)', () => {
    const trash = source('src/services/file-record-lifecycle.ts').split('export async function moveToTrash')[1]?.split('\nexport ')[0] ?? '';
    expect(trash).not.toMatch(/throw new Error\([^)]*hold/i);
  });

  it('🔴 η διαγραφή οντότητας φυλά τα δεσμευμένα αρχεία — κλειδωμένο στη ΣΥΛΛΟΓΗ', () => {
    expect(source('src/lib/firestore/deletion-guard.ts')).toMatch(/\[COLLECTIONS\.FILES\]:\s*\(data\)\s*=>\s*isFileHeld\(data\)/);
  });

  it.each([
    'src/app/api/files/purge/route.ts',
    'src/app/api/files/gdpr-delete/route.ts',
  ])('🔴 %s — κανένα «non-blocking» σβήσιμο bytes δίπλα στον ΕΝΑ γραφέα', (file) => {
    expect(source(file)).not.toMatch(/\.file\([^)]*\)\.delete\(/);
  });
});
