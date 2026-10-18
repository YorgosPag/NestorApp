/**
 * @jest-environment node
 *
 * @fileoverview **Το μητρώο λήξεων — η ανάγνωση διακομιστή** (ADR-915 Φ4β · §11.3).
 * @related services/document-registry/document-registry.service.ts
 *
 * ⚠️ **Τίποτα δεν πλάθεται εκτός από τη βάση** (ιδίωμα `mandate-catalog.test`): ο πυρήνας, ο ανεκτικός αναγνώστης, ο
 * κριτής υπόθεσης και οι παραγωγοί απαιτήσεων τρέχουν **αληθινά**. Όλα τα δεδομένα είναι **συνθετικά**.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { ENTITY_TYPES, FILE_STATUS } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { PUBLIC_LISTING_SCHEMA_VERSION } from '@/lib/listings/public-listing-schema';
import {
  REGISTRY_ROW_STATES,
  registryRowIdOf,
  type RegistryDocumentRow,
  type RegistryRow,
} from '@/lib/document-validity/document-registry';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { readDocumentRegistry } from '@/services/document-registry/document-registry.service';
import { DOCUMENT_REGISTRY_CAPS } from '@/services/document-registry/document-registry.types';
import { obligorDesignationIdOf } from '@/services/document-registry/obligor-designation-schema';

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

const COMPANY = 'comp_alfa';
const OTHER = 'comp_beta';
/** 2026-10-15 στην Ελλάδα. ΠΕΑ 2016-11-01 ⇒ λήγει 2026-11-01 ⇒ μέσα στις 60 ημέρες ανανέωσης. */
const NOW = new Date('2026-10-15T09:00:00.000Z');
const ISSUED = '2016-11-01';

type Doc = Record<string, unknown>;

function facts(over: Doc = {}): Doc {
  return {
    kind: 'energy-certificate', issuedOn: ISSUED, printedValidUntil: null,
    source: { kind: 'document-text', reader: 'pea-text' }, recordedBy: 'system:pea-import', recordedAt: '2026-10-01T00:00:00.000Z',
    ...over,
  };
}

function file(over: Doc = {}): Doc {
  return {
    companyId: COMPANY, entityType: ENTITY_TYPES.PROPERTY, entityId: 'prop_1', status: FILE_STATUS.READY,
    isDeleted: false, displayName: 'ΠΕΑ Α1.pdf', documentFacts: facts(), ...over,
  };
}

function property(over: Doc = {}, energy: Doc = {}): Doc {
  return { companyId: COMPANY, name: 'Διαμέρισμα Α1', energy: { class: 'B', issuedOn: ISSUED, sourceFileId: null, ...energy }, ...over };
}

function openCase(over: Doc = {}): Doc {
  return {
    id: 'case_1', companyId: COMPANY,
    subject: { kind: 'property', propertyId: 'prop_1', buildingId: null, projectId: null, appurtenances: [] },
    profile: 'resale_private',
    parties: { seller: { contactId: null, kind: 'person' }, buyers: [] },
    facts: {}, overrides: {}, storedState: 'open', targetSigningDate: '2026-12-01', catalogVersion: 'v1', version: 1,
    createdBy: 'user_1', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', cancellation: null,
    ...over,
  };
}

let fake: FakeFirestore;
const db = (): AdminFirestore => fake as unknown as AdminFirestore;
const read = () => readDocumentRegistry(db(), COMPANY, NOW);
const rowOf = (rows: readonly RegistryRow[], id: string): RegistryDocumentRow | undefined =>
  rows.find((row): row is RegistryDocumentRow => row.kind === 'document' && row.document.id === id);
const ids = (rows: readonly RegistryRow[]): string[] => rows.map(registryRowIdOf);
const documentsOnly = (rows: readonly RegistryRow[]): RegistryDocumentRow[] =>
  rows.filter((row): row is RegistryDocumentRow => row.kind === 'document');

beforeEach(() => {
  fake = new FakeFirestore();
});

describe('εμβέλεια εταιρείας', () => {
  it('τα έγγραφα, οι δηλώσεις και οι υποθέσεις ξένης εταιρείας δεν φτάνουν ποτέ', async () => {
    fake.seed(COLLECTIONS.FILES, 'file_x', file({ companyId: OTHER }));
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_x', property({ companyId: OTHER }));
    fake.seed(COLLECTIONS.CONVEYANCE_CASES, 'case_x', openCase({ id: 'case_x', companyId: OTHER }));
    const registry = await read();
    expect(registry.rows).toEqual([]);
    expect(registry.properties).toEqual({});
  });

  it('μετρήσεις με ΟΛΕΣ τις καταστάσεις, και τις μηδενικές', async () => {
    const registry = await read();
    expect(Object.keys(registry.tally).sort()).toEqual([...REGISTRY_ROW_STATES].sort());
    expect(registry.truncated).toBe(false);
  });

  it('αρχείο που δείχνει ακίνητο ξένης εταιρείας ⇒ καμία σύνδεση, κανένα όνομα', async () => {
    fake.seed(COLLECTIONS.FILES, 'file_1', file({ entityId: 'prop_x' }));
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_x', property({ companyId: OTHER, name: 'Ξένο' }));
    const registry = await read();
    expect(rowOf(registry.rows, 'file:file_1')?.document.propertyId).toBeNull();
    expect(registry.properties).toEqual({});
  });
});

