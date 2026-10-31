/**
 * Οι άγκυρες της πρώτης δοκιμής στην παραγωγή (ADR-923 §5.5.1 Δ1–Δ7), πάνω στο **πραγματικό** κείμενο των σελίδων 85–86 της
 * Aries. Το κείμενο είναι μετρημένο· ό,τι «απαντά το μοντέλο» το ορίζει κάθε test, χωρίς καμία πληρωμένη κλήση.
 *
 * 🔴 Η κεντρική άγκυρα: στη σελίδα 86 το «1000» με στήλη W έγινε «1000 kW» με βεβαιότητα 100%, γιατί ο γυμνός αριθμός έπαιρνε τη
 * μονάδα της ιδιότητας. Αν γυρίσει η σιωπηλή προεπιλογή, κοκκινίζει το πρώτο test.
 */

import { schemaSnapshotOf } from '../../aggregate/edit-aggregate';
import { ARIES_PAGE_ITEMS } from '../../__tests__/fixtures/aries-pages.fixture';
import { MFP_ASSETS, MFP_SETTINGS } from '../../__tests__/fixtures/mfp-fan-coil-products.fixture';
import { MFP_ATTRIBUTE_MAP, MFP_FAMILY } from '../../__tests__/fixtures/mfp-fan-coil.fixture';
import { PLATFORM_MEASUREMENT_REGISTRY } from '../../measurement/measurement-registry';
import type { ExtractedGroup, ImportProposalField } from '../../types/catalog-import';
import { buildAttributeRows, type AttributeProposalContext } from '../build-attribute-proposal';
import { suggestModelCode } from '../cell-identity';
import { judgeProposal } from '../judge-proposal';
import { extractGroupsFromPage, pageExtractionPrompt, pageExtractionSchema, type PageExtractionContext, type RawPageCell } from '../page-extraction';
import { anchorForCell, tokenizePage, unitConfirmed, type PageToken } from '../page-tokens';

const schema = schemaSnapshotOf({ family: MFP_FAMILY, attributes: MFP_ATTRIBUTE_MAP, registry: PLATFORM_MEASUREMENT_REGISTRY, settings: MFP_SETTINGS, variantSchemeCode: 'by_size' });
const text = { registry: PLATFORM_MEASUREMENT_REGISTRY, language: 'el' as const, assetIdByCode: new Map(), assetCodeById: new Map(), yes: 'Ναι', no: 'Όχι' };
const noLive: AttributeProposalContext = { schema, text, model: null, matches: new Map(), base: new Map() };
const refs = { assets: MFP_ASSETS, categories: new Set(['cat_fan_coils']), references: new Map() };

const tokensOf = (page: 85 | 86): readonly PageToken[] => tokenizePage(ARIES_PAGE_ITEMS[page]);
const mapOf = (tokens: readonly PageToken[]) => new Map(tokens.map((token) => [token.id, token]));

/** Το id του κομματιού που τυπώνει αυτό το κείμενο: η απόδειξη που θα έδειχνε ένα ειλικρινές μοντέλο. */
function idOf(tokens: readonly PageToken[], printed: string): string {
  const found = tokens.find((token) => token.text === printed);
  if (!found) throw new Error(`η σελίδα δεν τυπώνει «${printed}»`);
  return found.id;
}

const attributesByCode = new Map([...MFP_ATTRIBUTE_MAP].map(([id, attribute]) => [attribute.code, { ...attribute, id }]));
const contextOf = (page: 85 | 86): PageExtractionContext => ({ page, tokens: mapOf(tokensOf(page)), attributesByCode });

function raw(attribute: string, value: string, sourceTokens: readonly string[], unit: string | null = null, unitTokens: readonly string[] = []): RawPageCell {
  return { attribute, value, confidence: 1, sourceTokens, unit, unitTokens };
}

const noCode = { value: null, confidence: 0, sourceTokens: [] };

function groupOf(page: 85 | 86, cells: readonly RawPageCell[]): ExtractedGroup {
  const [group] = extractGroupsFromPage({ tables: [{ modelCode: noCode, shared: [], variants: [{ cells }] }] }, contextOf(page));
  return group;
}

