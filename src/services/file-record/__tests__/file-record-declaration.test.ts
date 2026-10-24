/**
 * @jest-environment node
 *
 * @fileoverview 🏆 **ΑΓΚΥΡΕΣ Ζ60–Ζ62 (ADR-916 Φ-Δ.6 · Ο14)** — το αντίτυπο Πρωτοκόλλου της εταιρείας είναι **record**
 * (Microsoft Purview «declare as record»): ούτε κάδος ούτε οριστική διαγραφή, για κανέναν — με **ΕΝΑΝ** κριτή για κουμπί,
 * πόρτα κάδου, πόρτες οριστικής διαγραφής και κανόνα.
 *
 * | Άγκυρα | Μετάλλαξη που πιάνει |
 * |---|---|
 * | Ζ60 ο κριτής: δέσμευση `record` **ή** σημάδι εκτός προσωπικού · ο αγοραστής **όχι** · άγνωστος κάτοχος ⇒ record | σκέλος που λείπει · σημάδι που μετρά και στον αγοραστή |
 * | Ζ60 το `record` **δεν** τοποθετείται από άνθρωπο | `record` στο `PLACEABLE_HOLD_TYPES` |
 * | Ζ61 η πόρτα κάδου αρνείται record (και στον διαχειριστή) · η επαναφορά όχι · απλή δέσμευση **όχι** (σιωπηλή) | πόρτα που δεν ρωτά τον κριτή |
 * | Ζ62 κανόνας ↔ κριτής: ίδια δύο κλειδιά · μόνο στο `files` · η διαγραφή το ρωτά | σκέλος κανόνα που λείπει · διαρροή στο `files_personal` |
 */

import { readFileSync } from 'fs';
import { join } from 'path';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/firebaseAdmin', () => ({ FieldValue: { serverTimestamp: () => 'ts' } }));
jest.mock('@/services/file-audit-admin.service', () => ({ recordFileAudit: jest.fn() }));

import { fileTrashBlockOf, isDeclaredRecord, isPlaceableHoldType } from '@/lib/files/file-hold';
import { isFileHeld } from '@/services/file-record/file-purge-helpers';
import { judgeFileTrash, type FileTrashActor } from '@/services/file-record/file-trash.service';

const MARK = { protocolId: 'phpr_1', handoverId: 'phov_1', revision: 1 };
const COMPANY_COPY = { companyId: 'comp_alfa', handoverProtocolOf: MARK, hold: 'record', status: 'ready', createdBy: 'system:property-handover-protocol' };
const BUYER_COPY = { userId: 'uid_anna', handoverProtocolOf: MARK, status: 'ready', createdBy: 'system:property-handover-protocol' };

describe('🏆 Ζ60 — ο ΕΝΑΣ κριτής του record', () => {
  it.each([
    ['δέσμευση record + σημάδι (η γέννηση)', COMPANY_COPY, true],
    ['μόνο δέσμευση record', { companyId: 'c', hold: 'record' }, true],
    ['μόνο σημάδι, εταιρεία', { companyId: 'c', handoverProtocolOf: MARK }, true],
    ['σημάδι αλλοιωμένο σε null, εταιρεία (fail-closed)', { companyId: 'c', handoverProtocolOf: null }, true],
    ['σημάδι χωρίς κάτοχο (fail-closed)', { handoverProtocolOf: MARK }, true],
    ['το αντίτυπο του ΑΓΟΡΑΣΤΗ (προσωπικό)', BUYER_COPY, false],
    ['νομική δέσμευση — σιωπηλή, όχι record', { companyId: 'c', hold: 'legal' }, false],
    ['απλό αρχείο', { companyId: 'c', hold: 'none' }, false],
  ] as const)('%s ⇒ %s', (_label, subject, expected) => {
    expect(isDeclaredRecord(subject)).toBe(expected);
    expect(fileTrashBlockOf(subject)).toBe(expected ? 'record' : null);
  });

  it('🔴 κάθε πόρτα οριστικής διαγραφής (`isFileHeld`) βλέπει record ΚΑΙ μόνο με το σημάδι — όχι το αντίτυπο του αγοραστή', () => {
    expect(isFileHeld({ companyId: 'c', handoverProtocolOf: MARK })).toBe(true);
    expect(isFileHeld(BUYER_COPY)).toBe(false);
    expect(isFileHeld({ companyId: 'c', hold: 'none' })).toBe(false);
  });

  it('🔴 το `record` ΔΕΝ τοποθετείται από άνθρωπο (η πόρτα hold το απορρίπτει ως άγνωστο είδος)', () => {
    expect(isPlaceableHoldType('record')).toBe(false);
    expect(isPlaceableHoldType('legal')).toBe(true);
  });
});

describe('🏆 Ζ61 — η πόρτα κάδου ρωτά τον ΙΔΙΟ κριτή με το κουμπί', () => {
  /** Ο δημιουργός — ώστε η άρνηση να αποδίδεται ΜΟΝΟ στο record, όχι στην ιδιοκτησία. */
  const author = { uid: 'system:property-handover-protocol', capability: {} } as unknown as FileTrashActor;

  it('🔴 κάδος σε record ⇒ `record` · παρονομαστής: το ίδιο αρχείο χωρίς record ⇒ επιτρέπεται', () => {
    expect(judgeFileTrash('trash', COMPANY_COPY, author)).toBe('record');
    expect(judgeFileTrash('trash', { companyId: 'comp_alfa', status: 'ready', createdBy: author.uid }, author)).toBeNull();
  });

  it('🔑 σιωπηλή δέσμευση μένει σιωπηλή: νομική δέσμευση ΔΕΝ αρνείται τον κάδο (Vault · Box)', () => {
    expect(judgeFileTrash('trash', { companyId: 'c', status: 'ready', hold: 'legal', createdBy: author.uid }, author)).toBeNull();
  });

  it('🔑 η επαναφορά ΔΕΝ αρνείται: record που βρέθηκε στον κάδο (πριν τον κριτή) σώζεται', () => {
    expect(judgeFileTrash('restore', COMPANY_COPY, author)).toBeNull();
  });
});

describe('🏆 Ζ62 — κανόνας και κριτής λένε το ΙΔΙΟ (firestore.rules)', () => {
  const RULES = readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8');
  const blockOf = (matchLine: string): string => RULES.split(matchLine)[1]?.split('\n    // ====')[0] ?? '';
  const fn = RULES.split('function fileIsNotDeclaredRecord() {')[1]?.split('\n    }')[0] ?? '';

  it('🔴 ο κανόνας ρωτά τα ΙΔΙΑ δύο κλειδιά με τον κριτή', () => {
    expect(fn).toContain(`resource.data.get('hold', 'none') != 'record'`);
    expect(fn).toContain(`!('handoverProtocolOf' in resource.data)`);
  });

  it('🔴 η οριστική διαγραφή του `files` τον ρωτά — του `files_personal` ΟΧΙ (το αντίτυπο του αγοραστή είναι δικό του)', () => {
    expect(blockOf('match /files/{fileId} {')).toMatch(/allow delete:[^;]*?&& fileIsNotDeclaredRecord\(\)/);
    expect(blockOf('match /files_personal/{fileId} {')).not.toContain('fileIsNotDeclaredRecord');
  });
});
