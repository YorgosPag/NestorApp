/**
 * Ο αγωγός εισαγωγής (ADR-923 §5.5.1) από άκρη σε άκρη, πάνω στους **πραγματικούς** γραφείς και στο επαληθευμένο ψεύτικο
 * Firestore. Το μοντέλο AI και τα bytes του PDF είναι ψεύτικα: καμία πληρωμένη κλήση.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Firestore } from 'firebase-admin/firestore';

import type { AuthContext } from '@/lib/auth';
import type { PageRule, PageTagTable } from '@/lib/pdf-tables/page-table-types';
import ARIES_PAGES from '@/subapps/catalog/__tests__/fixtures/aries-page-structure.data.json';
import type { RawTableMapping } from '@/subapps/catalog/import/page-table-mapping';
import type { PageTextItem } from '@/subapps/catalog/import/page-tokens';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { MFP_ATTRIBUTES, MFP_SIZES } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil.fixture';
import { MFP_PAGE_60, MFP_SETTINGS } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil-products.fixture';
import type { CatalogPageInput, CatalogPageReading, CatalogTableMapInput, CatalogTableMapping } from '@/subapps/catalog/import/page-analyzer';
import type { RawPageCell } from '@/subapps/catalog/import/page-extraction';
import { importTargetKey } from '@/subapps/catalog/import/proposal-values';
import type { ExtractedCell, ExtractedGroup, ExtractedRow, ImportBatchDefinition, ImportProposalDefinition, ImportProposalRow } from '@/subapps/catalog/types/catalog-import';
import type { PdfTextLayer } from '@/services/pdf/pdf-rasterize.service';
import type { CreateImportBatchRequest, SetImportLineRequest } from '@/subapps/catalog/types/catalog-import-requests';
import { importPageReadingKey } from '@/subapps/catalog/import/import-keys';
import { generateDeterministicCatalogImportPageReadingId } from '@/services/enterprise-id.service';
import { ANY_SLOT, type CatalogProductDefinition, type CatalogProductModelDefinition } from '@/subapps/catalog/types/product';
import { ARIES, MFP_GROUP_CODES, RIVAL, SEED_RIGHTS, mfpFamilyWith, rejectionOf } from './catalog-writer-seed';

const fake = new FakeFirestore();
const readPage = jest.fn<Promise<CatalogPageReading>, [CatalogPageInput]>();
const mapTables = jest.fn<Promise<CatalogTableMapping>, [CatalogTableMapInput]>();
const EMPTY_PDF_PAGE = { items: [] as readonly PageTextItem[], rules: [] as readonly PageRule[], tagTables: [] as readonly PageTagTable[], textLayer: undefined as PdfTextLayer | undefined };
const mockPdfPage = { current: EMPTY_PDF_PAGE };
const pricingAllowed = jest.fn(async () => true);

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: (): Firestore => fake as unknown as Firestore }));
jest.mock('@/services/entity-audit-tracked-write', () => ({ recordTrackedEntityWrite: async () => undefined }));
jest.mock('@/lib/auth', () => ({ ...jest.requireActual('@/lib/auth'), hasPermission: () => pricingAllowed() }));
jest.mock('../import-page-analyzer.server', () => ({ createCatalogPageAnalyzer: () => ({ readPage, mapTables }) }));
jest.mock('@/services/pdf/pdf-rasterize.service', () => ({
  countPdfPages: async () => 100,
  readPdfPage: async () => ({
    png: Buffer.from('png'),
    pageCount: 100,
    ...mockPdfPage.current,
    textLayer: mockPdfPage.current.textLayer ?? (mockPdfPage.current.items.length > 0 ? { state: 'present', recovered: false } : { state: 'absent' }),
  }),
}));
jest.mock('../import-source.server', () => ({
  ...jest.requireActual('../import-source.server'),
  readBatchFileRecord: async () => ({}),
  downloadBatchFile: async () => Buffer.from('bytes'),
}));

/* eslint-disable import/first -- τα mocks πρέπει να δηλωθούν πριν φορτωθούν οι γραφείς */
import { createCatalogAttributeGroup } from '../attribute-group-writer.server';
import { createCatalogAsset } from '../asset-writer.server';
import { createCatalogAttribute } from '../attribute-writer.server';
import { saveCatalogSettings } from '../catalog-settings-writer.server';
import { createCatalogCategory } from '../category-writer.server';
import { createCatalogFamily } from '../family-writer.server';
import { applyImportProposal } from '../import-apply.server';
import { createImportBatch } from '../import-batch-writer.server';
import { readImportPage } from '../import-readers.server';
import { setImportLine } from '../import-page-reinterpret.server';
import { groupTableRowsByLiveModel } from '../import-proposal-plan.server';
import { discardImportBatch, proposeGroup, rejectImportProposal, retireStaleSourceProposals, updateImportProposal, type StoredImportProposal } from '../import-proposal-writer.server';
import { readImportBatchDetail } from '../import-reads.server';
import { updateCatalogProductModel } from '../product-model-writer.server';
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
const models = () => Object.values(fake.getAllDocs('catalog_product_models')) as unknown as (CatalogProductModelDefinition & { id: string; revision: number })[];
const readings = () => Object.values(fake.getAllDocs('catalog_import_page_readings'));
const seedCategory = async (): Promise<string> => (await createCatalogCategory(ARIES, { code: 'fan_coils', labels: { el: 'Fan coils' }, parentId: null, orderKey: 'a0', mappings: { atoeCode: null } })).id;
const seedPhoto = async (): Promise<string> => (await createCatalogAsset(ARIES, { code: 'mfp_hero', role: 'photo', kind: 'image', labels: { el: 'MFP' }, description: {}, rights: SEED_RIGHTS })).id;
const rowIssues = (rows: readonly ImportProposalRow[]): string[] => rows.flatMap((row) => row.issues.map((issue) => `${row.rowKey}:${issue.code}:${issue.path}`));
const fieldOf = (proposal: StoredImportProposal, rowKey: string, code: string) =>
  proposal.rows.find((row) => row.rowKey === rowKey)?.fields.find((field) => field.target.kind === 'attribute' && field.target.attributeId === attributeId(code));

