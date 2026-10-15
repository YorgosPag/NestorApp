/**
 * @jest-environment node
 *
 * ADR-915 Φ5α — η σάρωση του μητρώου λήξεων: **ποιοι** ειδοποιούνται, **πότε σιωπά**, και πότε το ημερολόγιο ακμών
 * **δεν** προχωρά. Ψεύτικα: η ανάγνωση του μητρώου (το συνθετικό fixture, από τον αληθινό πυρήνα), οι διαχειριστές
 * και η αποστολή. **Αληθινά**: τα στάδια, οι ακμές και το ημερολόγιο πάνω στη ψεύτικη βάση.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { ExpiryAlert } from '@/lib/document-validity/expiry-alert-stage';
import type { RegistryView } from '@/lib/document-validity/document-registry-view';
import { fixtureResponse } from '@/lib/document-validity/__tests__/registry-fixture';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { DocumentRegistryResponse } from '../document-registry.types';

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

interface Sent { companyId: string; recipientUid: string; alerts: readonly ExpiryAlert[]; view: RegistryView }
let delivery: 'sent' | 'skipped' | 'failed' = 'sent';
const announce = jest.fn(async (_notice: Sent) => delivery);
jest.mock('../registry-expiry-notifier', () => ({ announceRegistryExpiry: (notice: Sent) => announce(notice) }));

const ADMINS: Record<string, readonly string[]> = { comp_a: ['u_a1', 'u_a2'], comp_b: ['u_b1'] };
let admins: Record<string, readonly string[]> = ADMINS;
jest.mock('@/lib/workspace/workspace-administrators', () => ({
  activeWorkspaceAdministrators: async (_db: unknown, companyId: string) => [...(admins[companyId] ?? [])],
}));

let registries: Record<string, DocumentRegistryResponse> = {};
jest.mock('../document-registry.service', () => ({
  readDocumentRegistry: async (_db: unknown, companyId: string) => {
    const registry = registries[companyId];
    if (!registry) throw new Error(`no registry for ${companyId}`);
    return registry;
  },
}));

import { sweepRegistryExpiryAlerts } from '../registry-expiry-alerts.server';

const NOW = Date.parse('2026-10-15T05:21:00.000Z');
let fake: FakeFirestore;
const db = () => fake as unknown as Firestore;
const sweep = () => sweepRegistryExpiryAlerts(db(), NOW);
const ledgerOf = (companyId: string) => fake.getData(COLLECTIONS.DOCUMENT_EXPIRY_ALERT_LEDGERS, companyId);

beforeEach(() => {
  fake = new FakeFirestore();
  fake.seed(COLLECTIONS.COMPANIES, 'comp_a', { name: 'Α' });
  registries = { comp_a: fixtureResponse() };
  admins = ADMINS;
  delivery = 'sent';
  announce.mockClear();
});

describe('sweepRegistryExpiryAlerts', () => {
  it('πρώτη σάρωση ⇒ μία σύνοψη ανά διαχειριστή, με τις 5 γραμμές σε στάδιο, και το ημερολόγιο γράφεται', async () => {
    const report = await sweep();
    expect(announce.mock.calls.map(([n]) => n.recipientUid)).toEqual(['u_a1', 'u_a2']);
    expect(announce.mock.calls[0][0].alerts.map((a) => `${a.rowId}:${a.stage}`)).toEqual([
      'f-expired:expired', 'f-expiring:lead', 'f-soon:d30',
      'missing:ownp_7:energy-certificate:missing', 'missing:p6:energy-certificate:missing',
    ]);
    expect(report).toMatchObject({ considered: 1, notified: 2, skipped: 0, failed: 0, truncated: false, incomplete: 0 });
    expect(ledgerOf('comp_a')?.rows).toHaveLength(5);
  });

  it('🔑 δεύτερη σάρωση την ίδια μέρα ⇒ ΣΙΩΠΗ (ακμή, όχι στάθμη)', async () => {
    await sweep();
    announce.mockClear();
    const report = await sweep();
    expect(announce).not.toHaveBeenCalled();
    expect(report.notified).toBe(0);
  });

  it('νέο στάδιο σε ΜΙΑ γραμμή ⇒ η σύνοψη λέει μόνο αυτήν', async () => {
    await sweep();
    announce.mockClear();
    // Τα στάδια κρίνονται από το `asOf` του μητρώου: 2026-11-01 σε 6 ημέρες ⇒ `d7`· 2026-12-01 σε 36 ⇒ ακόμη `lead`.
    registries = { comp_a: fixtureResponse({ asOf: '2026-10-26' }) };
    await sweep();
    expect(announce.mock.calls[0][0].alerts.map((a) => `${a.rowId}:${a.stage}`)).toEqual(['f-soon:d7']);
  });

  it('🔴 αποτυχία αποστολής ⇒ το ημερολόγιο ΔΕΝ προχωρά (αύριο ξαναδοκιμάζει)', async () => {
    delivery = 'failed';
    const report = await sweep();
    expect(report.failed).toBe(1);
    expect(ledgerOf('comp_a')).toBeUndefined();
  });

  it('🔴 κανένας διαχειριστής ⇒ skipped, και το ημερολόγιο ΔΕΝ προχωρά (δεν το έμαθε κανείς)', async () => {
    admins = {};
    const report = await sweep();
    expect(report.skipped).toBe(1);
    expect(ledgerOf('comp_a')).toBeUndefined();
  });

  it('προτίμηση κλειστή (skipped από τον orchestrator) ⇒ το ημερολόγιο προχωρά — ο άνθρωπος το επέλεξε', async () => {
    delivery = 'skipped';
    const report = await sweep();
    expect(report.notified).toBe(0);
    expect(ledgerOf('comp_a')?.rows).toHaveLength(5);
  });

  it('🔑 μόνο οι διαχειριστές ΤΟΥ ΙΔΙΟΥ γραφείου — κάθε σύνοψη φέρει το companyId του', async () => {
    fake.seed(COLLECTIONS.COMPANIES, 'comp_b', { name: 'Β' });
    registries = { comp_a: fixtureResponse(), comp_b: fixtureResponse() };
    await sweep();
    const pairs = announce.mock.calls.map(([n]) => `${n.companyId}:${n.recipientUid}`).sort();
    expect(pairs).toEqual(['comp_a:u_a1', 'comp_a:u_a2', 'comp_b:u_b1']);
  });

  it('αποτυχία ενός γραφείου ΔΕΝ σταματά τα υπόλοιπα', async () => {
    fake.seed(COLLECTIONS.COMPANIES, 'comp_0', { name: 'σπασμένο' });
    const report = await sweep();
    expect(report).toMatchObject({ considered: 2, failed: 1, notified: 2 });
  });

  it('κομμένο μητρώο ⇒ μετριέται ως incomplete, και το ημερολόγιο ΣΥΓΧΩΝΕΥΕΙ', async () => {
    fake.seed(COLLECTIONS.DOCUMENT_EXPIRY_ALERT_LEDGERS, 'comp_a', {
      companyId: 'comp_a', asOf: '2026-10-14', updatedAt: '2026-10-14T05:21:00.000Z',
      rows: [{ rowId: 'file:unread', stage: 'd30', expiresOn: '2026-11-10' }],
    });
    registries = { comp_a: fixtureResponse({ truncated: true, truncatedSources: ['files'] }) };
    const report = await sweep();
    expect(report.incomplete).toBe(1);
    expect((ledgerOf('comp_a')?.rows as { rowId: string }[]).map((r) => r.rowId)).toContain('file:unread');
  });

  it('προσγείωση: μείγμα λήξεων και κενών ⇒ «Όλα» (καμία προβολή δεν κρύβει γραμμή της σύνοψης)', async () => {
    await sweep();
    expect(announce.mock.calls[0][0].view).toBe('all');
  });
});
