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
import { generateDeterministicPropertyUpkeepDeclarationId } from '@/services/enterprise-id.service';

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

const COMPANY = 'comp_alfa';
const OTHER = 'comp_beta';
const NOW = new Date('2026-10-20T09:00:00.000Z');
const YDE = 'electrical-installation' as const;

let fake: FakeFirestore;
const db = (): AdminFirestore => fake as unknown as AdminFirestore;
const OFFICE = { uid: 'user_1', companyId: COMPANY };
const card = (propertyId = 'prop_1') => readPropertyUpkeep(db(), OFFICE, propertyId);

function seedProperty(id: string, over: Record<string, unknown> = {}): void {
  fake.seed(COLLECTIONS.PROPERTIES, id, { companyId: COMPANY, name: 'Μονάδα', type: 'apartment', operationalStatus: 'draft', ...over });
}

function seedDeclaration(companyId: string, propertyId: string, over: Record<string, unknown> = {}): void {
  const id = upkeepDeclarationIdOf({ companyId }, propertyId, YDE);
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

describe('§37 — ο ιδιώτης χωρίς μεσίτη: ο ΕΝΑΣ κριτής θεματοφυλακής, το ΔΙΚΟ του βιβλίο', () => {
  const OWNER = { uid: 'user_owner', companyId: null };
  const mine = (propertyId = 'ownp_me') => readPropertyUpkeep(db(), OWNER, propertyId);

  beforeEach(() => {
    fake.seed(COLLECTIONS.OWNER_PROPERTIES, 'ownp_me', { authorUserId: 'user_owner', authorCompanyId: null, title: 'Το σπίτι μου', type: 'apartment' });
  });

  it('το δικό του ακίνητο ⇒ πρόταση `phase-undeclared` (το ακίνητο ιδιώτη δεν έχει φάση) + η ΔΙΚΗ του απόφαση', async () => {
    expect(await mine()).toMatchObject({ kind: 'ready', items: [{ declaration: null, proposal: { verdict: 'proposed', reason: 'phase-undeclared' } }] });
    const id = upkeepDeclarationIdOf({ userId: 'user_owner' }, 'ownp_me', YDE);
    fake.seed(COLLECTIONS.PROPERTY_UPKEEP_DECLARATIONS, id, {
      id, userId: 'user_owner', propertyId: 'ownp_me', scope: 'owner-property', documentKind: YDE, decision: 'required', exemptionReason: null,
      proposalAtDecision: { verdict: 'proposed', reason: 'phase-undeclared', propertyClass: 'residential', phase: null },
      declaredByUid: 'user_owner', declaredAt: '2026-10-20T09:00:00.000Z',
    });
    expect(await mine()).toMatchObject({ kind: 'ready', items: [{ declaration: { decision: 'required' } }] });
  });

  it('απόφαση ΓΡΑΦΕΙΟΥ για το ίδιο ακίνητο ⇒ αόρατη στον ιδιώτη (άλλο βιβλίο)', async () => {
    seedDeclaration(COMPANY, 'ownp_me', { scope: 'owner-property' });
    expect(await mine()).toMatchObject({ kind: 'ready', items: [{ declaration: null }] });
  });

  it('ακίνητο εταιρείας · υπό θεματοφυλακή γραφείου · ξένο προσωπικό ⇒ `absent` για τον ιδιώτη', async () => {
    fake.seed(COLLECTIONS.OWNER_PROPERTIES, 'ownp_office', { authorUserId: 'user_owner', authorCompanyId: COMPANY, title: 'Υπό γραφείο' });
    fake.seed(COLLECTIONS.OWNER_PROPERTIES, 'ownp_other', { authorUserId: 'user_x', authorCompanyId: null, title: 'Ξένο' });
    expect(await mine('prop_1')).toEqual({ kind: 'absent' });
    expect(await mine('ownp_office')).toEqual({ kind: 'absent' });
    expect(await mine('ownp_other')).toEqual({ kind: 'absent' });
  });

  it('🔒 η ταυτότητα του ΓΡΑΦΕΙΟΥ είναι η ίδια με το §35 (καμία μετανάστευση)· ο ιδιώτης δεν συμπίπτει ποτέ', () => {
    expect(upkeepDeclarationIdOf({ companyId: 'comp_a' }, 'p', YDE))
      .toBe(generateDeterministicPropertyUpkeepDeclarationId(`comp_a:p:${YDE}`));
    expect(upkeepDeclarationIdOf({ userId: 'comp_a' }, 'p', YDE)).not.toBe(upkeepDeclarationIdOf({ companyId: 'comp_a' }, 'p', YDE));
  });
});