function fieldsFor(group: ExtractedGroup, attributeId: string): readonly ImportProposalField[] {
  return buildAttributeRows({ ...group, modelCode: 'mfp' }, noLive).flatMap((row) => row.fields).filter((field) => field.target.kind === 'attribute' && field.target.attributeId === attributeId);
}

const page86 = tokensOf(86);
const page85 = tokensOf(85);
const WATT = idOf(page86, 'W');
const THOUSAND = idOf(page86, '1000');
const issueCodes = (field: ImportProposalField): readonly string[] => field.issues.map((issue) => issue.code);

describe('Δ1 + Δ2: η μονάδα διαβάζεται όπως τυπώνεται', () => {
  it('🔴 «1000» χωρίς διαβασμένη μονάδα: καμία τιμή, απόφαση ανθρώπου, ποτέ «1000 kW»', () => {
    const [field] = fieldsFor(groupOf(86, [raw('cooling_h', '1000', [THOUSAND])]), 'cooling_h');
    expect(field.incoming).toBeNull();
    expect(field.decision).toBe('pending');
    expect(issueCodes(field)).toEqual(['measurementUnitMissing']);
  });

  it('η μονάδα της σελίδας δίνει την τιμή, στη μονάδα της πηγής', () => {
    const [field] = fieldsFor(groupOf(86, [raw('cooling_h', '1000', [THOUSAND], 'W', [WATT])]), 'cooling_h');
    expect(field.incoming).toEqual({ type: 'measurement', amount: '1000', unitCode: 'W' });
    expect(field).toMatchObject({ decision: 'accept', sourceText: '1000 W', issues: [] });
  });

  it('το μοντέλο λέει kW, η σελίδα τυπώνει W: η βεβαιότητα του 100% δεν μετρά', () => {
    const [field] = fieldsFor(groupOf(86, [raw('cooling_h', '1000', [THOUSAND], 'kW', [WATT])]), 'cooling_h');
    expect(field.decision).toBe('pending');
    expect(field.issues).toEqual([{ code: 'unitUnconfirmed', path: 'cooling_h', params: { unit: 'kW' } }]);
  });

  it('μονάδα γραμμένη μέσα στην τιμή κρίνεται το ίδιο', () => {
    const [field] = fieldsFor(groupOf(86, [raw('cooling_h', '1000 kW', [THOUSAND])]), 'cooling_h');
    expect(issueCodes(field)).toEqual(['unitUnconfirmed']);
    expect(field.decision).toBe('pending');
  });

  it('μονάδα μέσα στην τιμή που διαφωνεί με τη δηλωμένη δεν περνά', () => {
    const [field] = fieldsFor(groupOf(86, [raw('cooling_h', '1000 kW', [THOUSAND], 'W', [WATT])]), 'cooling_h');
    expect(issueCodes(field)).toEqual(['unitUnconfirmed']);
  });

  it('σαρωμένη σελίδα: η μονάδα δεν επιβεβαιώνεται από πουθενά, άρα τη βλέπει άνθρωπος', () => {
    const [group] = extractGroupsFromPage({ tables: [{ modelCode: noCode, shared: [], variants: [{ cells: [raw('cooling_h', '1000', [], 'W')] }] }] }, { ...contextOf(86), tokens: new Map() });
    expect(issueCodes(fieldsFor(group, 'cooling_h')[0])).toEqual(['unitUnconfirmed']);
  });

  it('το PDF σπάει το m³/h σε κομμάτια, και το «³» δεν το αγνοεί', () => {
    const cited = ['m', '³', '/h'].map((printed) => idOf(page86, printed));
    expect(unitConfirmed('m³/h', cited, mapOf(page86))).toBe(true);
    expect(unitConfirmed('m3/h', cited, mapOf(page86))).toBe(true);
    expect(unitConfirmed('h', cited, mapOf(page86))).toBe(false);
  });

  it('το «W» δεν επιβεβαιώνεται μέσα σε άλλη μονάδα, ούτε από κομμάτι που δεν υπάρχει', () => {
    const tokens = mapOf(tokenizePage([{ text: 'kW W/m²', x: 0, y: 0, width: 1, height: 1 }]));
    expect(unitConfirmed('W', ['t1'], tokens)).toBe(false);
    expect(unitConfirmed('W', ['t2'], tokens)).toBe(false);
    expect(unitConfirmed('kW', ['t1'], tokens)).toBe(true);
    expect(unitConfirmed('kW', ['t1', 't99'], tokens)).toBe(false);
  });

  it('η διασταύρωση κρίνει τον αριθμό ολόκληρο: μετατροπή ή αποκοπή δεν επιβεβαιώνεται', () => {
    const tokens = mapOf(page85);
    const printed = idOf(page85, '1458');
    expect(anchorForCell(85, '1458', [printed], tokens)).toMatchObject({ verified: true });
    expect(anchorForCell(85, '1,46', [printed], tokens)).toMatchObject({ verified: false });
    expect(anchorForCell(85, '145', [printed], tokens)).toMatchObject({ verified: false });
  });

  it('το μοντέλο υποχρεώνεται να δηλώσει τη μονάδα, και η εντολή απαγορεύει τη μαντεψιά', () => {
    expect(JSON.stringify(pageExtractionSchema(['cooling_h']))).toContain('"required":["attribute","value","unit","unitTokens","confidence","sourceTokens"]');
    const prompt = pageExtractionPrompt([{ code: 'cooling_h', label: 'Ψύξη H', description: null, type: 'measurement', level: 'variant', unique: false, options: [] }], [], []);
    expect(prompt).not.toMatch(/\bunit\b/);
  });
});

