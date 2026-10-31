/**
 * Ο καθαρός πυρήνας του αγωγού εισαγωγής (ADR-923 §5.5.1), πάνω στα **πραγματικά** δεδομένα MFP της Φάσης 0.
 * Το σενάριο-άγκυρα: η μετατόπιση της θέρμανσης H/M που διάβασε το gpt-4o (§21.3) πιάνεται ΠΡΙΝ τη δει άνθρωπος.
 */

import { normalizeMixedScriptHomoglyphs } from '@/utils/greek-text';
import { schemaSnapshotOf } from '../../aggregate/edit-aggregate';
import { AI_SHIFTED_HEATING, MFP_ASSETS, MFP_PAGE_60, MFP_SETTINGS, mfpVariant } from '../../__tests__/fixtures/mfp-fan-coil-products.fixture';
import { MFP_ATTRIBUTE_MAP, MFP_FAMILY, MFP_SIZES } from '../../__tests__/fixtures/mfp-fan-coil.fixture';
import { PLATFORM_MEASUREMENT_REGISTRY } from '../../measurement/measurement-registry';
import type { ExtractedCell, ExtractedGroup, ExtractedRow, ImportFieldValue, ImportProfileDefinition, ImportProposalField } from '../../types/catalog-import';
import { ANY_SLOT } from '../../types/product';
import { extractGroupsFromTable, resolveColumns } from '../apply-column-rules';
import { buildAttributeRows, type AttributeProposalContext } from '../build-attribute-proposal';
import { buildPriceRows } from '../build-price-proposal';
import { defaultDecisionOf, fieldStatusOf } from '../field-diff';
import { importBatchKey, importProposalKey } from '../import-keys';
import { judgeProposal } from '../judge-proposal';
import { extractGroupsFromPage, pageExtractionSchema, type PageExtractionContext } from '../page-extraction';
import { anchorForCell, misalignedCells, tokenizePage, type AlignedRow } from '../page-tokens';

const schema = schemaSnapshotOf({ family: MFP_FAMILY, attributes: MFP_ATTRIBUTE_MAP, registry: PLATFORM_MEASUREMENT_REGISTRY, settings: MFP_SETTINGS, variantSchemeCode: 'by_size' });
const text = { registry: PLATFORM_MEASUREMENT_REGISTRY, language: 'el' as const, assetIdByCode: new Map(), assetCodeById: new Map(), yes: 'Ναι', no: 'Όχι' };
const refs = { assets: MFP_ASSETS, categories: new Set(['cat_fan_coils']), references: new Map() };

const cell = (attributeId: string, value: string | null, unitCode: string | null = null, confidence = 1): ExtractedCell => ({
  target: { kind: 'attribute', attributeId, channel: ANY_SLOT, locale: ANY_SLOT },
  text: value,
  confidence,
  anchor: null,
  unitCode,
  flags: [],
});

const rowFor = (index: number, heating: { readonly h: number; readonly m: number }): ExtractedRow => ({
  rowKey: `r${index}`,
  cells: [
    cell('size', MFP_SIZES[index]),
    cell('model_code', MFP_PAGE_60.code[index]),
    cell('cooling_h', String(MFP_PAGE_60.cooling_h[index]), 'W'),
    cell('cooling_m', String(MFP_PAGE_60.cooling_m[index]), 'W'),
    cell('cooling_l', String(MFP_PAGE_60.cooling_l[index]), 'W'),
    cell('heating_h', String(heating.h), 'W'),
    cell('heating_m', String(heating.m), 'W'),
    cell('heating_l', String(MFP_PAGE_60.heating_l[index]), 'W'),
    cell('power_supply', '230V-50Hz-1Ph'),
  ],
});

const groupOf = (rows: readonly ExtractedRow[]): ExtractedGroup => ({ groupKey: 'model:mfp_tm:0', modelCode: 'mfp_tm', sharedCells: [], rows, pages: [] });
const noLive: AttributeProposalContext = { schema, text, model: null, matches: new Map(), base: new Map() };
const judge = (group: ExtractedGroup, context = noLive) =>
  judgeProposal({ rows: buildAttributeRows(group, context), modelCode: group.modelCode, familyId: 'fan_coil', categoryIds: [], holdings: { rootModel: null, products: new Map() }, schema, refs });

