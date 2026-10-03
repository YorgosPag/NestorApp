/**
 * @jest-environment node
 *
 * ADR-901 Φ4 §6 Σ-5 — η σάρωση λήξεων: **ποιοι** ειδοποιούνται, για **ποιες** γραμμές, και πότε **σιωπά**.
 * Ο κατάλογος, οι συμμετοχές και οι διαχειριστές είναι ψεύτικοι — εδώ ασκείται η ενορχήστρωση.
 */

import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { ChecklistRow } from '@/types/conveyance-case';
import type { Engagement } from '@/types/engagement';

const announceExpiryToHost = jest.fn(async (_n: { recipientUid: string; alerts: readonly unknown[] }) => true);
const announceExpiryToEngaged = jest.fn(async (_n: { engagement: Engagement; alerts: readonly { itemId: string }[] }) => true);
jest.mock('../conveyance-expiry-notifier', () => ({
  announceExpiryToHost: (n: { recipientUid: string; alerts: readonly unknown[] }) => announceExpiryToHost(n),
  announceExpiryToEngaged: (n: { engagement: Engagement; alerts: readonly { itemId: string }[] }) => announceExpiryToEngaged(n),
}));

let legalPhase: string | null = 'preliminary_signed';
jest.mock('../conveyance-subject.server', () => ({
  loadConveyanceSubject: async () => ({ propertyName: 'Δ3', legalPhase, factSources: {} }),
}));
jest.mock('@/lib/workspace/workspace-administrators', () => ({ activeWorkspaceAdministrators: async () => ['u_admin', 'u_host'] }));

let engagements: Engagement[] = [];
jest.mock('../conveyance-engagement-support', () => ({ listCaseEngagements: async () => engagements }));

/** Ο κατάλογος ανά θεατή: ο οικοδεσπότης βλέπει και τη γραμμή του αγοραστή, ο δικηγόρος πωλητή όχι. */
const rows = (role: string): ChecklistRow[] => [
  { itemId: 'encumbrance_certificate', status: 'expiring', expiresOn: '2026-10-08' },
  ...(role === 'seller_lawyer' ? [] : [{ itemId: 'buyer_tax_clearance', status: 'expired', expiresOn: '2026-10-01' }]),
] as unknown as ChecklistRow[];
jest.mock('../conveyance-engagement-access.service', () => ({
  HOST_CHECKLIST_VIEWER: { role: 'host', audience: 'host' },
  engagementChecklistViewer: (e: { role: string; template: string }) => ({ role: e.role, audience: e.template }),
  checklistForRole: async (_db: unknown, _r: unknown, _c: unknown, viewer: { role: string }) => ({ rows: rows(viewer.role) }),
}));

import { sweepConveyanceExpiryAlerts } from '../conveyance-expiry-alerts.server';

const NOW = Date.parse('2026-10-03T06:00:00.000Z');
const DAY = 86_400_000;
let fake: FakeFirestore;
const db = () => fake as unknown as Firestore;

function engagement(overrides: Partial<Engagement>): Engagement {
  return {
    id: 'eng_sl', hostCompanyId: 'comp_a', projectId: 'proj_1', uid: 'u_sl', email: 'sl@x.gr', template: 'legal',
    role: 'seller_lawyer', subject: { kind: 'conveyance_case', caseId: 'cvc_1' }, scopes: ['conveyance:case:view'],
    state: 'active', expiresAt: new Date(NOW + 300 * DAY).toISOString(), origin: { kind: 'professional_appointment', contactId: 'c' },
    consents: [], offeredBy: 'u_host', offeredAt: new Date(NOW - DAY).toISOString(), respondedAt: new Date(NOW - DAY).toISOString(),
    revokedBy: null, closedAt: null, updatedAt: new Date(NOW - DAY).toISOString(), ...overrides,
  };
}

function seedCase(id: string, storedState = 'open'): void {
  fake.seed(COLLECTIONS.CONVEYANCE_CASES, id, {
    id, companyId: 'comp_a', profile: 'new_build_company', storedState, targetSigningDate: '2026-10-15', catalogVersion: 'v0', version: 1,
    subject: { kind: 'property', propertyId: 'prop_1', buildingId: 'bld_1', projectId: 'proj_1', appurtenances: [] },
    parties: { seller: { contactId: 'cont_s', kind: 'legal_entity' }, buyers: [] }, facts: {}, overrides: {},
    createdBy: 'u_host', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', cancellation: null,
  });
}

beforeEach(() => {
  fake = new FakeFirestore();
  legalPhase = 'preliminary_signed';
  engagements = [];
  announceExpiryToHost.mockClear();
  announceExpiryToEngaged.mockClear();
});

describe('sweepConveyanceExpiryAlerts', () => {
  it('οικοδεσπότης = δημιουργός ∪ διαχειριστές, ΧΩΡΙΣ διπλό (ο δημιουργός είναι και διαχειριστής)', async () => {
    seedCase('cvc_1');
    const report = await sweepConveyanceExpiryAlerts(db(), NOW);
    expect(announceExpiryToHost.mock.calls.map(([n]) => n.recipientUid).sort()).toEqual(['u_admin', 'u_host']);
    expect(report).toMatchObject({ considered: 1, notified: 2, skipped: 0, failed: 0, truncated: false });
  });

  it('Α22 — ο δικηγόρος πωλητή ειδοποιείται ΜΟΝΟ για τις γραμμές του ρόλου του', async () => {
    // Μετάλλαξη: ο κατάλογος του οικοδεσπότη για όλους ⇒ ο δικηγόρος μαθαίνει για έγγραφα του αγοραστή.
    seedCase('cvc_1');
    engagements = [engagement({})];
    await sweepConveyanceExpiryAlerts(db(), NOW);
    expect(announceExpiryToEngaged).toHaveBeenCalledTimes(1);
    expect(announceExpiryToEngaged.mock.calls[0][0].alerts.map((a) => a.itemId)).toEqual(['encumbrance_certificate']);
  });

  it('πρόταση χωρίς αποδοχή / ανακλημένη ⇒ ΚΑΜΙΑ ειδοποίηση στον επαγγελματία', async () => {
    seedCase('cvc_1');
    engagements = [engagement({ state: 'offered' }), engagement({ id: 'eng_n', uid: 'u_n', role: 'notary', state: 'revoked', revokedAt: new Date(NOW - 1).toISOString() })];
    await sweepConveyanceExpiryAlerts(db(), NOW);
    expect(announceExpiryToEngaged).not.toHaveBeenCalled();
  });

  it('υπογεγραμμένη υπόθεση (`signed` παράγεται από τη φάση) ⇒ σιωπή — η ισχύς δεν κρίνει πια τίποτα', async () => {
    seedCase('cvc_1');
    legalPhase = 'final_signed';
    const report = await sweepConveyanceExpiryAlerts(db(), NOW);
    expect(announceExpiryToHost).not.toHaveBeenCalled();
    expect(report).toMatchObject({ considered: 1, skipped: 1 });
  });

  it('κλειστή/ακυρωμένη υπόθεση δεν σαρώνεται καθόλου', async () => {
    seedCase('cvc_1', 'cancelled');
    expect(await sweepConveyanceExpiryAlerts(db(), NOW)).toMatchObject({ considered: 0 });
  });
});
