/**
 * @jest-environment node
 *
 * @fileoverview 🏆 **ΑΓΚΥΡΕΣ Α25 · Α26 · Α28 του ADR-864** — ο ένας αναγνώστης της κλειστής διάθεσης.
 * @related ADR-864 §18.4 Δ2 · services/mandate/private-marketing-panel.service.ts
 *
 * | # | Άγκυρα | Μετάλλαξη |
 * |---|---|---|
 * | Α28 | το γραφείο διαβάζει **μόνο** τη δική του εντολή· ο ιδιοκτήτης **όλες** | επιστροφή όλων σε κάθε δρώντα |
 * | Α25 | οι τιμές του πάνελ = **ακριβώς** όσες κρίνει ο CAS (επωνυμία `companies` + λήξη) | επωνυμία από άλλη πηγή |
 * | Α26 | συναίνεση για παλιούς όρους φτάνει ως `outdated` | σύμπτυξη σε `absent` |
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

jest.mock('@/services/company/company-public-name.reader', () => ({
  ...jest.requireActual('@/services/company/company-public-name.reader'),
  readCompanyPublicName: async (_db: unknown, companyId: string) => `Επωνυμία ${companyId}`,
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { COLLECTIONS } = require('@/config/firestore-collections') as typeof import('@/config/firestore-collections');
const { FakeFirestore } = require('@/services/places/__tests__/fake-firestore') as typeof import('@/services/places/__tests__/fake-firestore');
const fixtures = require('@/lib/owner-property/__tests__/owner-property-fixtures') as typeof import('@/lib/owner-property/__tests__/owner-property-fixtures');
const { readPrivateMarketingPanels } = require('../private-marketing-panel.service') as typeof import('../private-marketing-panel.service');
const { consentValuesFor, consentTextVerdict } = require('@/lib/mandate/private-marketing-consent-text') as typeof import('@/lib/mandate/private-marketing-consent-text');
const { clauseIdsOf } = require('@/lib/legal/legal-clauses') as typeof import('@/lib/legal/legal-clauses');
const standingLib = require('@/lib/mandate/private-marketing-standing') as typeof import('@/lib/mandate/private-marketing-standing');
/* eslint-enable @typescript-eslint/no-require-imports */

import type { OwnerProperty } from '@/types/owner-property';
import type { BrokeredListingMandate } from '@/types/owner-property-mandate';

const NOW = '2026-09-16T10:00:00.000Z';
const OWNER = { uid: 'user-1', companyId: null };

function mandate(agencyCompanyId: string): BrokeredListingMandate {
  return fixtures.brokeredMandate({ confirmation: 'confirmed', agreement: 'open', agencyCompanyId, consentNonce: `nonce-${agencyCompanyId}` });
}

function seeded(mandates: readonly BrokeredListingMandate[], over: Partial<OwnerProperty> = {}): AdminFirestore {
  const db = new FakeFirestore();
  db.seed(COLLECTIONS.OWNER_PROPERTIES, 'ownp_a', fixtures.validOwnerProperty({ authorCompanyId: null, mandates, ...over }));
  return db as unknown as AdminFirestore;
}

describe('🏆 Α28 — ο αναγνώστης δίνει στον καθένα ΜΟΝΟ ό,τι δικαιούται ο γραφέας', () => {
  it('🔴 το γραφείο βλέπει μόνο τη ΔΙΚΗ του εντολή', async () => {
    const db = seeded([mandate('comp_alfa'), mandate('comp_beta')]);

    const read = await readPrivateMarketingPanels(db, 'ownp_a', { uid: 'agent-1', companyId: 'comp_alfa' }, NOW);

    expect(read.kind).toBe('found');
    if (read.kind === 'found') {
      expect(read.viewer).toBe('agency');
      expect(read.panels.map((panel) => panel.agencyCompanyId)).toEqual(['comp_alfa']);
    }
  });

  it('🔴 γραφείο χωρίς εντολή στην καταχώρηση ⇒ `absent` (ίδιο με ανύπαρκτη)', async () => {
    const db = seeded([mandate('comp_alfa')]);
    expect(await readPrivateMarketingPanels(db, 'ownp_a', { uid: 'agent-9', companyId: 'comp_gamma' }, NOW)).toEqual({ kind: 'absent' });
    expect(await readPrivateMarketingPanels(db, 'ownp_missing', { uid: 'agent-9', companyId: 'comp_gamma' }, NOW)).toEqual({ kind: 'absent' });
  });

  it('🔑 παρονομαστής: ο ιδιοκτήτης βλέπει ΟΛΕΣ τις εντολές της δικής του καταχώρησης', async () => {
    const db = seeded([mandate('comp_alfa'), mandate('comp_beta')]);

    const read = await readPrivateMarketingPanels(db, 'ownp_a', OWNER, NOW);

    expect(read.kind === 'found' && read.viewer).toBe('owner');
    expect(read.kind === 'found' && read.panels.map((panel) => panel.agencyCompanyId)).toEqual(['comp_alfa', 'comp_beta']);
  });
});

describe('🏆 Α25 · Α26 — οι τιμές και η κατάσταση είναι ΑΥΤΕΣ που κρίνει ο γραφέας', () => {
  it('🔴 Α25 — υποβολή με τις τιμές του πάνελ ΠΕΡΝΑ τον CAS του γραφέα', async () => {
    const alfa = mandate('comp_alfa');
    const read = await readPrivateMarketingPanels(seeded([alfa]), 'ownp_a', OWNER, NOW);
    if (read.kind !== 'found' || read.disclosure === null) throw new Error('panel expected');
    const panel = read.panels[0];
    if (panel === undefined) throw new Error('panel expected');

    expect(panel.values).toEqual(consentValuesFor('Επωνυμία comp_alfa', alfa.expiresAt));
    const verdict = consentTextVerdict(
      { version: read.disclosure.frozen.version, acknowledged: clauseIdsOf(read.disclosure.frozen), locale: 'el', values: panel.values },
      consentValuesFor('Επωνυμία comp_alfa', alfa.expiresAt),
    );
    expect(verdict.kind).toBe('accepted');
  });

  it('🔴 Α26 — συναίνεση για ΠΑΛΙΟΥΣ όρους φτάνει ως `outdated`, ποτέ `absent`', async () => {
    const alfa = mandate('comp_alfa');
    const grant = {
      kind: 'granted' as const,
      id: 'pmev_g',
      at: NOW,
      requestId: null,
      audience: 'custodians' as const,
      text: { document: 'private-marketing-disclosure' as const, version: 1, digest: 'sha256:x' },
      acknowledged: [],
      values: consentValuesFor('Επωνυμία comp_alfa', alfa.expiresAt),
      locale: 'el' as const,
      channel: 'account' as const,
      actorUserId: 'user-1',
      proof: { via: 'owner-consent' as const },
      term: { ...standingLib.mandateTermOf(alfa), expiresAt: '2026-01-01T00:00:00.000Z' },
    };
    const read = await readPrivateMarketingPanels(seeded([{ ...alfa, privateMarketing: [grant] }]), 'ownp_a', OWNER, NOW);

    expect(read.kind === 'found' && read.panels[0]?.standing).toEqual({ kind: 'outdated' });
  });
});
