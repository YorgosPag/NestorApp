/**
 * Ο αγωγός εισαγωγής (ADR-923 §5.5.1) από άκρη σε άκρη, πάνω στους **πραγματικούς** γραφείς και στο επαληθευμένο ψεύτικο
 * Firestore. Το μοντέλο AI και τα bytes του PDF είναι ψεύτικα: καμία πληρωμένη κλήση.
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { AuthContext } from '@/lib/auth';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { MFP_ATTRIBUTES, MFP_SIZES } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil.fixture';
import { MFP_PAGE_60, MFP_SETTINGS } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil-products.fixture';
import type { CatalogPageInput, CatalogPageReading } from '@/subapps/catalog/import/page-analyzer';
import type { RawPageCell } from '@/subapps/catalog/import/page-extraction';
import { importTargetKey } from '@/subapps/catalog/import/proposal-values';
import type { ExtractedCell, ExtractedGroup, ExtractedRow, ImportProposalDefinition, ImportProposalRow } from '@/subapps/catalog/types/catalog-import';
import type { CreateImportBatchRequest } from '@/subapps/catalog/types/catalog-import-requests';
import { ANY_SLOT, type CatalogProductDefinition } from '@/subapps/catalog/types/product';
import { ARIES, MFP_GROUP_CODES, RIVAL, mfpFamilyWith, rejectionOf } from './catalog-writer-seed';

const fake = new FakeFirestore();
const readPage = jest.fn<Promise<CatalogPageReading>, [CatalogPageInput]>();
const pricingAllowed = jest.fn(async () => true);

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: (): Firestore => fake as unknown as Firestore }));
jest.mock('@/services/entity-audit-tracked-write', () => ({ recordTrackedEntityWrite: async () => undefined }));
jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), hasPermission: () => pricingAllowed() }));
jest.mock('../import-page-analyzer.server', () => ({ createCatalogPageAnalyzer: () => ({ readPage }) }));
jest.mock('@/services/pdf/pdf-rasterize.service', () => ({
  countPdfPages: async () => 100,
  readPdfPage: async () => ({ png: Buffer.from('png'), pageCount: 100, items: [] }),
}));
jest.mock('../import-source.server', () => ({
  ...jest.requireActual('../import-source.server'),
  readBatchFileRecord: async () => ({}),
  downloadBatchFile: async () => Buffer.from('bytes'),
}));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι γραφείς */
import { createCatalogAttributeGroup } from '../attribute-group-writer.server';
import { createCatalogAttribute } from '../attribute-writer.server';
import { saveCatalogSettings } from '../catalog-settings-writer.server';
import { createCatalogFamily } from '../family-writer.server';
import { applyImportProposal } from '../import-apply.server';
import { createImportBatch } from '../import-batch-writer.server';
import { readImportPage } from '../import-readers.server';
import { proposeGroup, rejectImportProposal, updateImportProposal, type StoredImportProposal } from '../import-proposal-writer.server';
import { readImportBatchDetail } from '../import-reads.server';
import { updateCatalogProduct } from '../product-writer.server';
/* eslint-enable import/first */

interface Seeded {
  readonly ids: ReadonlyMap<string, string>;
  readonly familyId: string;
  readonly codeId: string;
}

let seeded: Seeded;
const SHA = 'a'.repeat(64);

async function seedSchema(): Promise<Seeded> {
  const ids = new Map<string, string>();
  const groups = new Map<string, string>();
  for (const code of MFP_GROUP_CODES) groups.set(code, (await createCatalogAttributeGroup(ARIES, { code, labels: { el: code }, orderKey: 'a0' })).id);
  for (const attribute of MFP_ATTRIBUTES) ids.set(attribute.code, (await createCatalogAttribute(ARIES, { ...attribute, groupId: groups.get(attribute.groupId) ?? '' })).id);
  const family = await createCatalogFamily(ARIES, mfpFamilyWith(ids));
  await saveCatalogSettings(ARIES, 0, MFP_SETTINGS);
  return { ids, familyId: family.id, codeId: ids.get('model_code') ?? '' };
}

const attributeId = (code: string): string => seeded.ids.get(code) ?? code;

const cell = (code: string, text: string | null, unitCode: string | null = null): ExtractedCell => ({
  target: { kind: 'attribute', attributeId: attributeId(code), channel: ANY_SLOT, locale: ANY_SLOT },
  text,
  confidence: 1,
  anchor: null,
  unitCode,
  flags: [],
});