describe('γραμμές — αρχεία και δηλώσεις (Ε1)', () => {
  it('αρχείο-πηγή ⇒ μία γραμμή, `pinned`, χωρίς δεύτερη γραμμή δήλωσης', async () => {
    fake.seed(COLLECTIONS.FILES, 'file_1', file());
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', property({}, { sourceFileId: 'file_1' }));
    const registry = await read();
    expect(ids(registry.rows)).toEqual(['file:file_1']);
    expect(rowOf(registry.rows, 'file:file_1')?.document).toMatchObject({ propertyId: 'prop_1', pinned: true });
    expect(registry.rows[0].state).toBe('expiring');
    expect(registry.files).toEqual({ file_1: { name: 'ΠΕΑ Α1.pdf', storagePath: null } });
    expect(registry.properties).toEqual({ prop_1: { name: 'Διαμέρισμα Α1', scope: 'property', areaId: null, ownerContactIds: [], obligorLead: null, ownerShares: {}, propertyClass: null } });
  });

  it('δήλωση χωρίς αρχείο ⇒ γραμμή `declared`, χωρίς πηγή', async () => {
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', property());
    const [row] = documentsOnly((await read()).rows);
    expect(row.document).toMatchObject({ id: 'declared:prop_1:energy-certificate', origin: { kind: 'declared' }, source: null });
  });

  it('Δ1 — κλάση χωρίς ημερομηνία ⇒ γραμμή `expiry-unknown`, ποτέ σιωπή', async () => {
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', property({}, { issuedOn: null }));
    const [row] = (await read()).rows;
    expect(row.state).toBe('expiry-unknown');
  });

  it('ακίνητο χωρίς κλάση ⇒ καμία γραμμή', async () => {
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', { companyId: COMPANY, name: 'Χωρίς ΠΕΑ', energy: { absence: 'pending' } });
    expect((await read()).rows).toEqual([]);
  });

  it('αρχείο-πηγή στον κάδο ⇒ το αρχείο έξω, η δήλωση ΜΕΝΕΙ (δεν εξαφανίζεται μαζί του)', async () => {
    fake.seed(COLLECTIONS.FILES, 'file_1', file({ isDeleted: true }));
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', property({}, { sourceFileId: 'file_1' }));
    expect(ids((await read()).rows)).toEqual(['declared:prop_1:energy-certificate']);
  });

  it('μη έτοιμο αρχείο · αλλοιωμένα γεγονότα ⇒ καμία γραμμή (ανεκτικός αναγνώστης)', async () => {
    fake.seed(COLLECTIONS.FILES, 'file_a', file({ status: 'pending' }));
    fake.seed(COLLECTIONS.FILES, 'file_b', file({ documentFacts: facts({ source: { kind: 'guess' } }) }));
    expect((await read()).rows).toEqual([]);
  });

  it('αρχείο επιπέδου έργου χωρίς έγκριση σε υπόθεση ⇒ γραμμή χωρίς ακίνητο και χωρίς «τι σταματά»', async () => {
    fake.seed(COLLECTIONS.FILES, 'file_1', file({ entityType: ENTITY_TYPES.PROJECT, entityId: 'proj_1' }));
    const [row] = documentsOnly((await read()).rows);
    expect(row.document.propertyId).toBeNull();
    expect(row.dependents).toEqual([]);
  });

  it('καμία ταυτότητα ανθρώπου στην απόκριση (`recordedBy` / `recordedAt`)', async () => {
    fake.seed(COLLECTIONS.FILES, 'file_1', file());
    expect(JSON.stringify(await read())).not.toMatch(/recordedBy|recordedAt|system:pea-import/);
  });
});