describe('Δ4: μία τιμή ανά ιδιότητα', () => {
  const btu = raw('cooling_h', '3412', [idOf(page86, '3412')], 'Btu/h', [idOf(page86, 'Btu/h')]);
  const watts = raw('cooling_h', '1000', [THOUSAND], 'W', [WATT]);

  it('ίδιο μέγεθος σε δύο μονάδες που συμφωνούν: ένα πεδίο, χωρίς εύρημα, στην πρώτη τυπωμένη μονάδα', () => {
    const fields = fieldsFor(groupOf(86, [watts, btu]), 'cooling_h');
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({ incoming: { amount: '1000', unitCode: 'W' }, decision: 'accept', issues: [] });
  });

  it('σφάλμα ×1000 στη μία μονάδα: η άλλη το καταγγέλλει', () => {
    const wrong = raw('cooling_h', '1', [THOUSAND], 'kW', [WATT]);
    const doubled = raw('cooling_h', '34120', [idOf(page86, '3412')], 'Btu/h', [idOf(page86, 'Btu/h')]);
    const [field] = fieldsFor(groupOf(86, [watts, doubled]), 'cooling_h');
    expect(issueCodes(field)).toEqual(['attributeRepeated']);
    expect(field.issues[0].params).toEqual({ others: '34120 Btu/h' });
    expect(fieldsFor(groupOf(86, [wrong, btu]), 'cooling_h')[0].decision).toBe('pending');
  });

  it('μία τιμή σπασμένη σε κελιά: ένα πεδίο, ποτέ δύο στόχοι με την ίδια διεύθυνση', () => {
    const shards = ['m', '³', '/h'].map((printed) => raw('airflow_h', printed, [idOf(page86, printed)]));
    const fields = fieldsFor(groupOf(86, shards), 'airflow_h');
    expect(fields).toHaveLength(1);
    expect(fields[0].decision).toBe('pending');
  });
});

describe('Δ3: δύο σειρές «ΚΩΔΙΚΟΣ»', () => {
  const codes = (id: string) => [raw('model_code', 'MFP-34ΤΜ', [idOf(page85, 'MFP-34ΤΜ')]), raw('model_code', id, [idOf(page85, id)])];

  it('ο κωδικός που κρατά το ζωντανό SKU κερδίζει, και το άλλο κελί δεν είναι εύρημα', () => {
    const live = { id: 'cpr_1', revision: 1, values: { model_code: { '*': { '*': { type: 'text' as const, text: '099-01-001' } } } } };
    const group = groupOf(85, codes('099-01-001'));
    const matches = new Map([[group.rows[0].rowKey, live]]);
    const row = buildAttributeRows({ ...group, modelCode: 'mfp' }, { ...noLive, matches }).find((candidate) => candidate.holderKind === 'product');
    expect(row).toMatchObject({ action: 'update', label: '099-01-001' });
    expect(row?.fields).toHaveLength(1);
    expect(row?.fields[0]).toMatchObject({ status: 'unchanged', issues: [] });
  });

  it('κανένα ζωντανό SKU: ο άνθρωπος βλέπει και τους δύο κωδικούς και επιλέγει', () => {
    const [field] = fieldsFor(groupOf(85, codes('099-01-001')), 'model_code');
    expect(field.decision).toBe('pending');
    expect(field.issues[0]).toMatchObject({ code: 'attributeRepeated', params: { others: '099-01-001' } });
  });
});