describe('ομοιόμορφα γράμματα', () => {
  it.each([
    ['ΣΥΝΤΑΞH', 'ΣΥΝΤΑΞΗ'],
    ['ΒΑC', 'BAC'],
    ['MAXI CONDENS', 'MAXI CONDENS'],
    ['ΚΩΔΙΚΟΣ', 'ΚΩΔΙΚΟΣ'],
    ['016-15-001Γ', '016-15-001Γ'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeMixedScriptHomoglyphs(input)).toBe(expected);
  });

  it('δεν μαντεύει όταν κανένα αλφάβητο δεν στέκει', () => {
    expect(normalizeMixedScriptHomoglyphs('ΓC')).toBe('ΓC');
  });
});

describe('σύγκριση τριών σημείων', () => {
  const same = (a: ImportFieldValue, b: ImportFieldValue): boolean => JSON.stringify(a) === JSON.stringify(b);
  const v = (amount: string): ImportFieldValue => ({ type: 'number', amount });

  it.each([
    ['πρώτη φορά', v('1'), null, null, 'new'],
    ['ίδια', v('1'), v('1'), null, 'unchanged'],
    ['χωρίς βάση', v('2'), v('1'), null, 'changed'],
    ['άλλαξε μόνο η πηγή', v('2'), v('1'), v('1'), 'changed'],
    ['άλλαξε μόνο ο άνθρωπος', v('1'), v('3'), v('1'), 'unchanged'],
    ['άλλαξαν και οι δύο', v('2'), v('3'), v('1'), 'conflict'],
  ])('%s', (_label, incoming, live, base, expected) => {
    expect(fieldStatusOf(incoming, live, base, same)).toBe(expected);
  });

  const facts = { status: 'changed', confidence: 1, issues: [], anchor: null, incoming: v('1') } as const;

  it('χρειάζεται άνθρωπο όταν υπάρχει σύγκρουση, εύρημα, χαμηλή βεβαιότητα ή διάψευση', () => {
    expect(defaultDecisionOf(facts)).toBe('accept');
    expect(defaultDecisionOf({ ...facts, status: 'conflict' })).toBe('pending');
    expect(defaultDecisionOf({ ...facts, confidence: 0.84 })).toBe('pending');
    expect(defaultDecisionOf({ ...facts, issues: [{ code: 'misaligned', path: 'x' }] })).toBe('pending');
    expect(defaultDecisionOf({ ...facts, anchor: { kind: 'page', page: 1, regions: [], verified: false } })).toBe('pending');
  });

  it('αμετάβλητο ή αδιάβαστο δεν γράφεται ποτέ', () => {
    expect(defaultDecisionOf({ ...facts, status: 'unchanged' })).toBe('reject');
    expect(defaultDecisionOf({ ...facts, incoming: null })).toBe('reject');
  });
});

describe('κλειδιά ιδεμποτίας', () => {
  const input = { contentSha256: 'abc', target: { purpose: 'attributes', familyId: 'f', variantSchemeCode: 's', categoryIds: [] }, profileId: 'p', profileRevision: 1, run: 0 } as const;

  it('ίδια είσοδος ⇒ ίδιο κλειδί', () => {
    expect(importBatchKey(input)).toBe(importBatchKey({ ...input }));
  });

  it('διορθωμένο προφίλ ή ρητή επανεκτέλεση ⇒ νέο κλειδί', () => {
    expect(importBatchKey({ ...input, profileRevision: 2 })).not.toBe(importBatchKey(input));
    expect(importBatchKey({ ...input, run: 1 })).not.toBe(importBatchKey(input));
  });

  it('το κλειδί πρότασης δένεται στην παρτίδα', () => {
    expect(importProposalKey('b1', 'g')).not.toBe(importProposalKey('b2', 'g'));
  });
});

