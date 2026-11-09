/**
 * @fileoverview ADR-934 §5.2.2 Μ-β4 — ο αναγνώστης του εγγράφου λήψης: ποτέ cast. Ξένο ή αλλοιωμένο ⇒ «καμία λήψη», ποτέ ψεύτικο «έτοιμο».
 */

import { importAssetFetchFromDocument } from '../import-asset-fetch-document';

const SHA = 'a'.repeat(64);
const expected = { companyId: 'comp_1', batchId: 'cibat_1', uri: 'https://cdn.example.com/a.pdf' };

const document = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  ...expected,
  roles: ['datasheet', 'notARole'],
  status: 'ready',
  leaseUntil: null,
  attempts: 2,
  failure: null,
  verdict: 'newVersion',
  content: { fileId: 'file_1', sha256: SHA, sizeBytes: 9000, kind: 'document', ext: 'pdf', contentType: 'application/pdf' },
  transport: 'insecure',
  updatedAt: '2026-11-09T10:00:00.000Z',
  updatedBy: 'user_1',
  ...overrides,
});

describe('importAssetFetchFromDocument', () => {
  it('έγκυρο έγγραφο ⇒ ο ορισμός· άγνωστος ρόλος πέφτει, δεν ρίχνει το έγγραφο', () => {
    expect(importAssetFetchFromDocument(document(), expected)).toMatchObject({
      ...expected, roles: ['datasheet'], status: 'ready', attempts: 2, verdict: 'newVersion', transport: 'insecure',
      content: { fileId: 'file_1', sha256: SHA, sizeBytes: 9000, kind: 'document' },
    });
  });

  it('αποτυχία με κωδικό και κωδικό HTTP', () => {
    const failed = importAssetFetchFromDocument(document({ status: 'failed', verdict: null, content: null, failure: { code: 'notFound', httpStatus: 404 } }), expected);
    expect(failed?.failure).toEqual({ code: 'notFound', httpStatus: 404 });
  });

  it.each([
    ['ανύπαρκτο', undefined],
    ['άλλος χώρος', document({ companyId: 'comp_2' })],
    ['άλλη παρτίδα', document({ batchId: 'cibat_2' })],
    ['άλλη διεύθυνση', document({ uri: 'https://cdn.example.com/b.pdf' })],
    ['άγνωστη κατάσταση', document({ status: 'queued' })],
    ['άγνωστος κωδικός αποτυχίας', document({ failure: { code: 'gremlins', httpStatus: null } })],
    ['αλλοιωμένο sha256', document({ content: { fileId: 'file_1', sha256: 'xyz', sizeBytes: 1, kind: 'document', ext: 'pdf', contentType: 'application/pdf' } })],
    ['άγνωστο είδος', document({ content: { fileId: 'file_1', sha256: SHA, sizeBytes: 1, kind: 'hologram', ext: 'pdf', contentType: 'application/pdf' } })],
    ['αρνητικές προσπάθειες', document({ attempts: -1 })],
    ['άγνωστη μεταφορά', document({ transport: 'carrier-pigeon' })],
  ])('%s ⇒ null', (_name, data) => {
    expect(importAssetFetchFromDocument(data, expected)).toBeNull();
  });
});