describe('Δ5: τα μηδενικά στο τέλος δεν είναι ακρίβεια', () => {
  const weigh = (value: string, printed: string) => {
    const group = groupOf(85, [raw('weight', value, [idOf(page85, printed)], 'Kg', [idOf(page85, 'Kg')])]);
    const rows = buildAttributeRows({ ...group, modelCode: 'mfp' }, noLive);
    return judgeProposal({ rows, modelCode: 'mfp', familyId: 'fan_coil', categoryIds: [], holdings: { rootModel: null, products: new Map() }, schema, refs }).rows;
  };
  const weightField = (rows: ReturnType<typeof weigh>) => rows.flatMap((row) => row.fields).find((field) => field.target.kind === 'attribute' && field.target.attributeId === 'weight');

  it('«18,00 Kg» σε ιδιότητα ενός δεκαδικού: κανένα ψευδές εύρημα, και το ποσό μένει όπως τυπώθηκε', () => {
    const field = weightField(weigh('18,00', '18,00'));
    expect(field?.incoming).toEqual({ type: 'measurement', amount: '18.00', unitCode: 'kg' });
    expect(field?.issues.map((issue) => issue.code)).not.toContain('valueTooManyDecimals');
  });

  it('πραγματική υπέρβαση ακρίβειας μένει εύρημα', () => {
    expect(weightField(weigh('15,45', '15,4'))?.issues.map((issue) => issue.code)).toContain('valueTooManyDecimals');
  });
});

describe('Δ7: πίνακας χωρίς κωδικό μοντέλου', () => {
  const groupWith = (codes: readonly string[]): Pick<ExtractedGroup, 'rows'> => ({
    rows: codes.map((code, index) => groupOf(85, [raw('model_code', code, [])]).rows.map((row) => ({ ...row, rowKey: `r${index}` }))[0]),
  });

  it('πρόταση από ό,τι μοιράζονται οι κωδικοί, αρχή και τέλος', () => {
    expect(suggestModelCode(groupWith(['MFP-34ΤΜ', 'MFP-51ΤΜ', 'MFP-68ΤΜ']), schema)).toBe('MFP-ΤΜ');
    expect(suggestModelCode(groupWith(['MFP-20CM', 'MFP-30CM']), schema)).toBe('MFP-CM');
    expect(suggestModelCode(groupWith(['099-01-001', '099-01-002']), schema)).toBe('099-01');
  });

  it('μία παραλλαγή ή τίποτα κοινό: καμία πρόταση, καμία μαντεψιά', () => {
    expect(suggestModelCode(groupWith(['MFP-34ΤΜ']), schema)).toBeNull();
    expect(suggestModelCode(groupWith(['AB-1', 'CD-2']), schema)).toBeNull();
  });

  it('η πρόταση ζει στο εύρημα, που δεν σβήνει μέχρι να τον ορίσει άνθρωπος', () => {
    const [group] = extractGroupsFromPage({
      tables: [{ modelCode: noCode, shared: [], variants: ['MFP-34ΤΜ', 'MFP-51ΤΜ'].map((code) => ({ cells: [raw('model_code', code, [idOf(page85, code)])] })) }],
    }, contextOf(85));
    const [model] = buildAttributeRows(group, noLive);
    expect(model.issues).toEqual([{ code: 'modelCodeMissing', path: 'modelCode', params: { suggestion: 'MFP-ΤΜ' } }]);
  });
});