describe('«τι σταματά» — απαιτήσεις από υποθέσεις και αγγελίες', () => {
  beforeEach(() => {
    fake.seed(COLLECTIONS.FILES, 'file_1', file());
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', property({}, { sourceFileId: 'file_1' }));
  });

  /** Η γραμμή του ΠΕΑ — η υπόθεση γεννά ΚΑΙ κενό ταυτότητας κτιρίου (Φ4δ), άρα όχι `rows[0]`. */
  const peaRow = async () => rowOf((await read()).rows, 'file:file_1') as RegistryDocumentRow;
  const processes = async () => (await peaRow()).dependents.map((dependent) => dependent.requirement.process);

  it('ανοιχτή υπόθεση με υπογραφή μετά τη λήξη ⇒ η υπογραφή σταματά, και μπλοκάρει', async () => {
    fake.seed(COLLECTIONS.CONVEYANCE_CASES, 'case_1', openCase());
    const row = await peaRow();
    expect(row.dependents.map((dependent) => dependent.requirement.process)).toEqual([{ kind: 'conveyance', caseId: 'case_1' }]);
    expect(row.blocking).toBe(true);
  });

  it('γραμμή «δεν εφαρμόζεται» ⇒ καμία απαίτηση', async () => {
    const notApplicable = { reason: 'Συνθετικό', markedBy: 'user_1', markedAt: '2026-10-02T00:00:00.000Z' };
    fake.seed(COLLECTIONS.CONVEYANCE_CASES, 'case_1', openCase({ overrides: { energy_certificate: { notApplicable } } }));
    expect(await processes()).toEqual([]);
  });

  it('υπογεγραμμένη (νομική φάση) · κλειστή · ξένη υπόθεση ⇒ καμία απαίτηση', async () => {
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', property({ commercial: { legalPhase: 'final_signed' } }, { sourceFileId: 'file_1' }));
    fake.seed(COLLECTIONS.CONVEYANCE_CASES, 'case_1', openCase());
    fake.seed(COLLECTIONS.CONVEYANCE_CASES, 'case_2', openCase({ id: 'case_2', storedState: 'closed' }));
    fake.seed(COLLECTIONS.CONVEYANCE_CASES, 'case_3', openCase({ id: 'case_3', companyId: OTHER }));
    expect(await processes()).toEqual([]);
  });

  it('δημοσιευμένη αγγελία ⇒ η δημοσίευση στο «τι σταματά» (`warn`, Α1)', async () => {
    fake.seed(COLLECTIONS.PUBLIC_LISTINGS, 'prop_1', { schemaVersion: PUBLIC_LISTING_SCHEMA_VERSION, offerKinds: ['sell'] });
    const row = await peaRow();
    expect(row.dependents.map((dependent) => [dependent.requirement.process, dependent.requirement.policy]))
      .toEqual([[{ kind: 'listing-publication', listingId: 'prop_1' }, 'warn']]);
    expect(row.blocking).toBe(false);
  });

  it('χωρίς αγγελία (αποσυρμένη = σβησμένη) ⇒ τίποτα', async () => {
    expect(await processes()).toEqual([]);
  });
});

// =============================================================================
// Φ4δ — ό,τι ΛΕΙΠΕΙ · εντολές (Ε10) · αγγελίες χωρίς έγγραφο (Ε11) · έγκριση (Ε8) · έργο (Ε9)
// =============================================================================

const listing = (over: Doc = {}): Doc => ({ schemaVersion: PUBLIC_LISTING_SCHEMA_VERSION, offerKinds: ['sell'], agencyId: COMPANY, ...over });
const owner = (over: Doc = {}): Doc => ({ authorUserId: 'user_9', authorCompanyId: COMPANY, title: 'Εντολή Β3', ...over });
const gap = (rows: readonly RegistryRow[], propertyId: string, kind = 'energy-certificate') =>
  rows.find((row) => row.kind === 'gap' && row.gap.propertyId === propertyId && row.gap.kind === kind);
const accepted = (fileId: string | null, issuedOn: string | null) =>
  ({ review: { verdict: 'accepted', fileId, fileFingerprint: null, issuedOn, printedValidUntil: null, reason: null, reviewedBy: 'user_2', reviewedAt: '2026-10-05T00:00:00.000Z' } });