describe('αντιστοίχιση αρχείου', () => {
  const profile: ImportProfileDefinition = {
    code: 'aries_prices', label: 'Aries', purpose: 'attributes', supplierContactId: null, familyId: 'fan_coil', skipRows: 0, sheetIndex: 0,
    columns: [
      { header: 'Μοντέλο', position: 0, target: { kind: 'modelCode' }, unitCode: null },
      { header: 'Κωδικός', position: 1, target: { kind: 'attribute', attributeId: 'model_code', channel: ANY_SLOT, locale: ANY_SLOT }, unitCode: null },
      { header: 'Ισχύς', position: 2, target: { kind: 'attribute', attributeId: 'cooling_h', channel: ANY_SLOT, locale: ANY_SLOT }, unitCode: 'kW' },
      { header: 'Σχόλια', position: 3, target: null, unitCode: null },
    ],
  };

  it('βρίσκει τη στήλη με την ετικέτα, όπου κι αν μετακινήθηκε, και ομαδοποιεί ανά μοντέλο', () => {
    const table = { headers: ['Ισχύς', 'Κωδικός', 'Μοντέλο'], rows: [['1,8', '099-01-001', 'mfp'], ['2,7', '099-01-002', 'mfp'], ['', '', '']] };
    const groups = extractGroupsFromTable(table, profile);
    expect(groups).toHaveLength(1);
    expect(groups[0].modelCode).toBe('mfp');
    expect(groups[0].rows).toHaveLength(2);
    expect(groups[0].rows[0].cells.find((c) => c.unitCode === 'kW')?.text).toBe('1,8');
    expect(groups[0].rows[0].cells.find((c) => c.unitCode === 'kW')?.anchor).toEqual({ kind: 'cell', row: 2, column: 1 });
  });

  it('στήλη που έλειψε δεν περνά σιωπηλά', () => {
    expect(resolveColumns(profile, ['Κωδικός']).missing.map((rule) => rule.header)).toEqual(['Μοντέλο', 'Ισχύς']);
  });

  it('χωρίς επικεφαλίδα μετρά η θέση', () => {
    expect(resolveColumns({ columns: [{ ...profile.columns[1], header: '' }] }, []).columns[0].index).toBe(1);
  });
});

describe('το κείμενο της σελίδας ως απόδειξη', () => {
  const tokens = new Map(tokenizePage([{ text: '016–15–001 2,5 kW', x: 0.1, y: 0.2, width: 0.34, height: 0.01 }]).map((t) => [t.id, t]));

  it('χωρίζει τη γραμμή σε λέξεις με μετρημένη θέση', () => {
    expect([...tokens.values()].map((t) => t.text)).toEqual(['016–15–001', '2,5', 'kW']);
    expect(tokens.get('t2')?.x).toBeCloseTo(0.1 + 0.34 * (11 / 17));
  });

  it('επιβεβαιώνει τον κωδικό παρά τις παύλες, και το ποσό μέσα από τη μονάδα', () => {
    expect(anchorForCell(60, '016-15-001', ['t1'], tokens)).toMatchObject({ verified: true, page: 60 });
    expect(anchorForCell(60, '2,50 kW', ['t2', 't3'], tokens)).toMatchObject({ verified: true });
  });

  it('διαψεύδει τιμή που δεν λέει το κομμάτι, ή κομμάτι που επινόησε η AI', () => {
    expect(anchorForCell(60, '3,5', ['t2'], tokens)).toMatchObject({ verified: false });
    expect(anchorForCell(60, '2,5', ['t999'], tokens)).toMatchObject({ verified: false });
    expect(anchorForCell(60, '2,5', ['t2', 't999'], tokens)).toMatchObject({ verified: false });
    expect(anchorForCell(60, '2,5', [], tokens)).toMatchObject({ verified: false });
  });

  it('σαρωμένη σελίδα: δεν κρίνεται, δεν επιβεβαιώνεται', () => {
    expect(anchorForCell(60, '2,5', [], new Map())).toEqual({ kind: 'page', page: 60, regions: [], verified: null });
  });

  it('πιάνει την τιμή που ξέφυγε από τη στήλη της παραλλαγής', () => {
    const column = (rowKey: string, x: number, stray = x): AlignedRow => ({
      rowKey,
      centers: new Map([['a', { x, y: 0.1 }], ['b', { x, y: 0.2 }], ['c', { x, y: 0.3 }], ['d', { x: stray, y: 0.4 }]]),
    });
    expect([...misalignedCells([column('v1', 0.3), column('v2', 0.5, 0.7)])]).toEqual([['v2', ['d']]]);
    expect(misalignedCells([column('v1', 0.3), column('v2', 0.5)]).size).toBe(0);
  });

  it('τιμή που δεν διασταυρώθηκε χάνει τη βεβαιότητα που δήλωσε το μοντέλο', () => {
    const attributesByCode = new Map([['cooling_h', { ...MFP_ATTRIBUTE_MAP.get('cooling_h')!, id: 'cooling_h' }]]);
    const context: PageExtractionContext = { page: 60, tokens, attributesByCode };
    const raw = { tables: [{ modelCode: { value: 'ΒΑC', confidence: 1, sourceTokens: [] }, shared: [], variants: [{ cells: [{ attribute: 'cooling_h', value: '3,5', confidence: 0.99, sourceTokens: ['t2'] }, { attribute: 'ghost', value: '1', confidence: 1, sourceTokens: [] }] }] }] };
    const [group] = extractGroupsFromPage(raw, context);
    expect(group.modelCode).toBe('BAC');
    expect(group.rows[0].cells).toHaveLength(1);
    expect(group.rows[0].cells[0].confidence).toBeLessThan(0.85);
  });

  it('το σχήμα είναι strict: όλα required, κανένα επιπλέον πεδίο', () => {
    const schemaJson = JSON.stringify(pageExtractionSchema(['cooling_h']));
    expect(schemaJson).toContain('"enum":["cooling_h"]');
    expect(schemaJson.match(/"additionalProperties":false/g)).toHaveLength(schemaJson.match(/"type":"object"/g)?.length ?? -1);
  });
});

