/**
 * ⚓ ADR-950 §10 — οι δύο γραφείς πάνω στην **αποθηκευμένη ανάγνωση** ενός αρχείου επαφής: «Διόρθωση ανάγνωσης» και
 * «Αγνόηση» (ο δεύτερος ξαναγράφτηκε πάνω στον κοινό πυρήνα `stored-evidence-reading`).
 *
 * Οι άγκυρες που μετράνε:
 * - γράφεται **ΜΟΝΟ** το πεδίο της απόφασης — ποτέ `updatedAt` / `revision`·
 * - ο διακομιστής **ξανακρίνει** την τιμή (ψηφίο ελέγχου ΑΦΜ) και παίρνει ο ίδιος ταυτότητα, ώρα και αποτύπωμα μηχανής·
 * - ξένος μισθωτής = ανύπαρκτο· μόνο αρχεία επαφής·
 * - η **τιμή** δεν μπαίνει ποτέ στο ίχνος·
 * - το κλειδί της «Αγνόησης» βγαίνει από την ανάγνωση **με** τις διορθώσεις.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

jest.mock('server-only', () => ({}));
const mockRecordFileAudit = jest.fn(async () => 'audit_1');
jest.mock('@/services/file-audit-admin.service', () => ({
  recordFileAudit: (...args: unknown[]) => mockRecordFileAudit(...(args as [])),
}));

import { ENTITY_TYPES } from '@/config/domain-constants';

import { applyEvidenceCorrection, type EvidenceCorrectionCommand } from '../evidence-corrections-writer';
import { applyEvidenceDismissal } from '../evidence-dismissals-writer';

const NOW = '2026-11-24T12:00:00.000Z';
const VALID_VAT = '040817944';

const ANALYSIS = {
  evidencePurpose: 'stamp-signature',
  aiModel: null,
  fields: [
    { field: 'vatNumber', printed: '0408 7944', confidence: 0.95 },
    { field: 'phone', printed: '2310 55.95.96', confidence: 0.95 },
    { field: 'addressStreet', printed: 'Σαμοφράκης', confidence: 0.95 },
    { field: 'addressPostalCode', printed: '56334', confidence: 0.95 },
  ],
  fieldConsensus: [{ field: 'phone', state: 'disputed', alternate: '2310 55.95.95' }],
};

const contactFile = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  companyId: 'c1',
  entityType: ENTITY_TYPES.CONTACT,
  updatedAt: 'x',
  revision: 3,
  ingestion: { analysis: ANALYSIS },
  ...extra,
});

function dbWith(data: Record<string, unknown> | null) {
  const updates: Array<Record<string, unknown>> = [];
  const ref = { id: 'file_1' };
  const fake = {
    collection: () => ({ doc: () => ref }),
    runTransaction: async <T>(body: (tx: unknown) => Promise<T>) =>
      body({
        get: async () => ({ exists: data !== null, data: () => data ?? undefined }),
        update: (_ref: unknown, patch: Record<string, unknown>) => void updates.push(patch),
      }),
  };
  return { db: fake as unknown as AdminFirestore, updates };
}

const correct = (db: AdminFirestore, command: EvidenceCorrectionCommand, companyId = 'c1') =>
  applyEvidenceCorrection(db, { fileId: 'file_1', companyId, uid: 'u1', command }, () => NOW);

beforeEach(() => mockRecordFileAudit.mockClear());

describe('«Διόρθωση ανάγνωσης» — η εγγραφή', () => {
  it('γράφει ΜΟΝΟ `evidenceCorrections`, με ταυτότητα · ώρα · αποτύπωμα μηχανής από τον διακομιστή', async () => {
    const { db, updates } = dbWith(contactFile());
    const outcome = await correct(db, { act: 'correct', row: 'vatNumber', values: { vatNumber: VALID_VAT, correctedBy: 'someone-else' } });
    const correction = { row: 'vatNumber', values: { vatNumber: VALID_VAT }, machineReadingAtCorrection: '0408 7944', correctedBy: 'u1', correctedAt: NOW };
    expect(outcome).toEqual({ kind: 'corrected', correction });
    expect(updates).toEqual([{ evidenceCorrections: [correction] }]);
    expect(Object.keys(updates[0])).toEqual(['evidenceCorrections']);
  });

  it('το ίχνος λέει ΠΟΙΑ γραμμή, ποτέ την τιμή', async () => {
    const { db } = dbWith(contactFile());
    await correct(db, { act: 'correct', row: 'vatNumber', values: { vatNumber: VALID_VAT } });
    expect(mockRecordFileAudit).toHaveBeenCalledTimes(1);
    expect(mockRecordFileAudit).toHaveBeenCalledWith({
      fileId: 'file_1', action: 'evidence_correct', performedBy: 'u1', metadata: { row: 'vatNumber' }, companyId: 'c1',
    });
    expect(JSON.stringify(mockRecordFileAudit.mock.calls)).not.toContain(VALID_VAT);
  });

  it('ίδια γραμμή δύο φορές ⇒ ΜΙΑ διόρθωση (η νέα αντικαθιστά)· οι άλλες γραμμές μένουν', async () => {
    const phone = { row: 'phone', values: { phone: '2310 55 95 95' }, machineReadingAtCorrection: '2310 55.95.96', correctedBy: 'u0', correctedAt: 'then' };
    const old = { row: 'vatNumber', values: { vatNumber: '094063140' }, machineReadingAtCorrection: '0408 7944', correctedBy: 'u0', correctedAt: 'then' };
    const { db, updates } = dbWith(contactFile({ evidenceCorrections: [phone, old] }));
    await correct(db, { act: 'correct', row: 'vatNumber', values: { vatNumber: VALID_VAT } });
    const written = updates[0].evidenceCorrections as ReadonlyArray<{ row: string; correctedBy: string }>;
    expect(written.map((c) => [c.row, c.correctedBy])).toEqual([['phone', 'u0'], ['vatNumber', 'u1']]);
  });

  it('διεύθυνση: όποια μέρη έδωσε ο άνθρωπος — το αποτύπωμα κρατά ΟΛΑ τα μέρη της μηχανής', async () => {
    const { db, updates } = dbWith(contactFile());
    await correct(db, { act: 'correct', row: 'address', values: { addressStreet: 'Σαμοθράκης', addressPostalCode: '56334' } });
    expect(updates[0].evidenceCorrections).toEqual([
      expect.objectContaining({ values: { addressStreet: 'Σαμοθράκης', addressPostalCode: '56334' }, machineReadingAtCorrection: 'Σαμοφράκης||56334|' }),
    ]);
  });
});

describe('«Διόρθωση ανάγνωσης» — οι αρνήσεις δεν γράφουν ΤΙΠΟΤΑ', () => {
  it('ΑΦΜ που δεν περνά το ψηφίο ελέγχου ⇒ `invalid-value`, καμία εγγραφή, κανένα ίχνος', async () => {
    const { db, updates } = dbWith(contactFile());
    await expect(correct(db, { act: 'correct', row: 'vatNumber', values: { vatNumber: '040817945' } }))
      .resolves.toEqual({ kind: 'invalid-value', fields: ['vatNumber'] });
    expect(updates).toEqual([]);
    expect(mockRecordFileAudit).not.toHaveBeenCalled();
  });

  it('ξένος μισθωτής = ανύπαρκτο (ένα 404, κανένα μαντείο ύπαρξης)', async () => {
    const { db, updates } = dbWith(contactFile());
    await expect(correct(db, { act: 'correct', row: 'vatNumber', values: { vatNumber: VALID_VAT } }, 'c2')).resolves.toEqual({ kind: 'not-found' });
    await expect(correct(dbWith(null).db, { act: 'clear', row: 'vatNumber' })).resolves.toEqual({ kind: 'not-found' });
    expect(updates).toEqual([]);
    expect(mockRecordFileAudit).not.toHaveBeenCalled();
  });

  it('αρχείο που δεν ανήκει σε επαφή ⇒ `not-a-contact-file`', async () => {
    const { db, updates } = dbWith(contactFile({ entityType: ENTITY_TYPES.PROJECT }));
    await expect(correct(db, { act: 'correct', row: 'vatNumber', values: { vatNumber: VALID_VAT } })).resolves.toEqual({ kind: 'not-a-contact-file' });
    expect(updates).toEqual([]);
  });

  it('γραμμή που δεν ανήκει στην ανάγνωση (καμία ανάγνωση · άλλο είδος εγγράφου) ⇒ `no-such-row`', async () => {
    const { db, updates } = dbWith(contactFile({ ingestion: {} }));
    await expect(correct(db, { act: 'correct', row: 'vatNumber', values: { vatNumber: VALID_VAT } })).resolves.toEqual({ kind: 'no-such-row' });
    expect(updates).toEqual([]);
  });
});

describe('«Αναίρεση διόρθωσης»', () => {
  it('βγάζει ΜΟΝΟ τη γραμμή της και αφήνει ίχνος· δεύτερη φορά ⇒ ίδιο μητρώο (ιδεμπότητα)', async () => {
    const phone = { row: 'phone', values: { phone: '2310 55 95 95' }, machineReadingAtCorrection: '2310 55.95.96', correctedBy: 'u0', correctedAt: 'then' };
    const vat = { row: 'vatNumber', values: { vatNumber: VALID_VAT }, machineReadingAtCorrection: '0408 7944', correctedBy: 'u0', correctedAt: 'then' };
    const first = dbWith(contactFile({ evidenceCorrections: [phone, vat] }));
    await expect(correct(first.db, { act: 'clear', row: 'vatNumber' })).resolves.toEqual({ kind: 'cleared' });
    expect(first.updates).toEqual([{ evidenceCorrections: [phone] }]);
    expect(mockRecordFileAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'evidence_correct_clear', metadata: { row: 'vatNumber' } }));

    const again = dbWith(contactFile({ evidenceCorrections: [phone] }));
    await correct(again.db, { act: 'clear', row: 'vatNumber' });
    expect(again.updates).toEqual([{ evidenceCorrections: [phone] }]);
  });
});

describe('«Αγνόηση» — πάνω στον κοινό πυρήνα', () => {
  const dismiss = (db: AdminFirestore) =>
    applyEvidenceDismissal(db, { fileId: 'file_1', companyId: 'c1', uid: 'u1', command: { act: 'dismiss', row: 'vatNumber', reason: 'misread' } }, () => NOW);

  it('ΑΦΜ που η μηχανή δεν διάβασε καθαρά ⇒ τίποτα να αγνοηθεί, καμία εγγραφή', async () => {
    const { db, updates } = dbWith(contactFile());
    await expect(dismiss(db)).resolves.toEqual({ kind: 'nothing-to-dismiss' });
    expect(updates).toEqual([]);
  });

  it('μετά τη διόρθωση, το κλειδί είναι η τιμή του ΑΝΘΡΩΠΟΥ — και γράφεται ΜΟΝΟ `evidenceDismissals`', async () => {
    const vat = { row: 'vatNumber', values: { vatNumber: VALID_VAT }, machineReadingAtCorrection: '0408 7944', correctedBy: 'u0', correctedAt: 'then' };
    const { db, updates } = dbWith(contactFile({ evidenceCorrections: [vat] }));
    const dismissal = { row: 'vatNumber', documentValueAtDecision: VALID_VAT, reason: 'misread', decidedBy: 'u1', decidedAt: NOW };
    await expect(dismiss(db)).resolves.toEqual({ kind: 'dismissed', dismissal });
    expect(updates).toEqual([{ evidenceDismissals: [dismissal] }]);
  });

  it('«Αναίρεση αγνόησης» βγάζει τη γραμμή', async () => {
    const stored = { row: 'vatNumber', documentValueAtDecision: VALID_VAT, reason: 'misread', decidedBy: 'u0', decidedAt: 'then' };
    const { db, updates } = dbWith(contactFile({ evidenceDismissals: [stored] }));
    await expect(applyEvidenceDismissal(db, { fileId: 'file_1', companyId: 'c1', uid: 'u1', command: { act: 'restore', row: 'vatNumber' } }, () => NOW))
      .resolves.toEqual({ kind: 'restored' });
    expect(updates).toEqual([{ evidenceDismissals: [] }]);
  });
});