describe('Φ4δ Ε7 — «λείπει» από τις απαιτήσεις', () => {
  it('ανοιχτή υπόθεση σε ακίνητο ΧΩΡΙΣ κανένα ΠΕΑ ⇒ κενό που μπλοκάρει (και ταυτότητας κτιρίου)', async () => {
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', { companyId: COMPANY, name: 'Χωρίς ΠΕΑ' });
    fake.seed(COLLECTIONS.CONVEYANCE_CASES, 'case_1', openCase());
    const registry = await read();
    expect(gap(registry.rows, 'prop_1')).toMatchObject({ state: 'missing', blocking: true });
    expect(gap(registry.rows, 'prop_1', 'building-identity')).toBeDefined();
    // ADR-915 §14 · §22: ο πωλητής εδώ είναι ΦΥΣΙΚΟ πρόσωπο ⇒ ΕΝΦΙΑ + φορολογική «λείπουν»· η ΕΦΚΑ εξαρτάται από την
    // απάντηση «είναι ή ήταν υπόχρεος;» ⇒ παρακολουθείται, ΟΧΙ «λείπει». (Πριν την §22 το προφίλ «νεόδμητο» έκανε κάθε
    // πωλητή νομικό πρόσωπο, και το μητρώο ισχυριζόταν έλλειψη ΕΦΚΑ για ιδιώτη.)
    expect(registry.rows.flatMap((row) => (row.kind === 'gap' ? [row.gap.kind] : []))).toEqual([
      'building-identity', 'energy-certificate', 'enfia-certificate', 'tax-clearance',
    ]);
    expect(registry.tally.missing).toBe(4);
    expect(registry.properties.prop_1).toEqual({ name: 'Χωρίς ΠΕΑ', scope: 'property', areaId: null, ownerContactIds: [], obligorLead: null, ownerShares: {}, propertyClass: null });
  });

  it('ADR-915 §22 — πωλητής ΝΟΜΙΚΟ πρόσωπο ⇒ και η ΕΦΚΑ λείπει (από τον νόμο, χωρίς ερώτηση)', async () => {
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', { companyId: COMPANY, name: 'Εταιρικός πωλητής' });
    fake.seed(COLLECTIONS.CONVEYANCE_CASES, 'case_1', openCase({ parties: { sellers: [{ key: 'cont_co', contactId: 'cont_co', kind: 'legal_entity', capacity: 'principal' }], buyers: [] } }));
    const registry = await read();
    expect(registry.rows.flatMap((row) => (row.kind === 'gap' ? [row.gap.kind] : []))).toContain('insurance-clearance');
    expect(registry.tally.missing).toBe(5);
  });

  it('αγγελία με το όνομα του γραφείου σε ακίνητο ΧΩΡΙΣ κανένα έγγραφο ⇒ βρίσκεται, και λείπει το ΠΕΑ (`warn`)', async () => {
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', { companyId: COMPANY, name: 'Δημοσιευμένο' });
    fake.seed(COLLECTIONS.PUBLIC_LISTINGS, 'prop_1', listing());
    const registry = await read();
    expect(ids(registry.rows)).toEqual(['missing:prop_1:energy-certificate']);
    expect(registry.rows[0]).toMatchObject({ blocking: false });
    expect(registry.unscopedListings).toBe(0);
  });

  it('η ταυτότητα κτιρίου ΔΕΝ «λείπει» από αγγελία — ο νόμος δεν τη ζητά εκεί', async () => {
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', property());
    fake.seed(COLLECTIONS.PUBLIC_LISTINGS, 'prop_1', listing());
    expect((await read()).rows.some((row) => row.kind === 'gap')).toBe(false);
  });
});

describe('Φ4δ Ε10 — ακίνητα ιδιωτών υπό θεματοφυλακή του γραφείου', () => {
  it('δηλωμένο ΠΕΑ εντολής ⇒ γραμμή, με όνομα και είδος «εντολή»', async () => {
    fake.seed(COLLECTIONS.OWNER_PROPERTIES, 'ownp_1', owner({ energy: { class: 'C', issuedOn: ISSUED } }));
    const registry = await read();
    expect(ids(registry.rows)).toEqual(['declared:ownp_1:energy-certificate']);
    expect(registry.properties).toEqual({ ownp_1: { name: 'Εντολή Β3', scope: 'owner-property', areaId: null, ownerContactIds: [], obligorLead: null, ownerShares: {}, propertyClass: null } });
  });

  it('αγγελία εντολής χωρίς ΠΕΑ ⇒ κενό στην εντολή', async () => {
    fake.seed(COLLECTIONS.OWNER_PROPERTIES, 'ownp_1', owner());
    fake.seed(COLLECTIONS.PUBLIC_LISTINGS, 'ownp_1', listing({ agencyId: null }));
    expect(ids((await read()).rows)).toEqual(['missing:ownp_1:energy-certificate']);
  });

  it('εντολή ΑΛΛΟΥ γραφείου ή ιδιώτη χωρίς γραφείο ⇒ ποτέ μέσα· η αγγελία με το όνομά μας ΜΕΤΡΙΕΤΑΙ', async () => {
    fake.seed(COLLECTIONS.OWNER_PROPERTIES, 'ownp_x', owner({ authorCompanyId: OTHER, energy: { class: 'C', issuedOn: ISSUED } }));
    fake.seed(COLLECTIONS.OWNER_PROPERTIES, 'ownp_y', owner({ authorCompanyId: null, energy: { class: 'C', issuedOn: ISSUED } }));
    fake.seed(COLLECTIONS.PUBLIC_LISTINGS, 'ownp_x', listing());
    const registry = await read();
    expect(registry.rows).toEqual([]);
    expect(registry.properties).toEqual({});
    expect(registry.unscopedListings).toBe(1);
  });
});

