/**
 * ⚓ ADR-915 §22 — τα δύο σημεία του server που βλέπουν **όλους** τους πωλητές:
 *  - η συλλογή τεκμηρίων ψάχνει την επαφή **κάθε** πωλητή (αλλιώς η γραμμή του δεύτερου θα έλεγε πάντα «λείπει»),
 *    και το ευρετήριο εξαρτήσεων (CDC) τις περιέχει όλες (αλλιώς ανέβασμα του δεύτερου δεν θα φρεσκάριζε την όψη)·
 *  - παλιά αιτήματα εγγράφων σε γραμμή πωλητή (σκέτο `itemId`) ανήκουν στον μοναδικό πωλητή — όπως οι αποκλίσεις.
 * Συνθετικά αναγνωριστικά.
 */

import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { sellerParty } from '@/lib/conveyance/case-parties';
import type { ConveyanceCaseParties, ConveyanceCaseSubject } from '@/types/conveyance-case';
import { caseDependencyKeys, evidenceTargets } from '../conveyance-evidence.server';
import { readCaseDocumentRequests } from '../conveyance-document-request-store.server';

const SUBJECT: ConveyanceCaseSubject = { kind: 'property', propertyId: 'prop_1', buildingId: null, projectId: null, appurtenances: [] };

describe('συλλογή τεκμηρίων — κάθε πωλητής', () => {
  const parties: ConveyanceCaseParties = {
    sellers: [sellerParty('cont_a', 'legal_entity', 'principal'), sellerParty('cont_b', 'person', 'other'), sellerParty(null, 'person', 'other')],
    buyers: [],
  };

  it('μία αναζήτηση ανά επαφή πωλητή · πωλητής χωρίς επαφή δεν ψάχνεται', () => {
    expect(evidenceTargets(SUBJECT, parties).filter((t) => t.level === 'seller_contact').map((t) => t.entityId)).toEqual(['cont_a', 'cont_b']);
  });

  it('το ευρετήριο εξαρτήσεων περιέχει την επαφή ΚΑΘΕ πωλητή', () => {
    const keys = caseDependencyKeys(SUBJECT, parties);
    expect(keys.filter((key) => key.includes('cont_a') || key.includes('cont_b'))).toHaveLength(2);
  });
});

describe('αιτήματα εγγράφων — παλιό κλειδί γραμμής πωλητή', () => {
  const stored = (id: string, checklistItemId: string) => ({
    id, companyId: 'comp_a', caseId: 'cvc_1', projectId: null, checklistItemId, requesterRole: 'notary', requesterUid: 'u_n',
    recipient: 'host', dayKey: '2026-10-01', requestedAt: '2026-10-01T09:00:00Z', notifiedAt: null,
  });

  async function readWith(parties: ConveyanceCaseParties): Promise<readonly string[]> {
    const fake = new FakeFirestore();
    fake.seed(COLLECTIONS.CONVEYANCE_DOCUMENT_REQUESTS, 'r1', stored('r1', 'seller_enfia_certificate'));
    fake.seed(COLLECTIONS.CONVEYANCE_DOCUMENT_REQUESTS, 'r2', stored('r2', 'title_deed'));
    const requests = await readCaseDocumentRequests(fake as unknown as Firestore, { id: 'cvc_1', companyId: 'comp_a', parties });
    return (requests ?? []).map((request) => request.checklistItemId).sort();
  }

  it('ένας πωλητής ⇒ το αίτημα δένεται στη γραμμή του · της υπόθεσης δεν αγγίζεται', async () => {
    await expect(readWith({ sellers: [sellerParty('cont_a', 'legal_entity', 'principal')], buyers: [] }))
      .resolves.toEqual(['seller_enfia_certificate@cont_a', 'title_deed']);
  });

  it('δύο πωλητές ⇒ μένει ως έχει (ποτέ μαντεψιά ανάμεσα σε συμπωλητές)', async () => {
    await expect(readWith({ sellers: [sellerParty('cont_a', 'legal_entity', 'principal'), sellerParty('cont_b', 'person', 'other')], buyers: [] }))
      .resolves.toEqual(['seller_enfia_certificate', 'title_deed']);
  });
});
