/**
 * **Η ταυτότητα εμπορίου στην εισαγωγή** (ADR-934 §5.1.7 · Σ1γ): στήλη GTIN / MPN / μάρκα / «χωρίς GTIN» ⇒ πεδίο πρότασης, με την
 * ίδια σύγκριση τριών σημείων, τον ίδιο κριτή με τον γραφέα, και εγγραφή **μόνο** με τις πράξεις του `trade-identity`.
 */

import { schemaSnapshotOf } from '../../aggregate/edit-aggregate';
import { MFP_ASSETS, MFP_SETTINGS } from '../../__tests__/fixtures/mfp-fan-coil-products.fixture';
import { MFP_ATTRIBUTE_MAP, MFP_FAMILY } from '../../__tests__/fixtures/mfp-fan-coil.fixture';
import { PLATFORM_MEASUREMENT_REGISTRY } from '../../measurement/measurement-registry';
import type { ExtractedCell, ExtractedGroup, ImportFieldValue, ImportProposalField, ImportTradeField } from '../../types/catalog-import';
import { ANY_SLOT } from '../../types/product';
import { buildAttributeRows, type AttributeProposalContext, type LiveHolder } from '../build-attribute-proposal';
import { judgeProposal } from '../judge-proposal';
import { EMPTY_PRODUCT_IMPORT_HOLDER, importTargetKey, mergeFieldsIntoProduct } from '../proposal-values';
import { EMPTY_LIVE_TRADE_IDENTITY, sameTradeText, settleTradeCells, type LiveTradeIdentity } from '../trade-identity-fields';

const flat = schemaSnapshotOf({ family: MFP_FAMILY, attributes: MFP_ATTRIBUTE_MAP, registry: PLATFORM_MEASUREMENT_REGISTRY, settings: MFP_SETTINGS, variantSchemeCode: null });
const bySize = schemaSnapshotOf({ family: MFP_FAMILY, attributes: MFP_ATTRIBUTE_MAP, registry: PLATFORM_MEASUREMENT_REGISTRY, settings: MFP_SETTINGS, variantSchemeCode: 'by_size' });
const text = { registry: PLATFORM_MEASUREMENT_REGISTRY, language: 'el' as const, assetIdByCode: new Map(), assetCodeById: new Map(), yes: 'Ναι', no: 'Όχι' };
const refs = { assets: MFP_ASSETS, categories: new Set(['cat_fan_coils']), references: new Map() };

/** Έγκυρο EAN-13 (ψηφίο ελέγχου 1) και το ίδιο ως GTIN-14. */
const EAN = '4006381333931';
const EAN_14 = '04006381333931';

const tradeCell = (field: ImportTradeField, value: string): ExtractedCell & { readonly target: { readonly kind: 'tradeIdentity'; readonly field: ImportTradeField }; readonly text: string } => ({
  target: { kind: 'tradeIdentity', field }, text: value, confidence: 1, anchor: null, unitCode: null, flags: [],
});
const sizeCell = (option: string): ExtractedCell => ({
  target: { kind: 'attribute', attributeId: 'size', channel: ANY_SLOT, locale: ANY_SLOT }, text: option, confidence: 1, anchor: null, unitCode: null, flags: [],
});

const groupOf = (rows: readonly (readonly ExtractedCell[])[]): ExtractedGroup => ({
  groupKey: 'g', modelCode: null, sharedCells: [], rows: rows.map((cells, index) => ({ rowKey: `p${index + 1}`, cells })), pages: [],
});
const liveOf = (trade: Partial<LiveTradeIdentity>): LiveHolder => ({ id: 'cpr_1', revision: 2, values: {}, noValueReasons: {}, trade: { ...EMPTY_LIVE_TRADE_IDENTITY, ...trade } });

function fieldsFor(cells: readonly ExtractedCell[], live: LiveHolder | null, base: ReadonlyMap<string, ImportFieldValue> = new Map()): readonly ImportProposalField[] {
  const context: AttributeProposalContext = { schema: flat, text, model: null, matches: new Map(live ? [['p1', live]] : []), base: new Map(live ? [[live.id, base]] : []) };
  const [row] = buildAttributeRows(groupOf([cells]), context);
  return row.fields;
}

const fieldOf = (fields: readonly ImportProposalField[], name: ImportTradeField): ImportProposalField => {
  const found = fields.find((field) => field.target.kind === 'tradeIdentity' && field.target.field === name);
  if (!found) throw new Error(`χωρίς πεδίο ${name}`);
  return found;
};
const codesOf = (field: ImportProposalField) => field.issues.map((issue) => issue.code);
const accepted = (field: ImportProposalField) => field.decision === 'accept';