beforeEach(async () => {
  fake.reset();
  readPage.mockReset();
  mapTables.mockReset();
  mockPdfPage.current = EMPTY_PDF_PAGE;
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

  it('άλλο εύρος σελίδων ⇒ νέα παρτίδα, με το νέο εύρος', async () => {
    const pdf = (from: number, to: number) => attributesBatch({ sourceKind: 'pdf', pageRange: { from, to } });
    const first = await createImportBatch(ARIES, pdf(85, 86));
    const second = await createImportBatch(ARIES, pdf(87, 90));
    expect(second.id).not.toBe(first.id);
    expect(second.pages).toMatchObject({ from: 87, to: 90 });
  });

  it.each(['discarded', 'closed'])('παρτίδα %s δεν ξανανοίγει: η ίδια είσοδος είναι η επόμενη εκτέλεση', async (status) => {
    const first = await createImportBatch(ARIES, attributesBatch());
    fake.seed('catalog_import_batches', first.id, { ...first, status });
    const next = await createImportBatch(ARIES, attributesBatch());
    expect(next.id).not.toBe(first.id);
    expect(next).toMatchObject({ run: 1, status: 'awaitingFile' });
    expect((await createImportBatch(ARIES, attributesBatch())).id).toBe(next.id);
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

  it('🔴 νέο μοντέλο σε ζωντανή κατηγορία: η κατηγορία του στόχου δεν βγαίνει `unknownReference`', async () => {
    const categoryId = await seedCategory();
    const batch = await createImportBatch(ARIES, attributesBatch({ target: { purpose: 'attributes', familyId: seeded.familyId, variantSchemeCode: 'by_size', categoryIds: [categoryId] } }));
    const proposal = await proposeGroup(ARIES, batch.id, group(faithful()));
    expect(rowIssues(proposal.rows)).toEqual([]);
  });

  it('🔴 ό,τι θα απέρριπτε ο γραφέας φαίνεται στον έλεγχο: δύο γραμμές ίδιου άξονα, η έγκριση αρνείται χωρίς εγγραφή', async () => {
    const twin: ExtractedRow = { ...rowFor(1), cells: rowFor(1).cells.map((c) => (c.text === MFP_SIZES[1] ? { ...c, text: MFP_SIZES[0] } : c)) };
    const proposal = await proposeGroup(ARIES, await batchId(), group([rowFor(0), twin]));
    expect(proposal.rows.find((row) => row.rowKey === 'r1')?.issues).toEqual([expect.objectContaining({ code: 'axisComboDuplicate', params: { other: 'r0' } })]);
    expect((await rejectionOf(applyImportProposal(ARIES, proposal.id, proposal.revision))).kind).toBe('confirmationRequired');
    expect(products()).toHaveLength(0);
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

  it('Δ3: δύο κωδικοί, ο ένας ξένου μοντέλου και ο άλλος δικός μας: ταυτίζεται, χωρίς ψευδή σύγκρουση', async () => {
    const id = await batchId();
    const first = await proposeGroup(ARIES, id, group(faithful()));
    await applyImportProposal(ARIES, first.id, first.revision);
    const foreignRow: ExtractedRow = { ...rowFor(0), cells: rowFor(0).cells.map((c) => (c.text === MFP_PAGE_60.code[0] ? { ...c, text: 'ΞΕΝΟ-1' } : c)) };
    const other = await proposeGroup(ARIES, id, { ...group([foreignRow], 'model:other:0'), modelCode: 'other' });
    await applyImportProposal(ARIES, other.id, other.revision);
    const both: ExtractedRow = { rowKey: 'r0', cells: [cell('model_code', 'ΞΕΝΟ-1'), cell('model_code', MFP_PAGE_60.code[0]), cell('heating_h', '2800', 'W')] };
    const proposal = await proposeGroup(ARIES, id, group([both], 'model:mfp:both'));
    expect(proposal.rows.find((row) => row.rowKey === 'r0')).toMatchObject({ action: 'update', issues: [] });
  });

  it('αμφισβητούμενη μονάδα δεν ντύνει τη διόρθωση: γυμνός αριθμός ξαναζητά μονάδα', async () => {
    const doubted: ExtractedCell = { ...cell('cooling_h', '1000', 'kW'), flags: [{ code: 'unitUnconfirmed', path: attributeId('cooling_h'), params: { unit: 'kW' } }] };
    const row: ExtractedRow = { rowKey: 'r0', cells: [cell('size', MFP_SIZES[0]), cell('model_code', MFP_PAGE_60.code[0]), doubted] };
    const proposal = await proposeGroup(ARIES, await batchId(), group([row]));
    expect(fieldOf(proposal, 'r0', 'cooling_h')).toMatchObject({ decision: 'pending', sourceText: '1000 kW' });
    const targetKey = importTargetKey(doubted.target);
    const bare = await updateImportProposal(ARIES, proposal.id, { expectedRevision: proposal.revision, decisions: [], edits: [{ rowKey: 'r0', targetKey, text: '1000' }], modelCode: null });
    expect(fieldOf(bare, 'r0', 'cooling_h')).toMatchObject({ incoming: null, decision: 'pending', issues: [expect.objectContaining({ code: 'measurementUnitMissing' })] });
    const fixed = await updateImportProposal(ARIES, bare.id, { expectedRevision: bare.revision, decisions: [], edits: [{ rowKey: 'r0', targetKey, text: '1000 W' }], modelCode: null });
    expect(fieldOf(fixed, 'r0', 'cooling_h')?.incoming).toEqual({ type: 'measurement', amount: '1000', unitCode: 'W' });
  });

  it('τα ζωντανά άλλαξαν αφότου τα είδε ο άνθρωπος ⇒ 409, τίποτα δεν γράφεται', async () => {
    const id = await batchId();
    const first = await proposeGroup(ARIES, id, group(faithful()));
    await applyImportProposal(ARIES, first.id, first.revision);
    const second = await proposeGroup(ARIES, id, group([rowFor(0, 9999)], 'model:mfp:2'));
    const target = products().find((product) => product.id === second.rows.find((row) => row.rowKey === 'r0')?.holderId);
    if (!target) throw new Error('no match');
    await updateCatalogProduct(ARIES, target.id, target.revision, { modelId: target.modelId, familyId: target.familyId, categoryIds: target.categoryIds, noValueReasons: target.noValueReasons, values: target.values, brand: null, gtin: null, mpn: null, noGtinReason: null });
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
    await updateCatalogProduct(ARIES, target.id, target.revision, { modelId: target.modelId, familyId: target.familyId, categoryIds: target.categoryIds, noValueReasons: target.noValueReasons, values: { ...target.values, [heating]: { '*': { '*': { type: 'measurement', amount: '2750', unitCode: 'W' } } } }, brand: null, gtin: null, mpn: null, noGtinReason: null });
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

describe('ADR-934 §5.1.13 — ταυτότητα πρώτα, ομαδοποίηση μετά (πινακοειδείς πηγές)', () => {
  const faithful = () => MFP_SIZES.map((_, index) => rowFor(index));
  /** Ό,τι βγάζει ο `byModelCode` για αρχείο χωρίς στήλη μοντέλου: κάθε γραμμή δικό της σύνολο. */
  const standalone = (row: ExtractedRow): ExtractedGroup => ({ groupKey: `row:${row.rowKey}`, modelCode: null, sharedCells: [], rows: [row], pages: [] });

  async function liveModel(): Promise<string> {
    const id = await batchId();
    const seed = await proposeGroup(ARIES, id, group(faithful()));
    await applyImportProposal(ARIES, seed.id, seed.revision);
    return id;
  }

  it('🔴 7 γραμμές χωρίς κωδικό μοντέλου πάνω σε ζωντανά SKU ⇒ ΜΙΑ ομάδα του μοντέλου, μία πρόταση, μία γραμμή μοντέλου', async () => {
    await liveModel();
    const groups = await groupTableRowsByLiveModel(ARIES, attributesBatch().target, faithful().map(standalone));
    expect(groups.map((g) => ({ groupKey: g.groupKey, modelCode: g.modelCode, rows: g.rows.length }))).toEqual([{ groupKey: 'model:mfp:0', modelCode: 'mfp', rows: 7 }]);
    // Η επανεισαγωγή είναι ΝΕΑ παρτίδα: στην ίδια, το ίδιο `groupKey` είναι η ήδη εφαρμοσμένη πρόταση και δεν ξαναγράφεται.
    const reimport = await createImportBatch(ARIES, attributesBatch({ run: 1 }));
    const proposal = await proposeGroup(ARIES, reimport.id, groups[0]);
    expect(proposal.status).toBe('pending');
    expect(proposal.rows.filter((row) => row.holderKind === 'productModel')).toHaveLength(1);
    expect(proposal.rows.filter((row) => row.holderKind === 'product').every((row) => row.action === 'update')).toBe(true);
    expect(rowIssues(proposal.rows)).toEqual([]);
  });

  it('γραμμή που δεν ανήκει σε κανένα μοντέλο μένει απλό προϊόν, δίπλα στην ομάδα του μοντέλου', async () => {
    await liveModel();
    const stranger: ExtractedRow = { rowKey: 'r99', cells: [cell('size', MFP_SIZES[0]), cell('model_code', '099-99-999')] };
    const groups = await groupTableRowsByLiveModel(ARIES, attributesBatch().target, [...faithful().map(standalone), standalone(stranger)]);
    expect(groups.map((g) => [g.groupKey, g.modelCode, g.rows.length])).toEqual([['model:mfp:0', 'mfp', 7], ['row:r99', null, 1]]);
  });

  it('χωρίς ζωντανό μοντέλο: ο τυπωμένος κωδικός γίνεται κανονικός ⇒ «MFP-TM» και «mfp tm» είναι μία ομάδα', async () => {
    const printed = (row: ExtractedRow, modelCode: string): ExtractedGroup => ({ ...standalone(row), groupKey: `model:${modelCode}:0`, modelCode });
    const groups = await groupTableRowsByLiveModel(ARIES, attributesBatch().target, [printed(rowFor(0), 'MFP-TM'), printed(rowFor(1), 'mfp tm')]);
    expect(groups.map((g) => [g.groupKey, g.modelCode, g.rows.length])).toEqual([['model:mfp_tm:0', 'mfp_tm', 2]]);
  });

  it('νέα χαρτογράφηση αποσύρει την εκκρεμή πρόταση που δεν ξαναβγήκε· η εφαρμοσμένη μένει', async () => {
    const id = await liveModel();
    const stale = await proposeGroup(ARIES, id, standalone(rowFor(0, 2800)));
    const kept = await proposeGroup(ARIES, id, group([rowFor(1, 2900)], 'model:mfp:1'));
    await retireStaleSourceProposals(ARIES, id, [kept]);
    const byKey = new Map(proposals().map((proposal) => [proposal.groupKey, proposal as ImportProposalDefinition & { isDeleted?: boolean }]));
    expect(byKey.get(stale.groupKey)?.isDeleted).toBe(true);
    expect(byKey.get(kept.groupKey)?.isDeleted).toBe(false);
    expect(byKey.get('model:mfp:0')).toMatchObject({ status: 'applied', isDeleted: false });
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

  // ADR-934 Ε3: πριν, η απόρριψη περνούσε και απλώς δεν έκλεινε την παρτίδα· τώρα η εγκαταλειμμένη δεν δέχεται καμία απόφαση.
  it('εγκαταλειμμένη παρτίδα δεν ανοίγει ξανά ως κλεισμένη — και αρνείται την απόφαση', async () => {
    const id = await reviewingBatch();
    const proposal = await proposeGroup(ARIES, id, group(faithful()));
    const stored = fake.getAllDocs('catalog_import_batches')[id];
    fake.seed('catalog_import_batches', id, { ...stored, status: 'discarded' });
    expect((await rejectionOf(rejectImportProposal(ARIES, proposal.id, proposal.revision))).kind).toBe('immutable');
    expect(statusOf(id)).toBe('discarded');
  });
});

describe('ADR-934 Ε3 — η εγκατάλειψη αποσύρει τις εκκρεμείς, και καμία απόφαση δεν περνά σε παρτίδα που τελείωσε', () => {
  const faithful = () => MFP_SIZES.map((_, index) => rowFor(index));
  const proposalDoc = (proposalId: string): unknown => fake.getAllDocs('catalog_import_proposals')[proposalId];

  async function batchWithTwo(): Promise<{ readonly id: string; readonly applied: StoredImportProposal; readonly pending: StoredImportProposal }> {
    const batch = await createImportBatch(ARIES, attributesBatch());
    fake.seed('catalog_import_batches', batch.id, { ...batch, status: 'reviewing' });
    const first = await proposeGroup(ARIES, batch.id, group(faithful(), 'model:mfp:a'));
    const pending = await proposeGroup(ARIES, batch.id, group([rowFor(0)], 'model:other:b'));
    return { id: batch.id, applied: await applyImportProposal(ARIES, first.id, first.revision), pending };
  }

  const revisionOf = (id: string): number => Number(fake.getAllDocs('catalog_import_batches')[id]?.revision);

  it('οι εκκρεμείς φεύγουν με μαλακή διαγραφή· η εφαρμοσμένη μένει, είναι απόφαση', async () => {
    const { id, applied, pending } = await batchWithTwo();
    expect((await discardImportBatch(ARIES, id, revisionOf(id))).status).toBe('discarded');
    expect(proposalDoc(pending.id)).toMatchObject({ status: 'pending', isDeleted: true });
    expect(proposalDoc(applied.id)).toMatchObject({ status: 'applied', isDeleted: false });
    expect((await readImportBatchDetail(ARIES, id)).proposals.map((proposal) => proposal.id)).toEqual([applied.id]);
  });

  it('ιδεμπότητη: δεύτερη κλήση, ακόμη και με παλιά αναθεώρηση, δεν γράφει την παρτίδα ξανά — μόνο συμπληρώνει την απόσυρση', async () => {
    const { id, pending } = await batchWithTwo();
    const stale = revisionOf(id);
    // Η εγκατάλειψη «χάθηκε» μισή: η παρτίδα γράφτηκε, η απόσυρση όχι (η παλιά παρτίδα της παραγωγής, 08/11).
    fake.seed('catalog_import_batches', id, { ...fake.getAllDocs('catalog_import_batches')[id], status: 'discarded' });
    const before = revisionOf(id);
    expect((await discardImportBatch(ARIES, id, stale)).revision).toBe(before);
    expect(proposalDoc(pending.id)).toMatchObject({ isDeleted: true });
  });

  it.each(['discarded', 'closed'])('παρτίδα %s: έγκριση, απόρριψη και διόρθωση αρνούνται, και η πρόταση μένει ανέγγιχτη', async (status) => {
    const { id, pending } = await batchWithTwo();
    fake.seed('catalog_import_batches', id, { ...fake.getAllDocs('catalog_import_batches')[id], status });
    const decisions = { expectedRevision: pending.revision, decisions: [], edits: [], modelCode: null };
    expect((await rejectionOf(applyImportProposal(ARIES, pending.id, pending.revision))).kind).toBe('immutable');
    expect((await rejectionOf(rejectImportProposal(ARIES, pending.id, pending.revision))).kind).toBe('immutable');
    expect((await rejectionOf(updateImportProposal(ARIES, pending.id, decisions))).kind).toBe('immutable');
    expect(proposalDoc(pending.id)).toMatchObject({ status: 'pending', revision: pending.revision });
  });
});

describe('🔴 ίδιο περιεχόμενο δεν ξανανεβαίνει (93,2 MB ορφανά, ένα πλήρες αντίγραφο ανά παρτίδα)', () => {
  const FILE_ID = 'file_live';
  const liveFile = (owner: string, overrides: Record<string, unknown> = {}) => ({ companyId: ARIES.companyId, entityType: 'catalog_import_batch', entityId: owner, status: 'ready', storagePath: 'x/y.pdf', ...overrides });
  const pdf = (from: number, to: number) => attributesBatch({ sourceKind: 'pdf', fileName: 'aries.pdf', pageRange: { from, to } });

  async function attachedDonor() {
    const donor = await createImportBatch(ARIES, pdf(85, 86));
    fake.seed('catalog_import_batches', donor.id, { ...donor, fileId: FILE_ID, status: 'reviewing' });
    return donor;
  }

  it('νέα παρτίδα ίδιου αρχείου: δείχνει το ζωντανό αρχείο και δεν περιμένει ανέβασμα', async () => {
    const donor = await attachedDonor();
    fake.seed('files', FILE_ID, liveFile(donor.id));
    const next = await createImportBatch(ARIES, pdf(87, 88));
    expect(next).toMatchObject({ fileId: FILE_ID, fileBatchId: donor.id, status: 'extracting' });
  });

  it('τρίτη παρτίδα: ο κάτοχος μένει ο αρχικός, όχι η ενδιάμεση που δανείστηκε', async () => {
    const donor = await attachedDonor();
    fake.seed('files', FILE_ID, liveFile(donor.id));
    await createImportBatch(ARIES, pdf(87, 88));
    fake.reset();
    const middle = { id: 'cibat_mid', companyId: ARIES.companyId, contentSha256: SHA, fileId: FILE_ID, fileBatchId: donor.id, isDeleted: false };
    seeded = await seedSchema();
    fake.seed('catalog_import_batches', middle.id, middle);
    fake.seed('files', FILE_ID, liveFile(donor.id));
    expect(await createImportBatch(ARIES, pdf(89, 90))).toMatchObject({ fileBatchId: donor.id });
  });

  it('αρχείο στον κάδο δεν ξαναχρησιμοποιείται: ο πελάτης ανεβάζει', async () => {
    const donor = await attachedDonor();
    fake.seed('files', FILE_ID, liveFile(donor.id, { isDeleted: true }));
    expect(await createImportBatch(ARIES, pdf(87, 88))).toMatchObject({ fileId: null, status: 'awaitingFile' });
  });

  it('🔒 ίδιο περιεχόμενο σε άλλον χώρο δεν μοιράζεται', async () => {
    const donor = await attachedDonor();
    fake.seed('files', FILE_ID, liveFile(donor.id));
    fake.seed('catalog_import_batches', donor.id, { ...donor, companyId: 'comp-other', fileId: FILE_ID, status: 'reviewing' });
    expect(await createImportBatch(ARIES, pdf(87, 88))).toMatchObject({ fileId: null, status: 'awaitingFile' });
  });
});

describe('ανάγνωση σελίδας', () => {
  const USED = { requests: 1, inputTokens: 1000, outputTokens: 100, costUsd: 0.01 };
  const rawCell = (attribute: string, value: string): RawPageCell => ({ attribute, value, confidence: 0.95, sourceTokens: [], unit: null, unitTokens: [] });
  const tableOf = (index: number, heating_h: number) => ({
    modelCode: { value: 'mfp', confidence: 1, sourceTokens: [] },
    shared: [],
    variants: [{ cells: [rawCell('size', MFP_SIZES[index]), rawCell('model_code', MFP_PAGE_60.code[index]), rawCell('heating_h', `${heating_h} W`), rawCell('heating_m', '1950 W')] }],
  });
  const reading = (heating_h: number): CatalogPageReading => ({ kind: 'read', model: 'gpt-4o', rawText: null, usage: USED, value: { tables: [tableOf(0, heating_h)] } });
  const active = () => proposals().filter((proposal) => !(proposal as unknown as { isDeleted: boolean }).isDeleted);
  const pdfBatch = () => createImportBatch(ARIES, attributesBatch({ sourceKind: 'pdf', fileName: 'aries.pdf', pageRange: { from: 60, to: 61 } }));

  async function attachedBatch() {
    const batch = await pdfBatch();
    fake.seed('catalog_import_batches', batch.id, { ...batch, fileId: 'file_1', status: 'extracting' });
    return batch;
  }

  it('Ε8: χαμένη στρώση κειμένου ⇒ η σελίδα αποτυγχάνει δηλωμένα, χωρίς κλήση μοντέλου και χωρίς χρέωση', async () => {
    const batch = await attachedBatch();
    mockPdfPage.current = { ...EMPTY_PDF_PAGE, textLayer: { state: 'lost', reason: 'Error: Bad FCHECK' } };
    const after = await readImportPage(ARIES, batch.id, 60);
    expect(after.pages).toMatchObject({ done: [], failed: [60], textless: [{ page: 60, kind: 'lost', reason: 'Error: Bad FCHECK' }] });
    expect(after.pages?.usage).toEqual({ requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 });
    expect(readPage).not.toHaveBeenCalled();
    expect(mapTables).not.toHaveBeenCalled();
  });

  it('Ε8: σελίδα χωρίς κείμενο διαβάζεται με όραση και δηλώνεται· η επόμενη ανάγνωση με κείμενο σβήνει τη δήλωση', async () => {
    const batch = await attachedBatch();
    mockPdfPage.current = { ...EMPTY_PDF_PAGE, textLayer: { state: 'lost', reason: 'Error: Bad FCHECK' } };
    await readImportPage(ARIES, batch.id, 61);
    mockPdfPage.current = EMPTY_PDF_PAGE;
    readPage.mockResolvedValue(reading(2700));
    const absent = await readImportPage(ARIES, batch.id, 60);
    expect(absent.pages?.textless).toEqual([{ page: 61, kind: 'lost', reason: 'Error: Bad FCHECK' }, { page: 60, kind: 'absent', reason: null }]);
    mockPdfPage.current = { ...EMPTY_PDF_PAGE, textLayer: { state: 'present', recovered: true } };
    const recovered = await readImportPage(ARIES, batch.id, 61);
    expect(recovered.pages?.textless).toEqual([{ page: 60, kind: 'absent', reason: null }]);
  });

  it('σελίδα χωρίς κανόνα που σπάει: μία κλήση, και η επανάληψη δεν ξαναπληρώνει', async () => {
    const batch = await attachedBatch();
    readPage.mockResolvedValue(reading(2700));
    const after = await readImportPage(ARIES, batch.id, 60);
    expect(after.pages?.done).toEqual([60]);
    await readImportPage(ARIES, batch.id, 60);
    expect(readPage).toHaveBeenCalledTimes(1);
  });

  describe('ADR-934 Ε3 — σελίδα σε εξέλιξη όταν πατιέται «Εγκατάλειψη»', () => {
    const discardNow = (id: string) => discardImportBatch(ARIES, id, Number(fake.getAllDocs('catalog_import_batches')[id]?.revision));
    const batchDoc = (id: string) => fake.getAllDocs('catalog_import_batches')[id] as unknown as ImportBatchDefinition;

    it('η εγκατάλειψη προλαβαίνει την απάντηση του μοντέλου ⇒ καμία πρόταση, και η παρτίδα μένει εγκαταλειμμένη', async () => {
      const batch = await attachedBatch();
      readPage.mockImplementation(async () => { await discardNow(batch.id); return reading(2700); });
      expect((await rejectionOf(readImportPage(ARIES, batch.id, 60))).kind).toBe('immutable');
      expect(active()).toEqual([]);
      expect(batchDoc(batch.id)).toMatchObject({ status: 'discarded', pages: { done: [] } });
    });

    it('αργοπορημένη αποτυχημένη τελευταία σελίδα δεν ξαναγυρνά την εγκαταλειμμένη παρτίδα σε «reviewing»', async () => {
      const batch = await attachedBatch();
      fake.seed('catalog_import_batches', batch.id, { ...batchDoc(batch.id), pages: { ...batchDoc(batch.id).pages, done: [61] } });
      readPage.mockImplementation(async () => { await discardNow(batch.id); return { kind: 'failed', usage: USED, model: 'gpt-4o', rawText: null }; });
      expect((await readImportPage(ARIES, batch.id, 60)).status).toBe('discarded');
      expect(batchDoc(batch.id)).toMatchObject({ status: 'discarded', pages: { done: [61], failed: [] } });
    });

    it.each(['discarded', 'closed'])('νέα ανάγνωση σε παρτίδα %s αρνείται πριν πληρωθεί το μοντέλο', async (status) => {
      const batch = await attachedBatch();
      fake.seed('catalog_import_batches', batch.id, { ...batchDoc(batch.id), status });
      expect((await rejectionOf(readImportPage(ARIES, batch.id, 60))).kind).toBe('immutable');
      expect(readPage).not.toHaveBeenCalled();
      expect(mapTables).not.toHaveBeenCalled();
    });
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

  it('η ανατροφοδότηση μιλά με κωδικούς ιδιοτήτων, όχι με εσωτερικά ids που το μοντέλο δεν έχει δει', async () => {
    const batch = await attachedBatch();
    readPage.mockResolvedValueOnce(reading(1000)).mockResolvedValueOnce(reading(2700));
    await readImportPage(ARIES, batch.id, 60);
    const feedback = readPage.mock.calls[1][0].feedback.join(' ');
    expect(feedback).toContain('heating_h');
    expect(feedback).not.toContain(attributeId('heating_h'));
  });

  it('η δεύτερη ανάγνωση βρίσκει λιγότερους πίνακες: η πρόταση που αποσύρθηκε φεύγει από τον έλεγχο', async () => {
    const batch = await attachedBatch();
    const two: CatalogPageReading = { kind: 'read', model: 'gpt-4o', rawText: null, usage: USED, value: { tables: [tableOf(0, 1000), tableOf(1, 4050)] } };
    readPage.mockResolvedValueOnce(two).mockResolvedValueOnce(reading(2700));
    await readImportPage(ARIES, batch.id, 60);
    expect(proposals()).toHaveLength(2);
    expect(active().map((proposal) => proposal.groupKey)).toEqual(['page:60:0']);
    expect((await readImportBatchDetail(ARIES, batch.id)).proposals).toHaveLength(1);
  });

  it('η χρήση αθροίζεται ανά ανάγνωση, και η αποτυχημένη απάντηση μετρά: πληρώθηκε', async () => {
    const batch = await attachedBatch();
    readPage.mockResolvedValueOnce(reading(1000)).mockResolvedValueOnce(reading(2700)).mockResolvedValueOnce({ kind: 'failed', usage: USED, model: 'gpt-4o', rawText: null });
    await readImportPage(ARIES, batch.id, 60);
    const after = await readImportPage(ARIES, batch.id, 61);
    expect(after.pages?.usage).toEqual({ requests: 3, inputTokens: 3000, outputTokens: 300, costUsd: expect.closeTo(0.03) });
  });

  it('μοντέλο χωρίς τιμή στον πίνακα: το κόστος μένει άγνωστο, δεν γίνεται μικρότερο', async () => {
    const batch = await attachedBatch();
    readPage.mockResolvedValueOnce(reading(2700));
    readPage.mockResolvedValueOnce({ kind: 'read', model: 'gpt-4o', rawText: null, value: { tables: [] }, usage: { ...USED, costUsd: null } });
    await readImportPage(ARIES, batch.id, 60);
    expect((await readImportPage(ARIES, batch.id, 61)).pages?.usage?.costUsd).toBeNull();
  });

  it('🔴 το «1000» της σελίδας 86 χωρίς μονάδα: απόφαση ανθρώπου, και η έγκριση αρνείται', async () => {
    const batch = await attachedBatch();
    const bare: CatalogPageReading = { kind: 'read', model: 'gpt-4o', rawText: null, usage: USED, value: { tables: [{ modelCode: { value: 'mfp', confidence: 1, sourceTokens: [] }, shared: [], variants: [{ cells: [rawCell('model_code', MFP_PAGE_60.code[0]), rawCell('cooling_h', '1000')] }] }] } };
    readPage.mockResolvedValue(bare);
    await readImportPage(ARIES, batch.id, 60);
    const [stored] = (await readImportBatchDetail(ARIES, batch.id)).proposals;
    expect(fieldOf(stored as unknown as StoredImportProposal, 'p60t0v0', 'cooling_h')).toMatchObject({ incoming: null, decision: 'pending' });
    expect((await rejectionOf(applyImportProposal(ARIES, stored.id, stored.revision))).kind).toBe('confirmationRequired');
    expect(products()).toHaveLength(0);
  });

  it('η εντολή προς το μοντέλο δεν κουβαλά τη μονάδα του στόχου', async () => {
    const batch = await attachedBatch();
    readPage.mockResolvedValue(reading(2700));
    await readImportPage(ARIES, batch.id, 60);
    expect(JSON.stringify(readPage.mock.calls[0][0].attributes)).not.toContain('kW');
    expect(readPage.mock.calls[0][0].attributes.find((spec) => spec.code === 'model_code')).toMatchObject({ unique: true });
  });

  it('Δ3 + Δ7: δύο σειρές «ΚΩΔΙΚΟΣ» χωρίς κωδικό μοντέλου ενημερώνουν το ζωντανό SKU, κανένα διπλότυπο', async () => {
    const first = await proposeGroup(ARIES, await batchId(), group(MFP_SIZES.map((_, index) => rowFor(index))));
    await applyImportProposal(ARIES, first.id, first.revision);
    const batch = await attachedBatch();
    const printed: CatalogPageReading = {
      kind: 'read', model: 'gpt-4o', rawText: null,
      usage: USED,
      value: { tables: [{ modelCode: { value: null, confidence: 0, sourceTokens: [] }, shared: [], variants: [{ cells: [rawCell('model_code', 'MFP-34ΤΜ'), rawCell('model_code', MFP_PAGE_60.code[0]), rawCell('heating_h', '2800 W')] }] }] },
    };
    readPage.mockResolvedValue(printed);
    await readImportPage(ARIES, batch.id, 60);
    const proposal = (await readImportBatchDetail(ARIES, batch.id)).proposals[0];
    const row = proposal.rows.find((candidate) => candidate.holderKind === 'product');
    expect(proposal.modelCode).toBe('mfp');
    expect(row).toMatchObject({ action: 'update', label: MFP_PAGE_60.code[0], issues: [] });
    expect(products()).toHaveLength(7);
  });

  describe('🔴 πραγματική σελίδα 85: ο διακομιστής διαβάζει, το μοντέλο αντιστοιχίζει', () => {
    const page85 = (): void => {
      mockPdfPage.current = ARIES_PAGES['85'] as typeof EMPTY_PDF_PAGE;
    };
    const tableAnswer = (table: string, lines: RawTableMapping['lines']): RawTableMapping => ({ table, role: 'variants', variantsIn: 'columns', lines, imageCheck: [] });
    const mapping = (lines: RawTableMapping['lines'], imageCheck: RawTableMapping['imageCheck'] = []): CatalogTableMapping => ({
      kind: 'read',
      model: 'gpt-4o',
      rawText: '{}',
      usage: USED,
      value: { tables: [{ ...tableAnswer('t0', lines), imageCheck }, { table: 't1', role: 'accessories', variantsIn: 'rows', lines: [], imageCheck: [] }] },
    });
    /** Οι γραμμές του πραγματικού πλέγματος: H και M της ψύξης, χωρίς καμία τιμή και χωρίς γραμμή κωδικών. */
    const COOLING = [{ line: 5, attribute: 'cooling_h', confidence: 0.95 }, { line: 7, attribute: 'cooling_m', confidence: 0.95 }];

    async function liveCatalogAndBatch() {
      const first = await proposeGroup(ARIES, await batchId(), group(MFP_SIZES.map((_, index) => rowFor(index))));
      await applyImportProposal(ARIES, first.id, first.revision);
      page85();
      return attachedBatch();
    }

    it('7/7 `update` στα ζωντανά SKU, μία κλήση, καμία ανάγνωση τιμών από το μοντέλο, εξαρτήματα στην άκρη', async () => {
      const batch = await liveCatalogAndBatch();
      mapTables.mockResolvedValue(mapping(COOLING));
      const read = await readImportPage(ARIES, batch.id, 60);
      expect(mapTables).toHaveBeenCalledTimes(1);
      expect(readPage).not.toHaveBeenCalled();
      expect(read.pages?.setAside).toEqual([expect.objectContaining({ table: 't1', role: 'accessories' })]);
      const [proposal, ...others] = (await readImportBatchDetail(ARIES, batch.id)).proposals;
      expect(others).toEqual([]);
      expect(proposal.modelCode).toBe('mfp');
      const skus = proposal.rows.filter((row) => row.holderKind === 'product');
      expect(skus.map((row) => row.action)).toEqual(Array(7).fill('update'));
      expect(skus.map((row) => row.label)).toEqual(MFP_PAGE_60.code);
      expect(products()).toHaveLength(7);
    });

    /** Το σχήμα της παραγωγής: φωτογραφία και κατηγορία στη ρίζα, κατηγορία και σε SKU. Γράφουν οι πραγματικοί γραφείς. */
    async function liveCatalogWithReferences() {
      const batch = await liveCatalogAndBatch();
      const assetId = await seedPhoto();
      const categoryId = await seedCategory();
      const [root] = models();
      const photo = { [attributeId('photo')]: { [ANY_SLOT]: { [ANY_SLOT]: { type: 'asset' as const, assetIds: [assetId] } } } };
      await updateCatalogProductModel(ARIES, root.id, root.revision, { code: root.code, familyId: root.familyId, variantSchemeCode: root.variantSchemeCode, parentId: root.parentId, categoryIds: [categoryId], noValueReasons: root.noValueReasons, values: { ...root.values, ...photo }, brand: null });
      const [sku] = products();
      await updateCatalogProduct(ARIES, sku.id, sku.revision, { modelId: sku.modelId, familyId: sku.familyId, categoryIds: [categoryId], noValueReasons: sku.noValueReasons, values: sku.values, brand: null, gtin: null, mpn: null, noGtinReason: null });
      return { batch, assetId, categoryId, skuId: sku.id };
    }

    it('🔴 Τρίτη δοκιμή: ζωντανή φωτογραφία και κατηγορία που η σελίδα δεν αναφέρει δεν βγαίνουν `unknownReference`', async () => {
      const { batch } = await liveCatalogWithReferences();
      mapTables.mockResolvedValue(mapping(COOLING));
      await readImportPage(ARIES, batch.id, 60);
      const [proposal] = (await readImportBatchDetail(ARIES, batch.id)).proposals;
      expect(proposal.rows.filter((row) => row.action === 'update')).toHaveLength(8);
      expect(rowIssues(proposal.rows)).toEqual([]);
    });

    it('🔴 αναφορά που όντως χάθηκε μένει εύρημα: η διόρθωση δεν σβήνει τον κριτή', async () => {
      const { batch, assetId, categoryId, skuId } = await liveCatalogWithReferences();
      fake.seed('catalog_assets', assetId, { ...fake.getAllDocs('catalog_assets')[assetId], isDeleted: true });
      fake.seed('catalog_categories', categoryId, { ...fake.getAllDocs('catalog_categories')[categoryId], isDeleted: true });
      mapTables.mockResolvedValue(mapping(COOLING));
      await readImportPage(ARIES, batch.id, 60);
      const [proposal] = (await readImportBatchDetail(ARIES, batch.id)).proposals;
      const modelRow = proposal.rows.find((row) => row.holderKind === 'productModel');
      const skuRow = proposal.rows.find((row) => row.holderId === skuId);
      expect(modelRow?.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'unknownReference', path: `values.${attributeId('photo')}.${ANY_SLOT}.${ANY_SLOT}.assetIds[0]` }), expect.objectContaining({ code: 'unknownReference', path: 'categoryIds[0]' })]));
      expect(skuRow?.issues).toEqual([expect.objectContaining({ code: 'unknownReference', path: 'categoryIds[0]' })]);
    });

    it('Ε6: κάθε απάντηση φυλάσσεται όπως ήρθε, μαζί με ό,τι ανασυντέθηκε, και το ξαναδιάβασμα γράφει το ίδιο έγγραφο', async () => {
      const batch = await liveCatalogAndBatch();
      mapTables.mockResolvedValue(mapping(COOLING));
      await readImportPage(ARIES, batch.id, 60);
      const [kept, ...rest] = readings();
      expect(rest).toEqual([]);
      expect(kept).toMatchObject({ companyId: ARIES.companyId, batchId: batch.id, page: 60, route: 'table', attempt: 0, model: 'gpt-4o', rawText: '{}', outcome: 'read', abandoned: false, rawTextClipped: false });
      expect((kept as unknown as { tables: readonly { witness: string }[] }).tables.map((table) => table.witness)).toEqual(['agrees', 'agrees']);
    });

    it('Ε6: μένει και η απάντηση που δεν διαβάστηκε: μόνο αυτή εξηγεί την αποτυχία', async () => {
      const batch = await liveCatalogAndBatch();
      const failed: CatalogTableMapping = { kind: 'failed', usage: USED, model: 'gpt-4o', rawText: 'not json' };
      mapTables.mockResolvedValue(failed);
      await readImportPage(ARIES, batch.id, 60);
      expect(readings().map((kept) => (kept as unknown as { outcome: string }).outcome)).toEqual(['failed']);
      expect((readings()[0] as unknown as { rawText: string }).rawText).toBe('not json');
    });

    it('η εικόνα διαψεύδει τη στρώση κειμένου: καμία πρόταση από το πλέγμα, η σελίδα διαβάζεται με όραση, μέσα στο ίδιο όριο', async () => {
      const batch = await liveCatalogAndBatch();
      const seen = [[5, 5], [7, 5], [8, 6]].map(([row, col]) => ({ cell: `r${row}c${col}`, seen: '7' }));
      mapTables.mockResolvedValue(mapping(COOLING, seen));
      readPage.mockResolvedValue(reading(2700));
      await readImportPage(ARIES, batch.id, 60);
      expect(mapTables).toHaveBeenCalledTimes(1);
      expect(readPage).toHaveBeenCalledTimes(1);
      expect(mapTables.mock.calls.length + readPage.mock.calls.length).toBeLessThanOrEqual(2);
    });

    it('Ε5: γραμμή χωρίς μονάδα της ποσότητας ξαναρωτιέται μία φορά, με το εύρημα', async () => {
      const batch = await liveCatalogAndBatch();
      mapTables.mockResolvedValue(mapping([...COOLING, { line: 12, attribute: 'heating_h', confidence: 0.95 }]));
      await readImportPage(ARIES, batch.id, 60);
      expect(mapTables).toHaveBeenCalledTimes(2);
      expect(mapTables.mock.calls[1][0].feedback.join(' ')).toContain('heating_h');
    });

    describe('🚀 §5.5.2 Β3: απόφαση γραμμής ⇒ ξαναερμηνεία χωρίς AI', () => {
      /** Η φυλαγμένη απάντηση όπως τη γράφει ο αναλυτής: το JSON της τιμής που διάβασε. */
      const stored = (lines: RawTableMapping['lines']): CatalogTableMapping => {
        const read = mapping(lines);
        return read.kind === 'read' ? { ...read, rawText: JSON.stringify(read.value) } : read;
      };

      async function readBatch(answer: CatalogTableMapping = stored(COOLING)) {
        const batch = await liveCatalogAndBatch();
        mapTables.mockResolvedValue(answer);
        const read = await readImportPage(ARIES, batch.id, 60);
        const coolingL = read.pages?.unmappedLines?.find((line) => line.values.includes('1134'));
        if (!coolingL) throw new Error('η γραμμή ψύξης L έπρεπε να μείνει χωρίς πεδίο');
        mapTables.mockClear();
        readPage.mockClear();
        return { batch, coolingL };
      }

      const request = (line: { readonly table: string; readonly line: number }, decision: SetImportLineRequest['decision']): SetImportLineRequest =>
        ({ page: 60, table: line.table, line: line.line, decision, bind: null });

      it('🔴 αντιστοίχιση ⇒ τα πεδία μπαίνουν με βεβαιότητα 1, η γραμμή φεύγει, και καμία κλήση μοντέλου', async () => {
        const { batch, coolingL } = await readBatch();
        const before = readings().length;
        const result = await setImportLine(ARIES, batch.id, request(coolingL, { kind: 'attribute', attributeId: attributeId('cooling_l') }));
        expect(result.outcome).toEqual({ kind: 'settled' });
        expect(mapTables).not.toHaveBeenCalled();
        expect(readPage).not.toHaveBeenCalled();
        expect(readings()).toHaveLength(before);
        const [proposal] = result.view.proposals;
        const fields = proposal.rows.flatMap((row) => row.fields).filter((field) => field.target.kind === 'attribute' && field.target.attributeId === attributeId('cooling_l'));
        expect(fields).toHaveLength(7);
        expect(fields.every((field) => field.confidence === 1)).toBe(true);
        expect(result.view.batch.pages?.unmappedLines?.some((line) => line.line === coolingL.line)).toBe(false);
      });

      it('αναίρεση της αντιστοίχισης ⇒ η γραμμή γυρίζει χωρίς πεδίο', async () => {
        const { batch, coolingL } = await readBatch();
        await setImportLine(ARIES, batch.id, request(coolingL, { kind: 'attribute', attributeId: attributeId('cooling_l') }));
        const undone = await setImportLine(ARIES, batch.id, request(coolingL, null));
        expect(undone.outcome).toEqual({ kind: 'settled' });
        expect(undone.view.batch.pages?.unmappedLines?.some((line) => line.line === coolingL.line)).toBe(true);
        expect(undone.view.batch.pages?.lineOverrides ?? []).toEqual([]);
      });

      it('αγνόηση: μόνο κατάσταση — η γραμμή μένει δηλωμένη, η απόφαση φυλάσσεται, ιδεμπότητη', async () => {
        const { batch, coolingL } = await readBatch();
        await setImportLine(ARIES, batch.id, request(coolingL, { kind: 'ignore' }));
        const again = await setImportLine(ARIES, batch.id, request(coolingL, { kind: 'ignore' }));
        expect(again.view.batch.pages?.lineOverrides).toEqual([expect.objectContaining({ page: 60, table: coolingL.table, line: coolingL.line, decision: { kind: 'ignore' } })]);
        expect(again.view.batch.pages?.unmappedLines?.some((line) => line.line === coolingL.line)).toBe(true);
      });

      it('🔴 η πιο πρόσφατη ανάγνωση κατά χρόνο, όχι κατά δοκιμή: παλιά δεύτερη δοκιμή δεν κρίνει', async () => {
        const { batch, coolingL } = await readBatch();
        const staleId = generateDeterministicCatalogImportPageReadingId(ARIES.companyId, importPageReadingKey(batch.id, 60, 'table', 1));
        fake.seed('catalog_import_page_readings', staleId, { companyId: ARIES.companyId, batchId: batch.id, page: 60, route: 'table', attempt: 1, model: 'gpt-4o', rawText: 'not json', outcome: 'read', abandoned: false, rawTextClipped: false, usage: USED, feedback: [], tables: [], createdAt: '2000-01-01T00:00:00.000Z', createdBy: 'old' });
        const result = await setImportLine(ARIES, batch.id, request(coolingL, { kind: 'attribute', attributeId: attributeId('cooling_l') }));
        expect(result.outcome).toEqual({ kind: 'settled' });
      });

      it('φυλαγμένη απάντηση που δεν διαβάζεται ⇒ άρνηση `readingMissing`, τίποτα δεν γράφεται', async () => {
        const { batch, coolingL } = await readBatch(mapping(COOLING));
        const result = await setImportLine(ARIES, batch.id, request(coolingL, { kind: 'attribute', attributeId: attributeId('cooling_l') }));
        expect(result.outcome).toEqual({ kind: 'refused', reason: 'readingMissing' });
        expect(result.view.batch.pages?.lineOverrides).toBeUndefined();
      });

      it('🔴 η ανασύνθεση άλλαξε ⇒ άρνηση `tablesDrifted`: οι αριθμοί γραμμών δεν σημαίνουν πια το ίδιο', async () => {
        const { batch, coolingL } = await readBatch();
        mockPdfPage.current = ARIES_PAGES['86'] as typeof EMPTY_PDF_PAGE;
        const result = await setImportLine(ARIES, batch.id, request(coolingL, { kind: 'attribute', attributeId: attributeId('cooling_l') }));
        expect(result.outcome).toEqual({ kind: 'refused', reason: 'tablesDrifted' });
        expect(result.view.batch.pages?.lineOverrides).toBeUndefined();
      });

      it('πρόταση που απορρίφθηκε ⇒ άρνηση `proposalClosed`', async () => {
        const { batch, coolingL } = await readBatch();
        const [proposal] = (await readImportBatchDetail(ARIES, batch.id)).proposals;
        await rejectImportProposal(ARIES, proposal.id, proposal.revision);
        const result = await setImportLine(ARIES, batch.id, request(coolingL, { kind: 'ignore' }));
        expect(result.outcome).toEqual({ kind: 'refused', reason: 'proposalClosed' });
      });

      it('σελίδα που διαβάστηκε με όραση ⇒ άρνηση `readingVision`', async () => {
        const batch = await liveCatalogAndBatch();
        const seen = [[5, 5], [7, 5], [8, 6]].map(([row, col]) => ({ cell: `r${row}c${col}`, seen: '7' }));
        mapTables.mockResolvedValue(mapping(COOLING, seen));
        readPage.mockResolvedValue(reading(2700));
        await readImportPage(ARIES, batch.id, 60);
        const result = await setImportLine(ARIES, batch.id, request({ table: 't0', line: 9 }, { kind: 'attribute', attributeId: attributeId('cooling_l') }));
        expect(result.outcome).toEqual({ kind: 'refused', reason: 'readingVision' });
      });

      it('🔒 δομικά χωρίς πληρωμή: η ξαναερμηνεία δεν εισάγει τον αναλυτή', () => {
        const source = readFileSync(join(__dirname, '..', 'import-page-reinterpret.server.ts'), 'utf8');
        expect(source).not.toMatch(/page-analyzer/);
      });
    });
  });

  it('κακή απάντηση: η σελίδα μετρά αποτυχημένη, χωρίς πρόταση, και ξαναδοκιμάζεται', async () => {
    const batch = await attachedBatch();
    readPage.mockResolvedValueOnce({ kind: 'failed', usage: USED, model: 'gpt-4o', rawText: null });
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
    readPage.mockResolvedValue({ kind: 'read', model: 'gpt-4o', rawText: null, value: { tables: [] }, usage: USED });
    await readImportPage(ARIES, batch.id, 60);
    expect((await readImportPage(ARIES, batch.id, 61)).status).toBe('reviewing');
  });
});