const rowFor = (index: number, heating_h: number = MFP_PAGE_60.heating_h[index]): ExtractedRow => ({
  rowKey: `r${index}`,
  cells: [
    cell('size', MFP_SIZES[index]),
    cell('model_code', MFP_PAGE_60.code[index]),
    cell('cooling_h', String(MFP_PAGE_60.cooling_h[index]), 'W'),
    cell('cooling_m', String(MFP_PAGE_60.cooling_m[index]), 'W'),
    cell('heating_h', String(heating_h), 'W'),
    cell('heating_m', String(MFP_PAGE_60.heating_m[index]), 'W'),
    cell('heating_l', String(MFP_PAGE_60.heating_l[index]), 'W'),
  ],
});

const group = (rows: readonly ExtractedRow[], groupKey = 'model:mfp:0'): ExtractedGroup => ({ groupKey, modelCode: 'mfp', sharedCells: [], rows, pages: [] });

const attributesBatch = (overrides: Partial<CreateImportBatchRequest> = {}): CreateImportBatchRequest => ({
  sourceKind: 'spreadsheet',
  contentSha256: SHA,
  fileName: 'mfp.xlsx',
  sizeBytes: 100,
  target: { purpose: 'attributes', familyId: seeded.familyId, variantSchemeCode: 'by_size', categoryIds: [] },
  profileId: null,
  run: 0,
  pageRange: null,
  ...overrides,
});

const batchId = async (ctx: AuthContext = ARIES): Promise<string> => (await createImportBatch(ctx, attributesBatch())).id;
const proposals = () => Object.values(fake.getAllDocs('catalog_import_proposals')) as unknown as ImportProposalDefinition[];
const products = () => Object.values(fake.getAllDocs('catalog_products')) as unknown as (CatalogProductDefinition & { id: string; revision: number })[];
const fieldOf = (proposal: StoredImportProposal, rowKey: string, code: string) =>
  proposal.rows.find((row) => row.rowKey === rowKey)?.fields.find((field) => field.target.kind === 'attribute' && field.target.attributeId === attributeId(code));

beforeEach(async () => {
  fake.reset();
  readPage.mockReset();
  pricingAllowed.mockReset().mockResolvedValue(true);
  seeded = await seedSchema();
});

describe('ιδεμποτία παρτίδας', () => {
  it('ίδια είσοδος ⇒ η ίδια παρτίδα, χωρίς δεύτερο έγγραφο', async () => {
    const first = await createImportBatch(ARIES, attributesBatch());
    const second = await createImportBatch(ARIES, attributesBatch());
    expect(second.id).toBe(first.id);
    expect(second.revision).toBe(first.revision);
    expect(Object.keys(fake.getAllDocs('catalog_import_batches'))).toHaveLength(1);
  });

  it('ρητή επανεκτέλεση ⇒ νέα παρτίδα', async () => {
    expect((await createImportBatch(ARIES, attributesBatch({ run: 1 }))).id).not.toBe((await createImportBatch(ARIES, attributesBatch())).id);
  });

  it('δύο χώροι με το ίδιο αρχείο δεν μοιράζονται παρτίδα, ούτε βλέπουν ο ένας του άλλου', async () => {
    const id = await batchId();
    expect((await rejectionOf(readImportBatchDetail(RIVAL, id))).kind).toBe('notFound');
  });

  it('στόχος ξένης οικογένειας ≡ ανύπαρκτος', async () => {
    expect((await rejectionOf(createImportBatch(RIVAL, attributesBatch()))).kind).toBe('notFound');
  });
});

