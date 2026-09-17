/**
 * @jest-environment node
 *
 * @fileoverview 🏆 **ΑΓΚΥΡΕΣ Α33 · Α34 του ADR-864 §19** — ποιος κατεβάζει ένα παγωμένο αποδεικτικό, και ότι αφήνει ίχνος.
 *
 * | # | Άγκυρα | Μετάλλαξη που πρέπει να πιάσει |
 * |---|---|---|
 * | Α33 | ιδιοκτήτης (σύνδεσμος · λογαριασμός) βλέπει τα αποδεικτικά των **δικών του** εντολών — **και** μετά τη λήξη | φίλτρο ισχύος στην ανάγνωση |
 * | Α33 | γραφείο **μόνο** τα δικά του · ξένο = ανύπαρκτο | γραφείο βλέπει εντολή άλλου |
 * | Α33 | διαδρομή εκτός `mandate-evidence/` **δεν** υπογράφεται | εμπιστοσύνη στη διαδρομή του εγγράφου |
 * | Α34 | κάθε λήψη γράφει `document_accessed` με τον δρώντα | χωρίς ίχνος |
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

const signedDownloadUrl = jest.fn<Promise<unknown>, [{ storagePath: string; downloadFileName?: string }]>();
const recordOwnerPropertyEvidenceAccess = jest.fn<Promise<void>, [unknown, { uid: string }, { id: string }]>();

jest.mock('@/lib/storage/signed-download-url', () => ({
  signedDownloadUrl: (...args: Parameters<typeof signedDownloadUrl>) => signedDownloadUrl(...args),
}));
jest.mock('@/services/owner-property/owner-property-audit', () => ({
  recordOwnerPropertyEvidenceAccess: (...args: Parameters<typeof recordOwnerPropertyEvidenceAccess>) => recordOwnerPropertyEvidenceAccess(...args),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { COLLECTIONS } = require('@/config/firestore-collections') as typeof import('@/config/firestore-collections');
const { FakeFirestore } = require('@/services/places/__tests__/fake-firestore') as typeof import('@/services/places/__tests__/fake-firestore');
const fixtures = require('@/lib/owner-property/__tests__/owner-property-fixtures') as typeof import('@/lib/owner-property/__tests__/owner-property-fixtures');
const access = require('../mandate-evidence-access') as typeof import('../mandate-evidence-access');
/* eslint-enable @typescript-eslint/no-require-imports */

import type { AttestationEvidence, BrokeredListingMandate } from '@/types/owner-property-mandate';

const OWNER = { uid: 'user-1', companyId: null };
const AGENT = { uid: 'agent-1', companyId: 'comp_alfa' };

const evidence = (id: string, path = `mandate-evidence/ownp_a/${id}`): AttestationEvidence => ({
  id, path, digest: `sha256:${'b'.repeat(64)}`, sizeBytes: 10, contentType: 'application/pdf', fileName: `${id}.pdf`,
});

function attested(agencyCompanyId: string, item: AttestationEvidence, over: Partial<BrokeredListingMandate> = {}): BrokeredListingMandate {
  return fixtures.brokeredMandate({
    agencyCompanyId,
    confirmation: 'confirmed',
    consentNonce: `nonce-${agencyCompanyId}`,
    proof: { via: 'agency-attestation', attestedByUserId: 'agent-1', attestedAt: '2026-09-16T10:00:00.000Z', documentPath: 'companies/x/y.pdf', evidence: item },
    ...over,
  });
}

function seeded(mandates: readonly BrokeredListingMandate[]): AdminFirestore {
  const db = new FakeFirestore();
  db.seed(COLLECTIONS.OWNER_PROPERTIES, 'ownp_a', fixtures.validOwnerProperty({ authorCompanyId: null, mandates }));
  return db as unknown as AdminFirestore;
}

beforeEach(() => {
  jest.clearAllMocks();
  signedDownloadUrl.mockResolvedValue({ outcome: 'signed', url: 'https://signed.example/x', expiresAt: 0 });
  recordOwnerPropertyEvidenceAccess.mockResolvedValue(undefined);
});