describe('Φ4δ Ε8 · Ε9 — η έγκριση του επαγγελματία', () => {
  it('ταυτότητα κτιρίου εγκεκριμένη εκτός πλατφόρμας ⇒ γραμμή `attested`, κανένα κενό ταυτότητας', async () => {
    fake.seed(COLLECTIONS.FILES, 'file_1', file());
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', property({}, { sourceFileId: 'file_1' }));
    fake.seed(COLLECTIONS.CONVEYANCE_CASES, 'case_1', openCase({ overrides: { building_identity: accepted(null, '2026-09-20') } }));
    const registry = await read();
    expect(gap(registry.rows, 'prop_1', 'building-identity')).toBeUndefined();
    expect(rowOf(registry.rows, 'attested:case_1:building-identity')?.document.origin).toEqual({ kind: 'attested', caseId: 'case_1', fileId: null });
  });

  it('Δ3 — ΠΕΑ έργου εγκεκριμένο στην υπόθεση ⇒ η γραμμή του έργου κρατά την υπόθεση, το ακίνητο δεν «λείπει»', async () => {
    fake.seed(COLLECTIONS.FILES, 'file_p', file({ entityType: ENTITY_TYPES.PROJECT, entityId: 'proj_1' }));
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', { companyId: COMPANY, name: 'Χωρίς δικό του ΠΕΑ' });
    fake.seed(COLLECTIONS.CONVEYANCE_CASES, 'case_1', openCase({ overrides: { energy_certificate: accepted('file_p', ISSUED) } }));
    const registry = await read();
    expect(gap(registry.rows, 'prop_1')).toBeUndefined();
    expect(rowOf(registry.rows, 'file:file_p')?.dependents.map((d) => d.requirement.process)).toEqual([{ kind: 'conveyance', caseId: 'case_1' }]);
  });
});

describe('όρια που ΛΕΓΟΝΤΑΙ', () => {
  it('αρχεία πάνω από το όριο ⇒ `truncated` + η πηγή ονομάζεται', async () => {
    for (let index = 0; index <= DOCUMENT_REGISTRY_CAPS.files; index += 1) {
      fake.seed(COLLECTIONS.FILES, `file_${String(index).padStart(4, '0')}`, file({ entityType: ENTITY_TYPES.PROJECT, entityId: 'proj_1' }));
    }
    const registry = await read();
    expect(registry.truncated).toBe(true);
    expect(registry.truncatedSources).toEqual(['files']);
    expect(registry.rows).toHaveLength(DOCUMENT_REGISTRY_CAPS.files);
  });
});

describe('ρολόι', () => {
  it('μία «σήμερα» της Ελλάδας και η στιγμή που αλλάζει', async () => {
    const registry = await read();
    expect(registry.asOf).toBe('2026-10-15');
    expect(registry.freshUntil).toBe('2026-10-15T21:00:00.000Z');
  });
});

describe('ADR-915 §25 — «Το φέρνει»: ΠΟΙΟΣ είναι ο ιδιοκτήτης, και πώς λέγεται (ζωντανά)', () => {
  const person = (firstName: string, over: Doc = {}): Doc => ({ companyId: COMPANY, type: 'individual', firstName, lastName: 'Συνθετικός', ...over });
  const mandate = (clientContactId: string): Doc => ({ kind: 'brokered', clientContactId, confirmation: 'confirmed', confirmedByUserId: null });

  it('εντολή ⇒ οι πελάτες των εντολών, χωρίς διπλά· ΞΕΝΗ επαφή ⇒ καμία λέξη γι αυτήν', async () => {
    fake.seed(COLLECTIONS.OWNER_PROPERTIES, 'ownp_1', owner({
      energy: { class: 'C', issuedOn: ISSUED }, mandates: [mandate('cont_a'), mandate('cont_a'), mandate('cont_x')],
    }));
    fake.seed(COLLECTIONS.CONTACTS, 'cont_a', person('Άλφα'));
    fake.seed(COLLECTIONS.CONTACTS, 'cont_x', person('Ξένος', { companyId: OTHER }));
    const registry = await read();
    expect(registry.properties.ownp_1.ownerContactIds).toEqual(['cont_a', 'cont_x']);
    expect(registry.people).toEqual({ cont_a: { name: 'Άλφα Συνθετικός' } });
  });

  it('ακίνητο ΧΩΡΙΣ τρέχουσα γραμμή ⇒ «δεν ρωτήθηκε» (`null`, όχι «κανείς»), και καμία επαφή δεν διαβάζεται', async () => {
    fake.seed(COLLECTIONS.OWNER_PROPERTIES, 'ownp_1', owner({ mandates: [mandate('cont_a')] }));
    fake.seed(COLLECTIONS.CONTACTS, 'cont_a', person('Άλφα'));
    const registry = await read();
    expect(registry.rows).toEqual([]);
    expect(registry.properties.ownp_1.ownerContactIds).toBeNull();
    expect(registry.people).toEqual({});
  });

  it('ακίνητο εταιρείας χωρίς υπόθεση ⇒ η νομική οντότητα του έργου (`linkedCompanyId`)', async () => {
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', property({ projectId: 'proj_1' }));
    fake.seed(COLLECTIONS.PROJECTS, 'proj_1', { companyId: COMPANY, linkedCompanyId: 'cont_co' });
    fake.seed(COLLECTIONS.CONTACTS, 'cont_co', { companyId: COMPANY, type: 'company', companyName: 'Συνθετική ΑΕ' });
    const registry = await read();
    expect(registry.properties.prop_1.ownerContactIds).toEqual(['cont_co']);
    expect(registry.people).toEqual({ cont_co: { name: 'Συνθετική ΑΕ' } });
  });

  it('έργο ΞΕΝΗΣ εταιρείας ⇒ η εταιρεία του δεν διαβάζεται ως ιδιοκτήτης', async () => {
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', property({ projectId: 'proj_x' }));
    fake.seed(COLLECTIONS.PROJECTS, 'proj_x', { companyId: OTHER, linkedCompanyId: 'cont_co' });
    expect((await read()).properties.prop_1.ownerContactIds).toEqual([]);
  });

  it('ανοιχτή υπόθεση ⇒ ο μεταβιβάζων της υπόθεσης, όχι η εταιρεία του έργου', async () => {
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', property({ projectId: 'proj_1' }));
    fake.seed(COLLECTIONS.PROJECTS, 'proj_1', { companyId: COMPANY, linkedCompanyId: 'cont_co' });
    fake.seed(COLLECTIONS.CONVEYANCE_CASES, 'case_1', openCase({ parties: { seller: { contactId: 'cont_s', kind: 'person' }, buyers: [] } }));
    fake.seed(COLLECTIONS.CONTACTS, 'cont_s', person('Σίγμα'));
    const registry = await read();
    expect(registry.properties.prop_1.ownerContactIds).toEqual(['cont_s']);
    expect(registry.people).toEqual({ cont_s: { name: 'Σίγμα Συνθετικός' } });
  });

  it('μετά το οριστικό ⇒ οι αγοραστές (`commercial.owners`)· πριν από αυτό ⇒ ΟΧΙ', async () => {
    const commercial = (legalPhase: string) => ({ legalPhase, owners: [{ contactId: 'cont_b', ownershipPct: 100 }] });
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', property({ commercial: commercial('final_signed') }));
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_2', property({ name: 'Β', commercial: commercial('preliminary_signed') }));
    const registry = await read();
    expect(registry.properties.prop_1.ownerContactIds).toEqual(['cont_b']);
    expect(registry.properties.prop_2.ownerContactIds).toEqual([]);
  });
});

