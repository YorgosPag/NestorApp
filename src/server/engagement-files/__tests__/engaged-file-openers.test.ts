/**
 * @jest-environment node
 *
 * ADR-942 Φ2 — το μητρώο «άνοιγμα αρχείου μέσω συμμετοχής»: δρομολόγηση από το είδος της **δικής** συμμετοχής,
 * η μεταβίβαση περνά **αυτούσια**. Κάθε `it` ονομάζει τη μετάλλαξη.
 */

import type { Firestore } from 'firebase-admin/firestore';
import { openFileAsEngaged } from '../engaged-file-openers';

const mockList = jest.fn();
jest.mock('@/lib/auth/engagement-read', () => ({ listEngagementsOfUser: (...args: unknown[]) => mockList(...args) }));
const mockOpenCase = jest.fn(async () => ({ ok: true, url: 'case', expiresAt: 1, fileName: 'c', contentType: 'x' }));
jest.mock('@/services/conveyance/conveyance-case-file-access.service', () => ({ openCaseFile: (...args: unknown[]) => mockOpenCase(...args) }));
const mockOpenIssuance = jest.fn(async () => ({ ok: true, url: 'issuance', expiresAt: 1, fileName: 'i', contentType: 'x' }));
jest.mock('@/services/document-registry/issuance-file-access.service', () => ({ openIssuanceFile: (...args: unknown[]) => mockOpenIssuance(...args) }));

const db = {} as unknown as Firestore;
const request = { uid: 'u_1', email: null, engagementId: 'eng_1', fileId: 'f_1', mode: 'view' as const, nowMs: 1 };

describe('openFileAsEngaged — ολικό μητρώο ανά είδος', () => {
  beforeEach(() => jest.clearAllMocks());

  it('συμμετοχή έκδοσης ⇒ προσαρμογέας έκδοσης (μετάλλαξη: όλα στη μεταβίβαση, όπως πριν τη Φ2)', async () => {
    mockList.mockResolvedValueOnce({ outcome: 'ok', engagements: [{ id: 'eng_1', subject: { kind: 'document_issuance', assignmentId: 'a' } }] });
    expect(await openFileAsEngaged(db, request)).toMatchObject({ ok: true, url: 'issuance' });
    expect(mockOpenCase).not.toHaveBeenCalled();
  });

  it('συμμετοχή μεταβίβασης ⇒ `openCaseFile` με το ΙΔΙΟ αίτημα (μετάλλαξη: αλλαγμένο αίτημα στη μεταβίβαση)', async () => {
    mockList.mockResolvedValueOnce({ outcome: 'ok', engagements: [{ id: 'eng_1', subject: { kind: 'conveyance_case', caseId: 'c' } }] });
    expect(await openFileAsEngaged(db, request)).toMatchObject({ ok: true, url: 'case' });
    expect(mockOpenCase).toHaveBeenCalledWith(db, request);
    expect(mockOpenIssuance).not.toHaveBeenCalled();
  });

  it('ξένη/ανύπαρκτη συμμετοχή ⇒ 404 χωρίς προσαρμογέα (μετάλλαξη: δρομολόγηση από το αίτημα)', async () => {
    mockList.mockResolvedValueOnce({ outcome: 'ok', engagements: [{ id: 'eng_other', subject: { kind: 'document_issuance', assignmentId: 'a' } }] });
    expect(await openFileAsEngaged(db, request)).toEqual({ ok: false, rejection: 'not-found' });
    expect(mockOpenIssuance).not.toHaveBeenCalled();
  });

  it('η λίστα δεν διαβάστηκε ⇒ `unknown`, όχι 404 (μετάλλαξη: «δεν ξέρω» = «δεν υπάρχει»)', async () => {
    mockList.mockResolvedValueOnce({ outcome: 'unknown', why: 'query-failed' });
    expect(await openFileAsEngaged(db, request)).toEqual({ ok: false, rejection: 'unknown' });
  });
});