describe('πρόταση → έγκριση', () => {
  const faithful = () => MFP_SIZES.map((_, index) => rowFor(index));

  it('γράφει ΜΟΝΟ η έγκριση, μέσα από τον γραφέα, και η επανάληψη δεν ξαναγράφει', async () => {
    const proposal = await proposeGroup(ARIES, await batchId(), group(faithful()));
    expect(products()).toHaveLength(0);
    const applied = await applyImportProposal(ARIES, proposal.id, proposal.revision);
    expect(applied.status).toBe('applied');
    expect(products()).toHaveLength(7);
    expect(Object.keys(fake.getAllDocs('catalog_unique_values'))).toHaveLength(7);
    expect((await applyImportProposal(ARIES, proposal.id, proposal.revision)).revision).toBe(applied.revision);
    expect(products()).toHaveLength(7);
  });

  it('το ίδιο αρχείο μετά την έγκριση: όλα αμετάβλητα, ταιριάζουν με τον κωδικό παρά τις παύλες', async () => {
    const id = await batchId();
    const first = await proposeGroup(ARIES, id, group(faithful()));
    await applyImportProposal(ARIES, first.id, first.revision);
    const dashed = faithful().map((row) => ({ ...row, cells: row.cells.map((c) => (c.text?.startsWith('099-') ? { ...c, text: c.text.replace(/-/g, '–') } : c)) }));
    const again = await proposeGroup(ARIES, id, group(dashed, 'model:mfp:again'));
    const rows = again.rows.filter((row) => row.holderKind === 'product');
    expect(rows.every((row) => row.action === 'update')).toBe(true);
    expect(fieldOf(again, 'r0', 'heating_h')).toMatchObject({ status: 'unchanged', decision: 'reject' });
  });

  it('αντιστοίχιση μόνο με τον κωδικό, χωρίς άξονα στην πηγή: η κράτηση βρίσκει το SKU', async () => {
    const id = await batchId();
    const first = await proposeGroup(ARIES, id, group(faithful()));
    await applyImportProposal(ARIES, first.id, first.revision);
    const codeOnly: ExtractedRow = { rowKey: 'r0', cells: [cell('model_code', MFP_PAGE_60.code[0]), cell('heating_h', '2750', 'W')] };
    const again = await proposeGroup(ARIES, id, group([codeOnly], 'model:mfp:code-only'));
    expect(again.rows.find((row) => row.rowKey === 'r0')).toMatchObject({ action: 'update' });
    expect(fieldOf(again, 'r0', 'heating_h')).toMatchObject({ status: 'changed' });
  });

  it('πεδίο σε εκκρεμότητα εμποδίζει την έγκριση· η ρητή απόφαση την ανοίγει', async () => {
    const low: ExtractedRow[] = faithful().map((row) => ({ ...row, cells: row.cells.map((c) => (c.target.kind === 'attribute' && c.target.attributeId === attributeId('heating_l') ? { ...c, confidence: 0.5 } : c)) }));
    const proposal = await proposeGroup(ARIES, await batchId(), group(low));
    expect((await rejectionOf(applyImportProposal(ARIES, proposal.id, proposal.revision))).kind).toBe('confirmationRequired');
    expect(products()).toHaveLength(0);
    const targetKey = importTargetKey({ kind: 'attribute', attributeId: attributeId('heating_l'), channel: ANY_SLOT, locale: ANY_SLOT });
    const decided = await updateImportProposal(ARIES, proposal.id, {
      expectedRevision: proposal.revision,
      decisions: MFP_SIZES.map((_, index) => ({ rowKey: `r${index}`, targetKey, decision: 'accept' as const })),
      edits: [],
      modelCode: null,
    });
    expect((await applyImportProposal(ARIES, decided.id, decided.revision)).status).toBe('applied');
    expect(products()).toHaveLength(7);
  });

  it('διόρθωση ανθρώπου: ξανακρίνεται από τον ίδιο αγωγό και το εύρημα σβήνει', async () => {
    const rows = [...faithful().slice(1), rowFor(0, 1000)];
    const proposal = await proposeGroup(ARIES, await batchId(), group(rows));
    expect(proposal.violations.some((violation) => violation.ruleId === 'rule_heat_hml')).toBe(true);
    const targetKey = importTargetKey({ kind: 'attribute', attributeId: attributeId('heating_h'), channel: ANY_SLOT, locale: ANY_SLOT });
    const fixed = await updateImportProposal(ARIES, proposal.id, { expectedRevision: proposal.revision, decisions: [], edits: [{ rowKey: 'r0', targetKey, text: String(MFP_PAGE_60.heating_h[0]) }], modelCode: null });
    expect(fixed.violations.some((violation) => violation.ruleId === 'rule_heat_hml')).toBe(false);
    expect(fieldOf(fixed, 'r0', 'heating_h')).toMatchObject({ confidence: 1 });
  });

  it('τα ζωντανά άλλαξαν αφότου τα είδε ο άνθρωπος ⇒ 409, τίποτα δεν γράφεται', async () => {
    const id = await batchId();
    const first = await proposeGroup(ARIES, id, group(faithful()));
    await applyImportProposal(ARIES, first.id, first.revision);
    const second = await proposeGroup(ARIES, id, group([rowFor(0, 9999)], 'model:mfp:2'));
    const target = products().find((product) => product.id === second.rows.find((row) => row.rowKey === 'r0')?.holderId);
    if (!target) throw new Error('no match');
    await updateCatalogProduct(ARIES, target.id, target.revision, { modelId: target.modelId, familyId: target.familyId, categoryIds: target.categoryIds, noValueReasons: target.noValueReasons, values: target.values });
    expect((await rejectionOf(applyImportProposal(ARIES, second.id, second.revision))).kind).toBe('revisionMismatch');
    expect(proposals().find((proposal) => proposal.groupKey === 'model:mfp:2')?.status).toBe('pending');
  });

  it('τρία σημεία: χέρι ανθρώπου + ίδια πηγή ⇒ μένει η δουλειά του · χέρι + άλλη πηγή ⇒ σύγκρουση', async () => {
    const id = await batchId();
    const first = await proposeGroup(ARIES, id, group(faithful()));
    const applied = await applyImportProposal(ARIES, first.id, first.revision);
    const holderId = (applied.rows.find((row: ImportProposalRow) => row.rowKey === 'r0') as ImportProposalRow).holderId;
    const target = products().find((product) => product.id === holderId);
    if (!target) throw new Error('no holder');
    const heating = attributeId('heating_h');
    await updateCatalogProduct(ARIES, target.id, target.revision, { modelId: target.modelId, familyId: target.familyId, categoryIds: target.categoryIds, noValueReasons: target.noValueReasons, values: { ...target.values, [heating]: { '*': { '*': { type: 'measurement', amount: '2750', unitCode: 'W' } } } } });
    const same = await proposeGroup(ARIES, id, group([rowFor(0)], 'model:mfp:same'));
    expect(fieldOf(same, 'r0', 'heating_h')).toMatchObject({ status: 'unchanged', decision: 'reject' });
    const other = await proposeGroup(ARIES, id, group([rowFor(0, 2800)], 'model:mfp:other'));
    expect(fieldOf(other, 'r0', 'heating_h')).toMatchObject({ status: 'conflict', decision: 'pending' });
  });

  it('απόρριψη: τίποτα δεν γράφεται, και η επανάληψη της κατασκευής σέβεται την απόφαση', async () => {
    const id = await batchId();
    const proposal = await proposeGroup(ARIES, id, group(faithful()));
    await rejectImportProposal(ARIES, proposal.id, proposal.revision);
    expect((await proposeGroup(ARIES, id, group(faithful()))).status).toBe('rejected');
    expect(products()).toHaveLength(0);
  });
});