describe('ταυτότητα κατά κλειδί, όχι κατά γράμματα', () => {
  it('το κλειδί στόχου είναι ανά πεδίο', () => {
    expect(importTargetKey({ kind: 'tradeIdentity', field: 'gtin' })).toBe('t:gtin');
    expect(importTargetKey({ kind: 'tradeIdentity', field: 'brand' })).toBe('t:brand');
  });
  it('EAN-13 ≡ GTIN-14 · «DAIKIN» ≡ «Daikin» · «ab–12» ≡ « AB-12 »', () => {
    expect(sameTradeText('gtin', EAN, EAN_14)).toBe(true);
    expect(sameTradeText('gtin', '4006-3813-3393-1', EAN)).toBe(true);
    expect(sameTradeText('brand', 'DAIKIN', 'Daikin')).toBe(true);
    expect(sameTradeText('mpn', 'ab–12', ' AB-12 ')).toBe(true);
    expect(sameTradeText('gtin', EAN, '4006381333948')).toBe(false);
  });
  it('🔴 MPN: η παύλα ΔΕΝ ισούται με κενό — ο κανόνας των κωδικών προμηθευτή (ADR-934 §5.1), ποτέ ψευδής συγχώνευση', () => {
    expect(sameTradeText('mpn', 'ab-12', 'AB 12')).toBe(false);
  });
  it('🔴 επανεισαγωγή του ίδιου GTIN σε άλλη μορφή ⇒ αμετάβλητο, καμία «αλλαγή»', () => {
    const field = fieldOf(fieldsFor([tradeCell('gtin', EAN_14)], liveOf({ gtin: EAN })), 'gtin');
    expect(field.status).toBe('unchanged');
    expect(field.decision).toBe('reject');
  });
  it('το GTIN γράφεται με τον κανόνα της οθόνης: ψηφία χωρίς διαχωριστικά', () => {
    expect(fieldOf(fieldsFor([tradeCell('gtin', '4006 3813 3393 1')], null), 'gtin').incoming).toEqual({ type: 'tradeText', text: EAN });
  });
});

describe('«χωρίς GTIN» πάνω σε ζωντανό GTIN — η σημασιολογία του λόγου απουσίας', () => {
  it('notApplicable ⇒ σύγκρουση, απόφαση ανθρώπου', () => {
    const field = fieldOf(fieldsFor([tradeCell('noGtinReason', 'notApplicable')], liveOf({ gtin: EAN })), 'noGtinReason');
    expect(field.status).toBe('conflict');
    expect(codesOf(field)).toContain('noValueReplacesValue');
    expect(field.decision).toBe('pending');
  });
  it('unknown ⇒ ο κωδικός μένει, το πεδίο απορρίπτεται', () => {
    const field = fieldOf(fieldsFor([tradeCell('noGtinReason', 'unknown')], liveOf({ gtin: EAN })), 'noGtinReason');
    expect(field.status).toBe('unchanged');
    expect(codesOf(field)).toContain('unknownKeepsValue');
  });
  it('άγνωστο κείμενο λόγου ⇒ εύρημα, ποτέ μαντεψιά', () => {
    expect(codesOf(fieldOf(fieldsFor([tradeCell('noGtinReason', 'Χωρίς')], null), 'noGtinReason'))).toContain('noValueReasonUnreadable');
  });
});