describe('ADR-915 §25 (5γ) — μία γραμμή ανά ΠΡΟΣΩΠΟ, με το όνομά του', () => {
  const seller = (contactId: string, capacity: string) => ({ key: contactId, contactId, kind: 'person', capacity });
  const person = (firstName: string): Doc => ({ companyId: COMPANY, type: 'individual', firstName, lastName: 'Συνθετικός' });

  it('δύο συμπωλητές ⇒ ΔΥΟ κενά φορολογικής και ΔΥΟ ΕΝΦΙΑ, και τα δύο ονόματα στο `people`', async () => {
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', { companyId: COMPANY, name: 'Με δύο πωλητές' });
    fake.seed(COLLECTIONS.CONVEYANCE_CASES, 'case_1', openCase({
      parties: { sellers: [seller('cont_a', 'principal'), seller('cont_b', 'other')], buyers: [] },
    }));
    fake.seed(COLLECTIONS.CONTACTS, 'cont_a', person('Άλφα'));
    fake.seed(COLLECTIONS.CONTACTS, 'cont_b', person('Βήτα'));
    const registry = await read();
    const gapIds = registry.rows.filter((row) => row.kind === 'gap').map(registryRowIdOf);
    expect(gapIds).toEqual(expect.arrayContaining([
      'missing:prop_1:tax-clearance@cont_a', 'missing:prop_1:tax-clearance@cont_b',
      'missing:prop_1:enfia-certificate@cont_a', 'missing:prop_1:enfia-certificate@cont_b',
    ]));
    // Το ΠΕΑ είναι του ΑΚΙΝΗΤΟΥ: ένα κενό, χωρίς πρόσωπο.
    expect(gapIds.filter((id) => id.startsWith('missing:prop_1:energy-certificate'))).toEqual(['missing:prop_1:energy-certificate']);
    expect(registry.people).toEqual({ cont_a: { name: 'Άλφα Συνθετικός' }, cont_b: { name: 'Βήτα Συνθετικός' } });
  });

  it('αρχείο στην κάρτα ΕΠΑΦΗΣ ⇒ έγγραφο αυτού του προσώπου (χωρίς ακίνητο)', async () => {
    fake.seed(COLLECTIONS.FILES, 'file_c', file({ entityType: ENTITY_TYPES.CONTACT, entityId: 'cont_a' }));
    fake.seed(COLLECTIONS.CONTACTS, 'cont_a', person('Άλφα'));
    const registry = await read();
    expect(rowOf(registry.rows, 'file:file_c')?.document).toMatchObject({ propertyId: null, party: { key: 'cont_a', contactId: 'cont_a' } });
    expect(registry.people).toEqual({ cont_a: { name: 'Άλφα Συνθετικός' } });
  });
});

