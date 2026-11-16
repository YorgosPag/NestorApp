/**
 * ADR-942 Φ1 — το μητρώο προσαρμογέων «Ζήτησε έγγραφο»: δρομολόγηση **από το είδος της δικής μου συμμετοχής**.
 *
 * - η έκδοση φτάνει στον προσαρμογέα της έκδοσης (μετάλλαξη: 404 όπως πριν τη Φ1)
 * - η μεταβίβαση φτάνει **αυτούσια** στη δική της πόρτα (`resolveEngagedCase` + `requestCaseDocuments`) — μηδέν αλλαγή
 * - ξένη/ανύπαρκτη συμμετοχή ⇒ `not-found`· «δεν ξέρω» ⇒ `unknown` (ποτέ μαντεψιά είδους)
 */

import type { Firestore } from 'firebase-admin/firestore';

const listEngagementsOfUser = jest.fn();
const requestIssuanceDocuments = jest.fn();
const resolveEngagedCase = jest.fn();
const requestCaseDocuments = jest.fn();

jest.mock('@/lib/auth/engagement-read', () => ({ listEngagementsOfUser: (...args: unknown[]) => listEngagementsOfUser(...args) }));
jest.mock('@/services/document-registry/issuance-document-request.service', () => ({
  requestIssuanceDocuments: (...args: unknown[]) => requestIssuanceDocuments(...args),
}));
jest.mock('@/services/conveyance/conveyance-engagement-access.service', () => ({
  resolveEngagedCase: (...args: unknown[]) => resolveEngagedCase(...args),
}));
jest.mock('@/services/conveyance/conveyance-document-request.service', () => ({
  requestCaseDocuments: (...args: unknown[]) => requestCaseDocuments(...args),
}));

import { requestDocumentsAsEngaged } from '../request-adapters';

const db = {} as Firestore;
const INPUT = { uid: 'u1', engagementId: 'eng_1', itemIds: ['unit-permit'], nowMs: 1 };

const issuance = { id: 'eng_1', uid: 'u1', role: 'document_issuer', subject: { kind: 'document_issuance', assignmentId: 'dia_1' } };
const conveyance = { id: 'eng_1', uid: 'u1', role: 'notary', subject: { kind: 'conveyance_case', caseId: 'cvc_1' } };

beforeEach(() => jest.clearAllMocks());

describe('requestDocumentsAsEngaged', () => {
  it('συμμετοχή σε ανάθεση έκδοσης ⇒ ο προσαρμογέας της έκδοσης, ποτέ η μεταβίβαση', async () => {
    listEngagementsOfUser.mockResolvedValue({ outcome: 'ok', engagements: [issuance] });
    requestIssuanceDocuments.mockResolvedValue({ ok: true, items: [] });
    await expect(requestDocumentsAsEngaged(db, INPUT)).resolves.toEqual({ ok: true, items: [] });
    expect(requestIssuanceDocuments).toHaveBeenCalledWith(db, { engagement: issuance, uid: 'u1', itemIds: ['unit-permit'], nowMs: 1 });
    expect(resolveEngagedCase).not.toHaveBeenCalled();
  });

  it('συμμετοχή σε μεταβίβαση ⇒ η ΙΔΙΑ διαδρομή με πριν (resolveEngagedCase → requestCaseDocuments)', async () => {
    listEngagementsOfUser.mockResolvedValue({ outcome: 'ok', engagements: [conveyance] });
    const access = { engagement: conveyance, record: { id: 'cvc_1' }, context: { propertyName: null } };
    resolveEngagedCase.mockResolvedValue({ ok: true, access });
    requestCaseDocuments.mockResolvedValue({ ok: true, items: [] });
    await requestDocumentsAsEngaged(db, INPUT);
    expect(resolveEngagedCase).toHaveBeenCalledWith(db, 'u1', 'eng_1', 1);
    expect(requestCaseDocuments).toHaveBeenCalledWith(db, {
      requester: { kind: 'engaged', engagement: conveyance }, record: access.record, context: access.context, itemIds: ['unit-permit'], nowMs: 1,
    });
    expect(requestIssuanceDocuments).not.toHaveBeenCalled();
  });

  it('η άρνηση της πόρτας της μεταβίβασης περνά ως έχει (π.χ. denied με λόγο)', async () => {
    listEngagementsOfUser.mockResolvedValue({ outcome: 'ok', engagements: [conveyance] });
    resolveEngagedCase.mockResolvedValue({ ok: false, rejection: 'denied', verdict: 'revoked' });
    await expect(requestDocumentsAsEngaged(db, INPUT)).resolves.toEqual({ ok: false, rejection: 'denied', verdict: 'revoked' });
    expect(requestCaseDocuments).not.toHaveBeenCalled();
  });

  it('ξένη ή ανύπαρκτη συμμετοχή ⇒ not-found (καμία μαρτυρία ύπαρξης)', async () => {
    listEngagementsOfUser.mockResolvedValue({ outcome: 'ok', engagements: [{ ...issuance, id: 'other' }] });
    await expect(requestDocumentsAsEngaged(db, INPUT)).resolves.toEqual({ ok: false, rejection: 'not-found' });
  });

  it('«δεν ξέρω» ⇒ unknown, ποτέ μαντεψιά είδους', async () => {
    listEngagementsOfUser.mockResolvedValue({ outcome: 'unknown', why: 'read-failed' });
    await expect(requestDocumentsAsEngaged(db, INPUT)).resolves.toEqual({ ok: false, rejection: 'unknown' });
    expect(requestIssuanceDocuments).not.toHaveBeenCalled();
    expect(resolveEngagedCase).not.toHaveBeenCalled();
  });
});
