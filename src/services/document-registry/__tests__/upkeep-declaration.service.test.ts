/**
 * @jest-environment node
 *
 * @fileoverview ADR-915 §35 — **η πράξη** «απόφαση μόνιμης υποχρέωσης» πάνω στο fake Firestore: ο κριτής «είναι του
 *   γραφείου;» είναι ο ΙΔΙΟΣ αναγνώστης με την οθόνη, η πρόταση την υπολογίζει ο διακομιστής, ο γραφέας είναι ιδεμποτής,
 *   και μόνο η επιβεβαίωση γεννά «λείπει». Όλα τα δεδομένα είναι **συνθετικά**.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { UpkeepDeclarationBody } from '@/lib/document-validity/upkeep-declaration-request';
import { readDocumentRegistry } from '@/services/document-registry/document-registry.service';
import { DOCUMENT_REGISTRY_CAPS } from '@/services/document-registry/document-registry.types';
import { upkeepDeclarationIdOf } from '@/services/document-registry/upkeep-declaration-schema';
import { declareRegistryUpkeep } from '@/services/document-registry/upkeep-declaration.service';

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn(async () => 'eaud_1') },
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { EntityAuditService } = require('@/services/entity-audit.service') as { EntityAuditService: { recordChange: jest.Mock } };

const COMPANY = 'comp_alfa';
const OTHER = 'comp_beta';
const NOW = new Date('2026-10-18T09:00:00.000Z');
const ACTOR = { companyId: COMPANY, uid: 'user_1', name: 'agent@example.test' };
const YDE = 'electrical-installation' as const;

let fake: FakeFirestore;
const db = (): AdminFirestore => fake as unknown as AdminFirestore;
const read = () => readDocumentRegistry(db(), COMPANY, NOW);
const declare = (body: Partial<UpkeepDeclarationBody> = {}) => declareRegistryUpkeep(db(), ACTOR, {
  propertyId: 'prop_1', documentKind: YDE, decision: 'required', exemptionReason: null, ...body,
}, NOW);
const stored = (propertyId = 'prop_1') =>
  fake.getAllDocs(COLLECTIONS.PROPERTY_UPKEEP_DECLARATIONS)[upkeepDeclarationIdOf(COMPANY, propertyId, YDE)];
const gaps = (registry: Awaited<ReturnType<typeof read>>) => registry.rows.filter((row) => row.kind === 'gap');

/** Ακίνητο με δηλωμένο ΠΕΑ (⇒ το ξέρει το μητρώο) — κατοικία, έτοιμη. */
function seedProperty(id: string, over: Record<string, unknown> = {}): void {
  fake.seed(COLLECTIONS.PROPERTIES, id, {
    companyId: COMPANY, name: 'Διαμέρισμα Α1', type: 'apartment', operationalStatus: 'ready',
    energy: { class: 'B', issuedOn: '2020-01-10', sourceFileId: null }, ...over,
  });
}

function seedDeclaration(propertyId: string, over: Record<string, unknown> = {}): void {
  const id = upkeepDeclarationIdOf(COMPANY, propertyId, YDE);
  fake.seed(COLLECTIONS.PROPERTY_UPKEEP_DECLARATIONS, id, {
    id, companyId: COMPANY, propertyId, scope: 'property', documentKind: YDE, decision: 'required', exemptionReason: null,
    proposalAtDecision: { verdict: 'proposed', reason: 'in-use', propertyClass: 'residential', phase: 'ready' },
    declaredByUid: 'user_9', declaredAt: '2026-10-01T09:00:00.000Z', ...over,
  });
}

beforeEach(() => {
  fake = new FakeFirestore();
  EntityAuditService.recordChange.mockClear();
  seedProperty('prop_1');
});

describe('πριν την απόφαση — πρόταση, ΟΧΙ «λείπει»', () => {
  it('κατοικία σε χρήση ⇒ η ενότητα προτείνει ΥΔΕ, και το μητρώο ΔΕΝ λέει «λείπει»', async () => {
    const registry = await read();
    expect(registry.upkeep).toEqual([expect.objectContaining({
      propertyId: 'prop_1', documentKind: YDE, declaration: null, proposal: expect.objectContaining({ verdict: 'proposed', reason: 'in-use' }),
    })]);
    expect(gaps(registry).filter((row) => row.gap.kind === YDE)).toEqual([]);
    expect(registry.properties.prop_1.phase).toBe('ready');
  });
});