describe('ADR-915 §26 — ΕΝΑΣ υπεύθυνος για τα έγγραφα ακινήτου με πολλούς ιδιοκτήτες', () => {
  const person = (firstName: string): Doc => ({ companyId: COMPANY, type: 'individual', firstName, lastName: 'Συνθετικός' });
  const buyers = (shares: Record<string, number>) => ({
    legalPhase: 'final_signed', owners: Object.entries(shares).map(([contactId, ownershipPct]) => ({ contactId, ownershipPct })),
  });
  const designate = (contactId: string, companyId = COMPANY) => fake.seed(COLLECTIONS.DOCUMENT_OBLIGOR_DESIGNATIONS, obligorDesignationIdOf(COMPANY, 'prop_1'), {
    id: obligorDesignationIdOf(COMPANY, 'prop_1'), companyId, propertyId: 'prop_1', scope: 'property', contactId,
    designatedByUid: 'user_1', designatedAt: '2026-10-17T09:00:00.000Z',
  });

  beforeEach(() => {
    ['cont_a', 'cont_b', 'cont_sold'].forEach((id, i) => fake.seed(COLLECTIONS.CONTACTS, id, person(['Άλφα', 'Βήτα', 'Πωλημένος'][i])));
  });

  it('αγοραστές 60/40 ⇒ ο υπεύθυνος είναι ο 60% (ΑΚ 789), και τα μερίδια ταξιδεύουν για τον διάλογο', async () => {
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', property({ commercial: buyers({ cont_b: 40, cont_a: 60 }) }));
    const label = (await read()).properties.prop_1;
    expect(label.obligorLead).toEqual({ kind: 'designated', contactId: 'cont_a', basis: 'majority-share', sharePct: 60, staleContactId: null });
    expect(label.ownerShares).toEqual({ cont_b: 40, cont_a: 60 });
  });

  it('ρητή επιλογή του γραφείου ΝΙΚΑ την πλειοψηφία', async () => {
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', property({ commercial: buyers({ cont_a: 60, cont_b: 40 }) }));
    designate('cont_b');
    expect((await read()).properties.prop_1.obligorLead).toMatchObject({ contactId: 'cont_b', basis: 'explicit' });
  });

  it('ρητή επιλογή ΠΡΩΗΝ ιδιοκτήτη ⇒ δεν μετρά, ΛΕΓΕΤΑΙ, και ονομάζεται', async () => {
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', property({ commercial: buyers({ cont_a: 50, cont_b: 50 }) }));
    designate('cont_sold');
    const registry = await read();
    expect(registry.properties.prop_1.obligorLead).toEqual({ kind: 'undesignated', reason: 'no-majority', staleContactId: 'cont_sold' });
    expect(registry.people.cont_sold).toEqual({ name: 'Πωλημένος Συνθετικός' });
  });

  it('ορισμός με ΞΕΝΟ `companyId` ⇒ ανύπαρκτος', async () => {
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', property({ commercial: buyers({ cont_a: 60, cont_b: 40 }) }));
    designate('cont_b', OTHER);
    expect((await read()).properties.prop_1.obligorLead).toMatchObject({ contactId: 'cont_a', basis: 'majority-share' });
  });

  it('ανοιχτή υπόθεση: εργολάβος + οικοπεδούχος ⇒ ο ΚΥΡΙΟΣ μεταβιβάζων, χωρίς μερίδια', async () => {
    const seller = (contactId: string, capacity: string) => ({ key: contactId, contactId, kind: 'person', capacity });
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', { companyId: COMPANY, name: 'Αντιπαροχή' });
    fake.seed(COLLECTIONS.CONVEYANCE_CASES, 'case_1', openCase({
      parties: { sellers: [seller('cont_b', 'landowner'), seller('cont_a', 'principal')], buyers: [] },
    }));
    const label = (await read()).properties.prop_1;
    expect(label.obligorLead).toMatchObject({ kind: 'designated', contactId: 'cont_a', basis: 'contract-principal' });
    expect(label.ownerShares).toEqual({});
  });

  it('🔴 μερίδια ΜΕΛΛΟΝΤΙΚΩΝ αγοραστών (προσύμφωνο) ΔΕΝ κρίνουν τους μεταβιβάζοντες — ούτε φαίνονται δίπλα τους', async () => {
    const seller = (contactId: string, capacity: string) => ({ key: contactId, contactId, kind: 'person', capacity });
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', property({
      commercial: { legalPhase: 'preliminary_signed', owners: [{ contactId: 'cont_a', ownershipPct: 70 }, { contactId: 'cont_b', ownershipPct: 30 }] },
    }));
    fake.seed(COLLECTIONS.CONVEYANCE_CASES, 'case_1', openCase({
      parties: { sellers: [seller('cont_a', 'landowner'), seller('cont_b', 'other')], buyers: [] },
    }));
    const label = (await read()).properties.prop_1;
    expect(label.ownerContactIds).toEqual(['cont_a', 'cont_b']);
    expect(label.obligorLead).toEqual({ kind: 'undesignated', reason: 'unknown-shares', staleContactId: null });
    expect(label.ownerShares).toEqual({});
  });
});

