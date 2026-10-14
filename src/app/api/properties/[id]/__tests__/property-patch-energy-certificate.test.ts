/**
 * @jest-environment node
 *
 * @fileoverview **Η ΑΓΚΥΡΑ ΤΗΣ ΠΟΡΤΑΣ** — τι δέχεται το PATCH του γραφείου ως ενεργειακό πιστοποιητικό, και τι γράφει
 * μαζί του (ADR-777 §8.94).
 * @related api/properties/[id]/property-patch-helpers · api/properties/[id]/property-energy-patch ·
 *   lib/energy-certificate/energy-certificate
 *
 * 🔴 Ίδιος λόγος ύπαρξης με το `property-patch-common-charges.test.ts`: το `PropertyPatchSchema` είναι
 * `.passthrough()`, άρα οι γραμμές που επικυρώνουν το `energy` και **αρνούνται** το `legality` είναι αφαιρέσιμες χωρίς
 * να σπάσει τίποτα — το πρώτο θα γραφόταν ανεξέλεγκτο, το δεύτερο θα επέτρεπε «επαληθευμένο από μητρώο» από φόρμα.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';

import {
  ENERGY_ISSUED_ON_CONTRADICTS_DOCUMENT,
  companyEnergyDeclarationPatch,
  energyDeclarationPatch,
} from '../property-energy-patch';
import { PropertyPatchSchema } from '../property-patch-helpers';

const UNDECLARED = {
  class: null, primaryEnergy: null, co2Emissions: null, issuedOn: null, usefulArea: null, finalEnergy: null,
  scope: null, sourceFileId: null, absence: null,
};
const FULL = { ...UNDECLARED, class: 'B+', primaryEnergy: 132.4, co2Emissions: 38.1, issuedOn: '2024-03-12' };
const AT = '2026-10-13T18:00:00.000Z';

describe('Π1 — η πόρτα δέχεται το μπλοκ', () => {
  it('απόν πεδίο περνά — το ΠΕΑ είναι προαιρετικό', () => {
    expect(PropertyPatchSchema.safeParse({ name: 'Δ1' }).success).toBe(true);
  });

  it.each([
    ['πλήρης δήλωση', FULL],
    ['μόνο κλάση', { ...UNDECLARED, class: 'G' }],
    ['τίποτα δηλωμένο (σβήσιμο)', UNDECLARED],
    ['υπό έκδοση', { ...UNDECLARED, absence: 'pending' }],
  ])('%s ⇒ περνά', (_label, energy) => {
    expect(PropertyPatchSchema.safeParse({ energy }).success).toBe(true);
  });

  it('🔴 ο χθεσινός πελάτης (ανοιχτή καρτέλα, μπλοκ ΧΩΡΙΣ `scope`/`sourceFileId`) ⇒ περνά, και η απουσία γράφεται `null` (ADR-777 §8.96)', () => {
    const { scope: _scope, sourceFileId: _source, ...yesterday } = FULL;
    const parsed = PropertyPatchSchema.parse({ energy: yesterday });
    expect(parsed.energy).toEqual(FULL);
  });
});

describe('Π2 — η πόρτα απορρίπτει ό,τι δεν είναι δήλωση', () => {
  it.each([
    ['άγνωστη κλάση', { ...UNDECLARED, class: 'H' }],
    ['κλάση με ελληνικό γράμμα', { ...UNDECLARED, class: 'Γ' }],
    ['κατανάλωση πάνω από το όριο', { ...FULL, primaryEnergy: 40_000 }],
    ['δύο δεκαδικά', { ...FULL, co2Emissions: 38.12 }],
    ['αριθμός ως συμβολοσειρά', { ...FULL, primaryEnergy: '132,4' }],
    ['ανύπαρκτη ημέρα', { ...FULL, issuedOn: '2024-02-31' }],
    ['ημέρα σε άλλη μορφή', { ...FULL, issuedOn: '12/03/2024' }],
    ['το παλιό σχήμα `{ class }`', { class: 'B' }],
    ['αριθμός πιστοποιητικού', { ...FULL, certificateId: '12345/2024' }],
    ['null', null],
  ])('🔴 %s ⇒ ΑΠΟΡΡΙΨΗ', (_label, energy) => {
    expect(PropertyPatchSchema.safeParse({ energy }).success).toBe(false);
  });

  it('🔒 `legality` από τον πελάτη ⇒ ΑΠΟΡΡΙΨΗ — οι αξιώσεις γράφονται μόνο από τον server', () => {
    const forged = [{ kind: 'energy-performance', tier: 'registry-verified', value: 'A+', subject: [], authority: 'x', assertedAt: AT, validUntil: null }];
    expect(PropertyPatchSchema.safeParse({ legality: forged }).success).toBe(false);
    expect(PropertyPatchSchema.safeParse({ legality: [] }).success).toBe(false);
  });
});

describe('Π3 — ό,τι περνά, γράφεται ΚΑΝΟΝΙΚΟΠΟΙΗΜΕΝΟ', () => {
  it('αριθμοί χωρίς κλάση πέφτουν πριν φτάσουν στο έγγραφο', () => {
    const parsed = PropertyPatchSchema.parse({ energy: { ...FULL, class: null } });
    expect(parsed.energy).toEqual(UNDECLARED);
  });
});

describe('Π4 — τι γράφει η διαδρομή όταν το σώμα φέρει `energy`', () => {
  it('χωρίς `energy` στο σώμα ⇒ τίποτα (ούτε κενό `legality`)', () => {
    expect(energyDeclarationPatch('prop_1', undefined, {}, AT)).toEqual({});
  });

  it('μπλοκ ΚΑΙ αξίωση μαζί — με τη στιγμή της δήλωσης και ισχύ +10 έτη', () => {
    const patch = energyDeclarationPatch('prop_1', FULL, {}, AT);
    expect(patch.energy).toEqual(FULL);
    expect(patch.legality).toEqual([
      {
        kind: 'energy-performance',
        subject: [{ propertyId: 'prop_1', spaceId: null }],
        tier: 'self-declared',
        value: 'B+',
        authority: null,
        assertedAt: AT,
        validUntil: '2034-03-12',
      },
    ]);
  });

  it('🔴 τα πεδία του παλιού σχήματος ΕΠΙΒΙΩΝΟΥΝ — το `update({ energy })` αντικαθιστά ολόκληρο το αντικείμενο', () => {
    const existing = { energy: { class: 'C', certificateId: '12345/2021', validUntil: 'legacy' } };
    const patch = energyDeclarationPatch('prop_1', FULL, existing, AT);
    expect(patch.energy).toEqual({ certificateId: '12345/2021', validUntil: 'legacy', ...FULL });
  });

  it('σβήσιμο κλάσης ⇒ η αυτοδηλωμένη αξίωση φεύγει· οι άλλες μένουν', () => {
    const other = { kind: 'building-identity', subject: [{ propertyId: 'prop_1', spaceId: null }], tier: 'document-provided', value: null, authority: 'μηχανικός', assertedAt: AT, validUntil: null };
    const declared = energyDeclarationPatch('prop_1', FULL, { legality: [other] }, AT);
    const cleared = energyDeclarationPatch('prop_1', UNDECLARED, { legality: declared.legality }, AT);
    expect(cleared.legality).toEqual([other]);
  });

  it('δύσμορφες αποθηκευμένες αξιώσεις δεν ξαναγράφονται', () => {
    const patch = energyDeclarationPatch('prop_1', UNDECLARED, { legality: [{ kind: 'άγνωστο' }, 'σκουπίδι'] }, AT);
    expect(patch.legality).toEqual([]);
  });
});

describe('Π5 — ADR-915 Φ3β-2: η δήλωση διαβάζεται απέναντι στο έγγραφό της', () => {
  const FROM_PEA = { ...FULL, sourceFileId: 'file_pea_1' };
  const FILE = {
    companyId: 'comp_a', entityType: 'property', entityId: 'prop_1', status: 'ready', contentType: 'application/pdf',
    storagePath: 'companies/comp_a/x.pdf',
    documentFacts: {
      kind: 'energy-certificate', issuedOn: '2024-03-12', printedValidUntil: '2034-03-01',
      source: { kind: 'document-text', reader: 'pea-text' }, recordedBy: 'u1', recordedAt: AT,
    },
  };
  const SCOPE = { companyId: 'comp_a', propertyId: 'prop_1' };
  const dbWith = (file: Record<string, unknown>) => {
    const db = new FakeFirestore();
    db.seed(COLLECTIONS.FILES, 'file_pea_1', file);
    return db as unknown as AdminFirestore;
  };
  const claimOf = (patch: Record<string, unknown>) => (patch.legality as ReadonlyArray<{ validUntil: string | null }>)[0];

  it('🔴 η αξίωση παίρνει την τυπωμένη λήξη του αρχείου (Α4), όχι μόνο τον κανόνα', async () => {
    const patch = await companyEnergyDeclarationPatch(dbWith(FILE), SCOPE, FROM_PEA, {}, AT);
    expect(claimOf(patch).validUntil).toBe('2034-03-01');
    expect(patch.energy).toEqual(FROM_PEA);
  });

  it('🔒 αρχείο ΞΕΝΗΣ εταιρείας ⇒ τα γεγονότα του αγνοούνται (καμία διαρροή λήξης)', async () => {
    const patch = await companyEnergyDeclarationPatch(dbWith({ ...FILE, companyId: 'comp_b' }), SCOPE, FROM_PEA, {}, AT);
    expect(claimOf(patch).validUntil).toBe('2034-03-12');
  });

  it('🔴 ημερομηνία ≠ ανάγνωσης με δηλωμένη πηγή ⇒ 422 με όνομα', async () => {
    await expect(
      companyEnergyDeclarationPatch(dbWith(FILE), SCOPE, { ...FROM_PEA, issuedOn: '2024-03-11' }, {}, AT),
    ).rejects.toMatchObject({ statusCode: 422, errorCode: ENERGY_ISSUED_ON_CONTRADICTS_DOCUMENT });
  });

  it('χωρίς `energy` στο σώμα ⇒ τίποτα, καμία ανάγνωση', async () => {
    expect(await companyEnergyDeclarationPatch(dbWith(FILE), SCOPE, undefined, {}, AT)).toEqual({});
  });
});