describe('πρόταση ιδιοτήτων — κριτής ΠΡΙΝ από τον άνθρωπο', () => {
  const faithful = MFP_SIZES.map((_, i) => rowFor(i, { h: MFP_PAGE_60.heating_h[i], m: MFP_PAGE_60.heating_m[i] }));
  const shifted = MFP_SIZES.map((_, i) => rowFor(i, { h: AI_SHIFTED_HEATING.heating_h[i], m: AI_SHIFTED_HEATING.heating_m[i] }));
  const fieldsOf = (rows: ReturnType<typeof judge>['rows'], attributeId: string): ImportProposalField[] =>
    rows.flatMap((row) => row.fields).filter((field) => field.target.kind === 'attribute' && field.target.attributeId === attributeId);

  it('πιστή ανάγνωση: κανένας κανόνας, όλα αποδεκτά, η κοινή ιδιότητα ανέβηκε στο μοντέλο μία φορά', () => {
    const { rows, violations } = judge(groupOf(faithful));
    expect(violations).toEqual([]);
    expect(rows[0]).toMatchObject({ holderKind: 'productModel', action: 'create' });
    expect(fieldsOf(rows, 'power_supply')).toHaveLength(1);
    expect(fieldsOf(rows, 'heating_h').every((field) => field.decision === 'accept')).toBe(true);
  });

  it('η μετατόπιση H/M της AI: σημαία σε ΚΑΘΕ παραλλαγή, απόφαση ανθρώπου, χωρίς καμία αλήθεια αναφοράς', () => {
    const { rows, violations } = judge(groupOf(shifted));
    const heating = violations.filter((violation) => violation.ruleId === 'rule_heat_hml');
    expect(heating.flatMap((violation) => violation.variantIds).sort()).toEqual(['r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6']);
    expect(fieldsOf(rows, 'heating_m').every((field) => field.decision === 'pending' && field.issues.some((issue) => issue.code === 'consistencyRuleViolated'))).toBe(true);
  });

  it('ο πραγματικός διπλός κωδικός πιάνεται στην πρόταση', () => {
    const duplicated = [faithful[0], { ...faithful[1], cells: faithful[1].cells.map((c) => (c.target.kind === 'attribute' && c.target.attributeId === 'model_code' ? { ...c, text: MFP_PAGE_60.code[0] } : c)) }];
    expect(judge(groupOf(duplicated)).violations.some((violation) => violation.ruleId === 'rule_unique_code')).toBe(true);
  });

  it('οι κοινές τιμές που διαφωνούν είναι εύρημα, όχι σιωπηλή επιλογή', () => {
    const rows = [faithful[0], { ...faithful[1], cells: faithful[1].cells.map((c) => (c.text === '230V-50Hz-1Ph' ? { ...c, text: '400V' } : c)) }];
    const [field] = fieldsOf(buildAttributeRows(groupOf(rows), noLive), 'power_supply');
    expect(field).toMatchObject({ decision: 'pending', issues: [{ code: 'sharedDisagrees' }] });
  });

  it('ίδια ισχύς σε άλλη μονάδα είναι αμετάβλητο, όχι αλλαγή', () => {
    const live = { id: 'cpr_1', revision: 3, values: mfpVariant(0).values };
    const row: ExtractedRow = { rowKey: 'r0', cells: [cell('cooling_h', '1,8', 'kW')] };
    const [variant] = buildAttributeRows(groupOf([row]), { ...noLive, matches: new Map([['r0', live]]) }).filter((r) => r.holderKind === 'product');
    expect(variant).toMatchObject({ action: 'update', holderId: 'cpr_1', expectedRevision: 3 });
    expect(variant.fields[0]).toMatchObject({ status: 'unchanged', decision: 'reject' });
  });

  it('η μονάδα της στήλης ντύνει τον γυμνό αριθμό', () => {
    const row: ExtractedRow = { rowKey: 'r0', cells: [cell('cooling_h', '1800', 'W'), cell('cooling_m', '1,8', 'kW')] };
    const fields = buildAttributeRows(groupOf([row]), noLive).flatMap((r) => r.fields);
    expect(fields.map((field) => field.incoming)).toEqual([
      { type: 'measurement', amount: '1800', unitCode: 'W' },
      { type: 'measurement', amount: '1.8', unitCode: 'kW' },
    ]);
  });

  it('χωρίς κωδικό μοντέλου: εύρημα στη γραμμή', () => {
    const [model] = buildAttributeRows({ ...groupOf(faithful), modelCode: null }, noLive);
    expect(model.issues[0].code).toBe('modelCodeMissing');
  });

  it('κενό κελί δεν είναι διαγραφή: δεν γίνεται πεδίο', () => {
    const row: ExtractedRow = { rowKey: 'r0', cells: [cell('cooling_h', null, 'W')] };
    expect(fieldsOf(buildAttributeRows(groupOf([row]), noLive), 'cooling_h')).toEqual([]);
  });
});