describe('κύκλος ζωής παρτίδας', () => {
  const faithful = () => MFP_SIZES.map((_, index) => rowFor(index));
  const statusOf = (id: string): unknown => fake.getAllDocs('catalog_import_batches')[id]?.status;

  async function reviewingBatch(pages: { readonly from: number; readonly to: number; readonly done: readonly number[]; readonly failed: readonly number[] } | null = null): Promise<string> {
    const batch = await createImportBatch(ARIES, attributesBatch());
    fake.seed('catalog_import_batches', batch.id, { ...batch, status: 'reviewing', pages });
    return batch.id;
  }

  it('κλείνει μόνο όταν κριθεί και η τελευταία πρόταση', async () => {
    const id = await reviewingBatch();
    const first = await proposeGroup(ARIES, id, group(faithful(), 'model:mfp:a'));
    const second = await proposeGroup(ARIES, id, group([rowFor(0)], 'model:other:b'));
    await applyImportProposal(ARIES, first.id, first.revision);
    expect(statusOf(id)).toBe('reviewing');
    await rejectImportProposal(ARIES, second.id, second.revision);
    expect(statusOf(id)).toBe('closed');
  });

  it('κλείνει και όταν η τελευταία πράξη είναι έγκριση', async () => {
    const id = await reviewingBatch();
    const only = await proposeGroup(ARIES, id, group(faithful()));
    await applyImportProposal(ARIES, only.id, only.revision);
    expect(statusOf(id)).toBe('closed');
  });

  it('αποτυχημένη σελίδα κρατά την παρτίδα ανοιχτή, γιατί μένει δουλειά', async () => {
    const id = await reviewingBatch({ from: 60, to: 61, done: [60], failed: [61] });
    const proposal = await proposeGroup(ARIES, id, group(faithful()));
    await rejectImportProposal(ARIES, proposal.id, proposal.revision);
    expect(statusOf(id)).toBe('reviewing');
  });

  it('εγκαταλειμμένη παρτίδα δεν ανοίγει ξανά ως κλεισμένη', async () => {
    const id = await reviewingBatch();
    const proposal = await proposeGroup(ARIES, id, group(faithful()));
    const stored = fake.getAllDocs('catalog_import_batches')[id];
    fake.seed('catalog_import_batches', id, { ...stored, status: 'discarded' });
    await rejectImportProposal(ARIES, proposal.id, proposal.revision);
    expect(statusOf(id)).toBe('discarded');
  });
});