describe('declareRegistryUpkeep', () => {
  it('επιβεβαίωση ⇒ γράφεται με την πρόταση ΤΟΥ ΔΙΑΚΟΜΙΣΤΗ, το μητρώο λέει «λείπει» (χωρίς να μπλοκάρει), ίχνος στο ακίνητο', async () => {
    expect(await declare()).toEqual({ ok: true, outcome: 'changed' });
    expect(stored()).toMatchObject({
      companyId: COMPANY, propertyId: 'prop_1', scope: 'property', decision: 'required', exemptionReason: null,
      proposalAtDecision: { verdict: 'proposed', reason: 'in-use', propertyClass: 'residential', phase: 'ready' },
      declaredByUid: 'user_1', declaredAt: NOW.toISOString(),
    });
    const registry = await read();
    expect(gaps(registry)).toEqual([expect.objectContaining({ state: 'missing', blocking: false, gap: expect.objectContaining({ kind: YDE }) })]);
    expect(EntityAuditService.recordChange).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'property', entityId: 'prop_1', action: 'updated', companyId: COMPANY, performedBy: 'user_1',
      changes: [
        { field: 'electricalInstallationStandingObligation', oldValue: null, newValue: 'required' },
        { field: 'electricalInstallationStandingObligationProposal', oldValue: null, newValue: 'proposed' },
      ],
    }));
  });

  it('η ΙΔΙΑ απόφαση ξανά ⇒ `unchanged`: καμία εγγραφή, κανένα δεύτερο ίχνος (ιδεμποτές)', async () => {
    await declare();
    EntityAuditService.recordChange.mockClear();
    expect(await declare()).toEqual({ ok: true, outcome: 'unchanged' });
    expect(EntityAuditService.recordChange).not.toHaveBeenCalled();
  });

  it('εξαίρεση με λόγο ⇒ καμία απαίτηση, κανένα κενό· ίχνος «απαιτείται → εξαίρεση (χωρίς δική του παροχή)»', async () => {
    await declare();
    expect(await declare({ decision: 'not-required', exemptionReason: 'no-own-supply' })).toEqual({ ok: true, outcome: 'changed' });
    expect(gaps(await read())).toEqual([]);
    expect(EntityAuditService.recordChange).toHaveBeenLastCalledWith(expect.objectContaining({
      changes: [
        { field: 'electricalInstallationStandingObligation', oldValue: 'required', newValue: 'not-required' },
        { field: 'electricalInstallationStandingObligationExemption', oldValue: null, newValue: 'no-own-supply' },
      ],
    }));
  });

  it('«ξανά ρώτα» (`null`) ⇒ το έγγραφο σβήνεται, το κενό φεύγει, η πρόταση γυρίζει', async () => {
    await declare();
    expect(await declare({ decision: null })).toEqual({ ok: true, outcome: 'changed' });
    expect(stored()).toBeUndefined();
    const registry = await read();
    expect(gaps(registry)).toEqual([]);
    expect(registry.upkeep[0]).toMatchObject({ declaration: null, proposal: { verdict: 'proposed' } });
  });

  it('🔴 είδος που ΔΕΝ είναι μόνιμη υποχρέωση (ΠΕΑ) ⇒ `not-standing`, τίποτα δεν γράφεται', async () => {
    expect(await declare({ documentKind: 'energy-certificate' })).toEqual({ ok: false, refusal: 'not-standing' });
    expect(fake.getAllDocs(COLLECTIONS.PROPERTY_UPKEEP_DECLARATIONS)).toEqual({});
    expect(EntityAuditService.recordChange).not.toHaveBeenCalled();
  });

  it('ακίνητο ΑΛΛΟΥ γραφείου ή ανύπαρκτο ⇒ `absent` (ποτέ «υπάρχει αλλά όχι δικό σου»)', async () => {
    seedProperty('prop_x', { companyId: OTHER });
    expect(await declare({ propertyId: 'prop_x' })).toEqual({ ok: false, refusal: 'absent' });
    expect(await declare({ propertyId: 'prop_missing' })).toEqual({ ok: false, refusal: 'absent' });
    expect(EntityAuditService.recordChange).not.toHaveBeenCalled();
  });

  it('η πρόταση της στιγμής: υπό κατασκευή ⇒ `not-proposed` στο ίχνος — η επιβεβαίωση ΠΑΡΑΚΑΜΠΤΕΙ, και αυτό μένει', async () => {
    seedProperty('prop_1', { operationalStatus: 'under-construction' });
    await declare();
    expect(stored()).toMatchObject({ proposalAtDecision: { verdict: 'not-proposed', reason: 'phase', phase: 'under-construction' } });
  });
});

describe('ο αναγνώστης των αποφάσεων', () => {
  it('ακίνητο με ΜΟΝΟ απόφαση (κανένα έγγραφο, καμία υπόθεση) ⇒ διαβάζεται, και λέει «λείπει»', async () => {
    seedProperty('prop_2', { energy: null });
    seedDeclaration('prop_2');
    const registry = await read();
    expect(registry.properties.prop_2).toBeDefined();
    expect(gaps(registry).map((row) => row.gap.propertyId)).toEqual(['prop_2']);
  });

  it('απόφαση για ακίνητο που ΔΕΝ είναι πια του γραφείου ⇒ αγνοείται (κανένα κενό για ξένο ακίνητο)', async () => {
    seedProperty('prop_2', { companyId: OTHER });
    seedDeclaration('prop_2');
    expect(gaps(await read())).toEqual([]);
  });

  it('χαλασμένη απόφαση (εξαίρεση χωρίς λόγο) ⇒ παραλείπεται — ποτέ «λείπει» από μαντεψιά', async () => {
    seedDeclaration('prop_1', { decision: 'not-required', exemptionReason: null });
    const registry = await read();
    expect(registry.upkeep[0].declaration).toBeNull();
  });

  it('απόφαση ΑΛΛΗΣ εταιρείας στην ίδια συλλογή ⇒ δεν διαβάζεται', async () => {
    seedDeclaration('prop_1', { companyId: OTHER });
    const registry = await read();
    expect(gaps(registry)).toEqual([]);
    expect(registry.upkeep[0].declaration).toBeNull();
  });

  it('το όριο λέγεται: πάνω από το όριο ⇒ `upkeep-declarations` στο `truncatedSources`', async () => {
    for (let i = 0; i <= DOCUMENT_REGISTRY_CAPS['upkeep-declarations']; i += 1) {
      fake.seed(COLLECTIONS.PROPERTY_UPKEEP_DECLARATIONS, `pupk_${i}`, { companyId: COMPANY, propertyId: `p_${i}` });
    }
    expect((await read()).truncatedSources).toContain('upkeep-declarations');
  });
});