describe('🏆 Α33 — το αποδεικτικό ανήκει στη ΣΧΕΣΗ', () => {
  it('🔴 ο ιδιοκτήτης με λογαριασμό κατεβάζει — ΚΑΙ μετά τη λήξη της εντολής (τότε ακριβώς αμφισβητεί)', async () => {
    const expired = attested('comp_alfa', evidence('mevd_1'), { expiresAt: '2020-01-01T00:00:00.000Z' });

    const outcome = await access.openMandateEvidence(seeded([expired]), { ownerPropertyId: 'ownp_a', who: { kind: 'owner-account', actor: OWNER }, evidenceId: 'mevd_1' });

    expect(outcome).toEqual({ kind: 'signed', url: 'https://signed.example/x' });
    expect(signedDownloadUrl).toHaveBeenCalledWith({ storagePath: 'mandate-evidence/ownp_a/mevd_1', downloadFileName: 'mevd_1.pdf' });
  });

  it('🔴 ο σύνδεσμος βλέπει ΜΟΝΟ την εντολή της πρόσκλησής του', async () => {
    const db = seeded([attested('comp_alfa', evidence('mevd_a')), attested('comp_beta', evidence('mevd_b'))]);
    const who = { kind: 'owner-link', nonce: 'nonce-comp_alfa', clientContactId: fixtures.brokeredMandate().clientContactId } as const;

    expect((await access.openMandateEvidence(db, { ownerPropertyId: 'ownp_a', who, evidenceId: 'mevd_a' })).kind).toBe('signed');
    expect(await access.openMandateEvidence(db, { ownerPropertyId: 'ownp_a', who, evidenceId: 'mevd_b' })).toEqual({ kind: 'absent' });
  });

  it('🔴 το γραφείο ΜΟΝΟ τα δικά του · ξένο λέγεται ΟΠΩΣ το ανύπαρκτο', async () => {
    const db = seeded([attested('comp_alfa', evidence('mevd_a')), attested('comp_beta', evidence('mevd_b'))]);
    const who = { kind: 'agency', actor: AGENT } as const;

    expect((await access.openMandateEvidence(db, { ownerPropertyId: 'ownp_a', who, evidenceId: 'mevd_a' })).kind).toBe('signed');
    expect(await access.openMandateEvidence(db, { ownerPropertyId: 'ownp_a', who, evidenceId: 'mevd_b' })).toEqual({ kind: 'absent' });
    expect(await access.openMandateEvidence(db, { ownerPropertyId: 'ownp_a', who, evidenceId: 'mevd_missing' })).toEqual({ kind: 'absent' });
    expect(signedDownloadUrl).toHaveBeenCalledTimes(1);
  });

  it('🔴 αποδεικτικό από έντυπο ΣΥΝΑΙΝΕΣΗΣ (όχι μόνο εντολής) βρίσκεται από την ίδια απαρίθμηση', async () => {
    const plain = fixtures.brokeredMandate({ agencyCompanyId: 'comp_alfa', confirmation: 'confirmed' });
    const withConsent: BrokeredListingMandate = {
      ...plain,
      privateMarketing: [{
        kind: 'granted', id: 'pmev_g', at: '2026-09-16T10:00:00.000Z', requestId: null, audience: 'custodians',
        text: { document: 'private-marketing-disclosure', version: 1, digest: 'sha256:x' }, acknowledged: [],
        values: { agency: 'Α', expiresOn: '1/1/2027' }, locale: 'el', channel: 'form', actorUserId: 'agent-1',
        proof: { via: 'agency-attestation', attestedByUserId: 'agent-1', attestedAt: '2026-09-16T10:00:00.000Z', documentPath: 'companies/x/y.pdf', evidence: evidence('mevd_pm') },
        term: { agencyCompanyId: 'comp_alfa', startsAt: plain.startsAt, expiresAt: plain.expiresAt },
      }],
    };
    const outcome = await access.openMandateEvidence(seeded([withConsent]), { ownerPropertyId: 'ownp_a', who: { kind: 'owner-account', actor: OWNER }, evidenceId: 'mevd_pm' });
    expect(outcome.kind).toBe('signed');
  });

  it('🔴 διαδρομή ΕΚΤΟΣ `mandate-evidence/` στο έγγραφο ⇒ ΔΕΝ υπογράφεται (ο κριτής θεματοφυλακής ρωτιέται)', async () => {
    const forged = attested('comp_alfa', evidence('mevd_x', 'companies/comp_beta/entities/contact/c1/secret.pdf'));
    const outcome = await access.openMandateEvidence(seeded([forged]), { ownerPropertyId: 'ownp_a', who: { kind: 'owner-account', actor: OWNER }, evidenceId: 'mevd_x' });
    expect(outcome).toEqual({ kind: 'absent' });
    expect(signedDownloadUrl).not.toHaveBeenCalled();
  });
});

describe('🏆 Α34 — κάθε λήψη αφήνει ίχνος (το «Viewed» του DocuSign)', () => {
  it('🔴 λήψη ⇒ `document_accessed` με τον δρώντα · άρνηση ⇒ κανένα ίχνος', async () => {
    const db = seeded([attested('comp_alfa', evidence('mevd_a'))]);

    await access.openMandateEvidence(db, { ownerPropertyId: 'ownp_a', who: { kind: 'agency', actor: AGENT }, evidenceId: 'mevd_a' });
    expect(recordOwnerPropertyEvidenceAccess).toHaveBeenCalledWith(expect.objectContaining({ id: 'ownp_a' }), AGENT, expect.objectContaining({ id: 'mevd_a' }));

    recordOwnerPropertyEvidenceAccess.mockClear();
    await access.openMandateEvidence(db, { ownerPropertyId: 'ownp_a', who: { kind: 'agency', actor: { uid: 'x', companyId: 'comp_gamma' } }, evidenceId: 'mevd_a' });
    expect(recordOwnerPropertyEvidenceAccess).not.toHaveBeenCalled();
  });
});