describe('ανάγνωση σελίδας', () => {
  const rawCell = (attribute: string, value: string): RawPageCell => ({ attribute, value, confidence: 0.95, sourceTokens: [] });
  const reading = (heating_h: number): CatalogPageReading => ({
    kind: 'read',
    extraction: {
      tables: [{
        modelCode: { value: 'mfp', confidence: 1, sourceTokens: [] },
        shared: [],
        variants: [{ cells: [rawCell('size', MFP_SIZES[0]), rawCell('model_code', MFP_PAGE_60.code[0]), rawCell('heating_h', `${heating_h} W`), rawCell('heating_m', '1950 W')] }],
      }],
    },
  });
  const pdfBatch = () => createImportBatch(ARIES, attributesBatch({ sourceKind: 'pdf', fileName: 'aries.pdf', pageRange: { from: 60, to: 61 } }));

  async function attachedBatch() {
    const batch = await pdfBatch();
    fake.seed('catalog_import_batches', batch.id, { ...batch, fileId: 'file_1', status: 'extracting' });
    return batch;
  }

  it('σελίδα χωρίς κανόνα που σπάει: μία κλήση, και η επανάληψη δεν ξαναπληρώνει', async () => {
    const batch = await attachedBatch();
    readPage.mockResolvedValue(reading(2700));
    const after = await readImportPage(ARIES, batch.id, 60);
    expect(after.pages?.done).toEqual([60]);
    await readImportPage(ARIES, batch.id, 60);
    expect(readPage).toHaveBeenCalledTimes(1);
  });

  it('ευρήματα κανόνων ⇒ μία επανάληψη με ανατροφοδότηση, που ξαναγράφει την ίδια πρόταση', async () => {
    const batch = await attachedBatch();
    readPage.mockResolvedValueOnce(reading(1000)).mockResolvedValueOnce(reading(2700));
    await readImportPage(ARIES, batch.id, 60);
    expect(readPage).toHaveBeenCalledTimes(2);
    expect(readPage.mock.calls[1][0].feedback.join(' ')).toContain('rule_heat_hml');
    expect(proposals()).toHaveLength(1);
    expect(proposals()[0].violations).toEqual([]);
  });

  it('κακή απάντηση: η σελίδα μετρά αποτυχημένη, χωρίς πρόταση, και ξαναδοκιμάζεται', async () => {
    const batch = await attachedBatch();
    readPage.mockResolvedValueOnce({ kind: 'failed' });
    expect((await readImportPage(ARIES, batch.id, 60)).pages?.failed).toEqual([60]);
    expect(proposals()).toHaveLength(0);
    readPage.mockResolvedValueOnce(reading(2700));
    const retried = await readImportPage(ARIES, batch.id, 60);
    expect(retried.pages).toMatchObject({ done: [60], failed: [] });
  });

  it('σελίδα εκτός εύρους δεν διαβάζεται ποτέ', async () => {
    const batch = await attachedBatch();
    await rejectionOf(readImportPage(ARIES, batch.id, 62));
    expect(readPage).not.toHaveBeenCalled();
  });

  it('όλες οι σελίδες κριμένες ⇒ η παρτίδα περνά σε έλεγχο', async () => {
    const batch = await attachedBatch();
    readPage.mockResolvedValue({ kind: 'read', extraction: { tables: [] } });
    await readImportPage(ARIES, batch.id, 60);
    expect((await readImportPage(ARIES, batch.id, 61)).status).toBe('reviewing');
  });
});