describe('ADR-915 §33 — αρχεία ΧΩΡΙΣ στοιχεία σε θέση που υπόσχεται είδος', () => {
  /** Ανεβασμένη ΥΔΕ στο ακίνητο — χωρίς αναγνώστη κειμένου (§32 Υ10) ⇒ κανένα γεγονός. */
  const yde = (over: Doc = {}): Doc =>
    file({ purpose: 'yde-declaration', displayName: 'ΥΔΕ Α1.pdf', storagePath: 'companies/comp_alfa/yde-a1.pdf', documentFacts: undefined, ...over });

  it('ΥΔΕ ακινήτου χωρίς γεγονότα ⇒ γραμμή `expiry-unknown`, χωρίς πηγή, με το αντικείμενο για το CAS', async () => {
    fake.seed(COLLECTIONS.FILES, 'file_y', yde());
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', { companyId: COMPANY, name: 'Διαμέρισμα Α1', type: 'apartment' });
    const registry = await read();
    expect(ids(registry.rows)).toEqual(['file:file_y']);
    expect(rowOf(registry.rows, 'file:file_y')?.document).toMatchObject({ kind: 'electrical-installation', propertyId: 'prop_1', source: null });
    expect(registry.rows[0].state).toBe('expiry-unknown');
    expect(registry.files.file_y).toEqual({ name: 'ΥΔΕ Α1.pdf', storagePath: 'companies/comp_alfa/yde-a1.pdf' });
    expect(registry.properties.prop_1.propertyClass).toBe('residential');
  });

  it('⛔ ξένη εταιρεία · κάδος · ΥΔΕ στην ΕΠΑΦΗ (αρχείο του ηλεκτρολόγου) ⇒ καμία γραμμή', async () => {
    fake.seed(COLLECTIONS.FILES, 'file_x', yde({ companyId: OTHER }));
    fake.seed(COLLECTIONS.FILES, 'file_d', yde({ isDeleted: true }));
    fake.seed(COLLECTIONS.FILES, 'file_c', yde({ entityType: ENTITY_TYPES.CONTACT, entityId: 'cont_e' }));
    expect((await read()).rows).toEqual([]);
  });

  it('⛔ γενική θέση «Πιστοποιητικό» χωρίς γεγονότα ⇒ ΚΑΜΙΑ γραμμή ΠΕΑ (φιλοξενεί, δεν υπόσχεται)', async () => {
    fake.seed(COLLECTIONS.FILES, 'file_g', file({ purpose: 'certificate', documentFacts: undefined }));
    expect((await read()).rows).toEqual([]);
  });

  it('ΥΔΕ που ΤΩΡΑ έχει γεγονότα ⇒ μία γραμμή (από τα γεγονότα), ποτέ και δεύτερη «χωρίς στοιχεία»', async () => {
    const declared = facts({ kind: 'electrical-installation', issuedOn: '2022-03-01', printedValidUntil: '2032-03-01', classification: 'A', source: { kind: 'attested', via: 'registry-declaration' } });
    fake.seed(COLLECTIONS.FILES, 'file_y', yde({ documentFacts: declared }));
    const registry = await read();
    expect(ids(registry.rows)).toEqual(['file:file_y']);
    expect(registry.rows[0].state).toBe('valid');
  });

  it('Δ5 — ΠΕΑ έργου χωρίς γεγονότα που ονομάζει η δήλωση του ακινήτου ⇒ υποχωρεί: μένει η δήλωση ΜΕ την ημερομηνία', async () => {
    fake.seed(COLLECTIONS.FILES, 'file_p', file({ entityType: ENTITY_TYPES.PROJECT, entityId: 'proj_1', purpose: 'study-energy-cert', documentFacts: undefined }));
    fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', property({}, { sourceFileId: 'file_p' }));
    const registry = await read();
    expect(ids(registry.rows)).toEqual(['declared:prop_1:energy-certificate']);
    expect(rowOf(registry.rows, 'declared:prop_1:energy-certificate')?.document.issuedOn).toBe(ISSUED);
  });

  it('όριο ⇒ `truncatedSources: [undeclared-files]` — ποτέ σιωπηλό', async () => {
    for (let index = 0; index <= DOCUMENT_REGISTRY_CAPS['undeclared-files']; index += 1) {
      fake.seed(COLLECTIONS.FILES, `file_${String(index).padStart(4, '0')}`, yde({ entityType: ENTITY_TYPES.CONTACT, entityId: 'cont_e' }));
    }
    const registry = await read();
    expect(registry.truncatedSources).toEqual(['undeclared-files']);
    expect(registry.rows).toEqual([]);
  });
});