describe('«μόνο τιμές»', () => {
  const priceCell = (field: 'netPrice' | 'priceQuantity' | 'unitCode' | 'discountGroup', value: string): ExtractedCell => ({ target: { kind: 'price', field }, text: value, confidence: 1, anchor: null, unitCode: null, flags: [] });
  const sku = (code: string): ExtractedCell => ({ target: { kind: 'skuIdentifier' }, text: code, confidence: 1, anchor: null, unitCode: null, flags: [] });
  const line = { netPrice: 10000, priceQuantity: 1, unitCode: 'PCE', discountGroupId: null } as const;
  const context = { variantIdByRow: new Map([['r1', 'v1']]), liveLines: new Map([['v1', line]]), baseLines: new Map([['v1', line]]), discountGroupIdByCode: new Map([['tosh', 'dg1']]) };
  const group = (cells: readonly ExtractedCell[]): ExtractedGroup => ({ groupKey: 'prices:0', modelCode: null, sharedCells: [], rows: [{ rowKey: 'r1', cells }], pages: [] });

  it('διαβάζει ποσό ελληνικής μορφής σε λεπτά και κρίνει τη διαφορά', () => {
    const [row] = buildPriceRows(group([sku('A'), priceCell('netPrice', '1.234,50 €')]), context);
    expect(row).toMatchObject({ action: 'update', holderId: 'v1', label: 'A' });
    expect(row.fields[0]).toMatchObject({ incoming: { type: 'money', minor: 123450 }, status: 'changed', decision: 'accept' });
  });

  it('χέρι μέσα στην πρόχειρη + άλλη τιμή στο αρχείο ⇒ σύγκρουση', () => {
    const edited = { ...context, liveLines: new Map([['v1', { ...line, netPrice: 11000 }]]) };
    expect(buildPriceRows(group([sku('A'), priceCell('netPrice', '120')]), edited)[0].fields[0]).toMatchObject({ status: 'conflict', decision: 'pending' });
  });

  it('άγνωστος κωδικός: εύρημα, και τα πεδία του δεν εφαρμόζονται', () => {
    const [row] = buildPriceRows(group([sku('ΧΧΧ'), priceCell('netPrice', '10')]), { ...context, variantIdByRow: new Map() });
    expect(row.issues.map((issue) => issue.code)).toContain('skuUnknown');
    expect(row.fields[0].decision).toBe('reject');
  });

  it('νέα γραμμή χωρίς μονάδα δεν γεννιέται στα κρυφά', () => {
    const [row] = buildPriceRows(group([sku('A'), priceCell('netPrice', '10')]), { ...context, liveLines: new Map() });
    expect(row.issues).toEqual([{ code: 'priceIncomplete', path: 'unitCode' }]);
  });

  it('άκυρη ομάδα έκπτωσης και ποσότητα είναι ευρήματα', () => {
    const [row] = buildPriceRows(group([sku('A'), priceCell('discountGroup', 'άγνωστη'), priceCell('priceQuantity', '7')]), context);
    expect(row.fields.map((field) => field.issues[0]?.code)).toEqual(['unknownReference', 'priceQuantityInvalid']);
  });
});
