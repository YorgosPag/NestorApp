/**
 * @jest-environment node
 *
 * @fileoverview ADR-915 §36 — **η ενότητα ενός ακινήτου** (καρτέλα ακινήτου) πάνω στο fake Firestore: ο ΙΔΙΟΣ κριτής
 *   υποκειμένου με την πράξη, η ΙΔΙΑ όψη (`upkeepItemsOf`) με το μητρώο, ξένες αποφάσεις αόρατες. Δεδομένα **συνθετικά**.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { readDocumentRegistry } from '@/services/document-registry/document-registry.service';
import { upkeepDeclarationIdOf } from '@/services/document-registry/upkeep-declaration-schema';
import { readPropertyUpkeep } from '@/services/document-registry/upkeep-subject.server';

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

const COMPANY = 'comp_alfa';
const OTHER = 'comp_beta';
const NOW = new Date('2026-10-20T09:00:00.000Z');
const YDE = 'electrical-installation' as const;

let fake: FakeFirestore;
const db = (): AdminFirestore => fake as unknown as AdminFirestore;
const card = (propertyId = 'prop_1') => readPropertyUpkeep(db(), COMPANY, propertyId);

function seedProperty(id: string, over: Record<string, unknown> = {}): void {
  fake.seed(COLLECTIONS.PROPERTIES, id, { companyId: COMPANY, name: 'Μονάδα', type: 'apartment', operationalStatus: 'draft', ...over });
}

function seedDeclaration(companyId: string, propertyId: string, over: Record<string, unknown> = {}): void {
  const id = upkeepDeclarationIdOf(companyId, propertyId, YDE);
  fake.seed(COLLECTIONS.PROPERTY_UPKEEP_DECLARATIONS, id, {
    id, companyId, propertyId, scope: 'property', documentKind: YDE, decision: 'not-required', exemptionReason: 'no-own-supply',
    proposalAtDecision: { verdict: 'proposed', reason: 'phase-undeclared', propertyClass: 'residential', phase: 'draft' },
    declaredByUid: 'user_9', declaredAt: '2026-10-01T09:00:00.000Z', ...over,
  });
}

beforeEach(() => {
  fake = new FakeFirestore();
  seedProperty('prop_1');
});

describe('readPropertyUpkeep — η καρτέλα ακινήτου', () => {
  it('νέο ακίνητο χωρίς τίποτα ⇒ η ΙΔΙΑ πρόταση με το μητρώο', async () => {
    const reading = await card();
    const registry = await readDocumentRegistry(db(), COMPANY, NOW);
    expect(reading).toEqual({ kind: 'ready', items: registry.upkeep.filter((item) => item.propertyId === 'prop_1') });
    expect(reading).toMatchObject({ kind: 'ready', items: [{ declaration: null, proposal: { verdict: 'proposed', reason: 'phase-undeclared' } }] });
  });

  it('η απόφαση του γραφείου διαβάζεται· η πρόταση ΣΗΜΕΡΑ υπολογίζεται από τη φάση ΣΗΜΕΡΑ', async () => {
    seedProperty('prop_1', { operationalStatus: 'ready' });
    seedDeclaration(COMPANY, 'prop_1');
    expect(await card()).toMatchObject({
      kind: 'ready',
      items: [{ proposal: { reason: 'in-use' }, declaration: { decision: 'not-required', proposalAtDecision: { reason: 'phase-undeclared' } } }],
    });
  });

  it('απόφαση ΑΛΛΗΣ εταιρείας για το ίδιο ακίνητο ⇒ αόρατη (ξένο ≡ ανύπαρκτο)', async () => {
    seedDeclaration(OTHER, 'prop_1');
    expect(await card()).toMatchObject({ kind: 'ready', items: [{ declaration: null }] });
  });

  it('οικόπεδο χωρίς απόφαση ⇒ κενή λίστα (η ενότητα σιωπά)', async () => {
    seedProperty('prop_1', { type: 'plot' });
    expect(await card()).toEqual({ kind: 'ready', items: [] });
  });

  it('ακίνητο άλλης εταιρείας ή ανύπαρκτο ⇒ `absent`· στον κάδο ή στο αρχείο ⇒ `retired`', async () => {
    seedProperty('prop_x', { companyId: OTHER });
    seedProperty('prop_trash', { status: 'deleted' });
    seedProperty('prop_arch', { status: 'archived' });
    expect(await card('prop_x')).toEqual({ kind: 'absent' });
    expect(await card('prop_none')).toEqual({ kind: 'absent' });
    expect(await card('prop_trash')).toEqual({ kind: 'retired' });
    expect(await card('prop_arch')).toEqual({ kind: 'retired' });
  });
});