describe('εγγραφή μόνο με τις πράξεις του trade-identity', () => {
  const asField = (cell: ExtractedCell, incoming: ImportFieldValue): ImportProposalField => ({
    target: cell.target, sourceText: cell.text ?? '', incoming, live: null, base: null, status: 'new', confidence: 1, anchor: null, issues: [], decision: 'accept',
  });
  const gtin = asField(tradeCell('gtin', EAN), { type: 'tradeText', text: EAN });
  const reason = asField(tradeCell('noGtinReason', 'notApplicable'), { type: 'noValueReason', reason: 'notApplicable' });

  it('GTIN και «χωρίς GTIN» από την ίδια πηγή ⇒ κερδίζει ο κωδικός, ανεξάρτητα από τη σειρά', () => {
    const one = mergeFieldsIntoProduct(EMPTY_PRODUCT_IMPORT_HOLDER, [reason, gtin], accepted);
    const other = mergeFieldsIntoProduct(EMPTY_PRODUCT_IMPORT_HOLDER, [gtin, reason], accepted);
    expect(one).toEqual(other);
    expect(one).toMatchObject({ gtin: EAN, noGtinReason: null });
  });
  it('MPN και μάρκα γράφονται χωρίς περιττά κενά· ό,τι δεν επιλέχθηκε δεν γράφεται', () => {
    const mpn = asField(tradeCell('mpn', ' FXZQ20A '), { type: 'tradeText', text: ' FXZQ20A ' });
    const brand = { ...asField(tradeCell('brand', 'Daikin'), { type: 'tradeText', text: 'Daikin' }), decision: 'reject' as const };
    expect(mergeFieldsIntoProduct(EMPTY_PRODUCT_IMPORT_HOLDER, [mpn, brand], accepted)).toMatchObject({ mpn: 'FXZQ20A', brand: null });
  });
  it('κενό κελί δεν σβήνει GTIN: δεν γίνεται πεδίο', () => {
    const empty: ExtractedCell = { ...tradeCell('gtin', ''), text: null };
    expect(fieldsFor([empty], liveOf({ gtin: EAN })).some((field) => field.target.kind === 'tradeIdentity')).toBe(false);
  });
});

describe('επίπεδο και κρίση', () => {
  const context = (schema: typeof bySize): AttributeProposalContext => ({ schema, text, model: null, matches: new Map(), base: new Map() });

  it('η μάρκα από τις γραμμές SKU ανεβαίνει στο μοντέλο (βάθος 0)· το GTIN μένει στο SKU', () => {
    const rows = buildAttributeRows(groupOf([[sizeCell('mfp_34'), tradeCell('brand', 'Daikin'), tradeCell('gtin', EAN)]]), context(bySize));
    const [model, sku] = rows;
    expect(model.fields.map((field) => importTargetKey(field.target))).toContain('t:brand');
    expect(sku.fields.map((field) => importTargetKey(field.target))).toContain('t:gtin');
    expect(sku.fields.map((field) => importTargetKey(field.target))).not.toContain('t:brand');
  });
  it('δύο γραμμές με άλλη μάρκα ⇒ sharedDisagrees· ίδια μάρκα με άλλα γράμματα ⇒ καμία διαφωνία', () => {
    const disagree = buildAttributeRows(groupOf([[sizeCell('mfp_34'), tradeCell('brand', 'Daikin')], [sizeCell('mfp_51'), tradeCell('brand', 'Toshiba')]]), context(bySize));
    expect(codesOf(fieldOf(disagree[0].fields, 'brand'))).toContain('sharedDisagrees');
    const agree = buildAttributeRows(groupOf([[sizeCell('mfp_34'), tradeCell('brand', 'Daikin')], [sizeCell('mfp_51'), tradeCell('brand', 'DAIKIN')]]), context(bySize));
    expect(codesOf(fieldOf(agree[0].fields, 'brand'))).not.toContain('sharedDisagrees');
  });
  it('🔴 λάθος ψηφίο GS1 ⇒ ο κριτής του γραφέα το λέει στο κελί, όχι 422 στο κουμπί', () => {
    const built = buildAttributeRows(groupOf([[tradeCell('gtin', '4006381333932')]]), context(flat));
    const { rows } = judgeProposal({ rows: built, modelCode: null, familyId: 'fan_coil', categoryIds: [], holdings: { rootModel: null, products: new Map() }, schema: flat, refs });
    const field = fieldOf(rows[0].fields, 'gtin');
    expect(codesOf(field)).toContain('gtinInvalid');
    expect(field.decision).toBe('pending');
  });
  it('δύο στήλες GTIN που διαφωνούν ⇒ εύρημα με την άλλη τιμή· ίδιος κωδικός σε άλλη μορφή ⇒ ένα πεδίο', () => {
    const [disputed] = settleTradeCells([tradeCell('gtin', EAN), tradeCell('gtin', '4006381333948')]);
    expect(disputed.flags.map((flag) => flag.code)).toContain('attributeRepeated');
    // §5.5.2 Β8: η άλλη τιμή ταξιδεύει δομημένη για το κουμπί «Κράτα …».
    expect(disputed.alternatives).toEqual([{ text: '4006381333948', anchor: null }]);
    expect(settleTradeCells([tradeCell('gtin', EAN), tradeCell('gtin', EAN_14)])[0].alternatives).toBeUndefined();
    expect(settleTradeCells([tradeCell('gtin', EAN), tradeCell('gtin', EAN_14)])).toHaveLength(1);
  });
});
