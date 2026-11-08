/**
 * **Η ρητή απουσία στην εισαγωγή** (ADR-923 §23.2 K4 · ETIM xChange Guideline V2.0, κωδικολόγιο 5.20): το `NA` / `UN` της πηγής
 * γίνεται πεδίο πρότασης, περνά από την ίδια σύγκριση τριών σημείων και τον ίδιο κριτή, και γράφεται με τη σημασιολογία του
 * επεξεργαστή — τιμή και λόγος απουσίας δεν συνυπάρχουν ποτέ.
 */

import { schemaSnapshotOf } from '../../aggregate/edit-aggregate';
import { MFP_ASSETS, MFP_SETTINGS } from '../../__tests__/fixtures/mfp-fan-coil-products.fixture';
import { MFP_ATTRIBUTE_MAP, MFP_FAMILY } from '../../__tests__/fixtures/mfp-fan-coil.fixture';
import { PLATFORM_MEASUREMENT_REGISTRY } from '../../measurement/measurement-registry';
import type { ExtractedCell, ExtractedGroup, ImportFieldValue, ImportProposalField } from '../../types/catalog-import';
import { ANY_SLOT, type NoValueReasons, type ProductValues } from '../../types/product';
import { buildAttributeRows, type AttributeProposalContext, type LiveHolder } from '../build-attribute-proposal';
import { EMPTY_LIVE_TRADE_IDENTITY } from '../trade-identity-fields';
import { judgeProposal } from '../judge-proposal';
import { EMPTY_IMPORT_HOLDER, importTargetKey, mergeFieldsIntoHolder, parseNoValueReasonText } from '../proposal-values';

const flat = schemaSnapshotOf({ family: MFP_FAMILY, attributes: MFP_ATTRIBUTE_MAP, registry: PLATFORM_MEASUREMENT_REGISTRY, settings: MFP_SETTINGS, variantSchemeCode: null });
const bySize = schemaSnapshotOf({ family: MFP_FAMILY, attributes: MFP_ATTRIBUTE_MAP, registry: PLATFORM_MEASUREMENT_REGISTRY, settings: MFP_SETTINGS, variantSchemeCode: 'by_size' });
const text = { registry: PLATFORM_MEASUREMENT_REGISTRY, language: 'el' as const, assetIdByCode: new Map(), assetCodeById: new Map(), yes: 'Ναι', no: 'Όχι' };
const refs = { assets: MFP_ASSETS, categories: new Set(['cat_fan_coils']), references: new Map() };

const WEIGHT: ProductValues = { weight: { [ANY_SLOT]: { [ANY_SLOT]: { type: 'measurement', amount: '15.4', unitCode: 'kg' } } } };

const reasonCell = (attributeId: string, reason: string): ExtractedCell => ({
  target: { kind: 'noValueReason', attributeId }, text: reason, confidence: 1, anchor: null, unitCode: null, flags: [],
});
const valueCell = (attributeId: string, value: string, unitCode: string | null = null): ExtractedCell => ({
  target: { kind: 'attribute', attributeId, channel: ANY_SLOT, locale: ANY_SLOT }, text: value, confidence: 1, anchor: null, unitCode, flags: [],
});

const groupOf = (cells: readonly ExtractedCell[]): ExtractedGroup => ({ groupKey: 'g', modelCode: null, sharedCells: [], rows: [{ rowKey: 'p1', cells }], pages: [] });
const liveOf = (values: ProductValues, noValueReasons: NoValueReasons = {}): LiveHolder => ({ id: 'cpr_1', revision: 2, values, noValueReasons, trade: EMPTY_LIVE_TRADE_IDENTITY });

function fieldFor(cells: readonly ExtractedCell[], live: LiveHolder | null, base: ReadonlyMap<string, ImportFieldValue> = new Map()): ImportProposalField {
  const context: AttributeProposalContext = {
    schema: flat,
    text,
    model: null,
    matches: new Map(live ? [['p1', live]] : []),
    base: new Map(live ? [[live.id, base]] : []),
  };
  const [row] = buildAttributeRows(groupOf(cells), context);
  const field = row.fields.find((candidate) => candidate.target.kind === 'noValueReason');
  if (!field) throw new Error('η γραμμή δεν έχει πεδίο λόγου απουσίας');
  return field;
}

const codesOf = (field: ImportProposalField) => field.issues.map((issue) => issue.code);

describe('ανάγνωση του λόγου', () => {
  it('δέχεται μόνο τους κωδικούς του λεξιλογίου, αυτούσιους', () => {
    expect(parseNoValueReasonText(' notApplicable ')).toEqual({ type: 'noValueReason', reason: 'notApplicable' });
    expect(parseNoValueReasonText('unknown')).toEqual({ type: 'noValueReason', reason: 'unknown' });
    expect(parseNoValueReasonText('NA')).toBeNull();
    expect(parseNoValueReasonText('Δεν εφαρμόζεται')).toBeNull();
  });
  it('το κλειδί στόχου είναι ανά ιδιότητα, χωριστό από τις τιμές της', () => {
    expect(importTargetKey({ kind: 'noValueReason', attributeId: 'weight' })).toBe('r:weight');
    expect(importTargetKey({ kind: 'attribute', attributeId: 'weight', channel: ANY_SLOT, locale: ANY_SLOT })).not.toBe('r:weight');
  });
});

describe('το πεδίο της πρότασης', () => {
  it('Λ1: χωρίς ζωντανή τιμή ⇒ νέο, αποδεκτό', () => {
    const field = fieldFor([reasonCell('weight', 'notApplicable')], liveOf({}));
    expect([field.status, field.decision]).toEqual(['new', 'accept']);
    expect(field.incoming).toEqual({ type: 'noValueReason', reason: 'notApplicable' });
  });

  it('Λ2 🔴 NA πάνω σε ζωντανή τιμή ⇒ σύγκρουση, απόφαση ανθρώπου — ποτέ σιωπηλή διαγραφή', () => {
    const field = fieldFor([reasonCell('weight', 'notApplicable')], liveOf(WEIGHT));
    expect([field.status, field.decision]).toEqual(['conflict', 'pending']);
    expect(codesOf(field)).toContain('noValueReplacesValue');
  });

  it('Λ3 🔴 UN πάνω σε ζωντανή τιμή ⇒ η τιμή μένει: αμετάβλητο, απορριμμένο, ορατό', () => {
    const field = fieldFor([reasonCell('weight', 'unknown')], liveOf(WEIGHT));
    expect([field.status, field.decision]).toEqual(['unchanged', 'reject']);
    expect(codesOf(field)).toEqual(['unknownKeepsValue']);
  });

  it('Λ4: ίδιος λόγος με τον ζωντανό ⇒ αμετάβλητο', () => {
    const field = fieldFor([reasonCell('weight', 'notApplicable')], liveOf({}, { weight: 'notApplicable' }));
    expect([field.status, field.decision]).toEqual(['unchanged', 'reject']);
  });

  it('Λ5: άλλος λόγος από τον ζωντανό, χωρίς βάση ⇒ αλλαγή', () => {
    const field = fieldFor([reasonCell('weight', 'notApplicable')], liveOf({}, { weight: 'unknown' }));
    expect([field.status, field.decision]).toEqual(['changed', 'accept']);
  });

  it('Λ6: σύγκριση τριών σημείων — ο άνθρωπος άλλαξε τον λόγο, η πηγή επαναλαμβάνει τον παλιό ⇒ η δουλειά του μένει', () => {
    const base = new Map<string, ImportFieldValue>([['r:weight', { type: 'noValueReason', reason: 'unknown' }]]);
    const field = fieldFor([reasonCell('weight', 'unknown')], liveOf({}, { weight: 'notApplicable' }), base);
    expect(field.status).toBe('unchanged');
  });

  it('Λ7: κείμενο που δεν είναι λόγος ⇒ εύρημα, εκκρεμότητα', () => {
    const field = fieldFor([reasonCell('weight', 'NA')], liveOf({}));
    expect(field.incoming).toBeNull();
    expect(field.decision).toBe('pending');
    expect(codesOf(field)).toEqual(['noValueReasonUnreadable']);
  });
});

describe('η ΜΙΑ συγχώνευση στον φορέα (κριτής + έγκριση)', () => {
  const reasonField = (attributeId: string, reason: 'notApplicable' | 'unknown', decision: ImportProposalField['decision'] = 'accept'): ImportProposalField => ({
    target: { kind: 'noValueReason', attributeId }, sourceText: reason, incoming: { type: 'noValueReason', reason }, live: null, base: null,
    status: 'new', confidence: 1, anchor: null, issues: [], decision,
  });
  const weightField: ImportProposalField = {
    target: { kind: 'attribute', attributeId: 'weight', channel: ANY_SLOT, locale: ANY_SLOT }, sourceText: '16 kg',
    incoming: { type: 'measurement', amount: '16', unitCode: 'kg' }, live: null, base: null, status: 'new', confidence: 1, anchor: null, issues: [], decision: 'accept',
  };
  const accepted = (field: ImportProposalField) => field.decision === 'accept';

  it('ο λόγος σβήνει τις τιμές της ιδιότητας (ποτέ μαζί)', () => {
    const merged = mergeFieldsIntoHolder({ values: WEIGHT, noValueReasons: {}, brand: null }, [reasonField('weight', 'notApplicable')], accepted);
    expect(merged).toEqual({ values: {}, noValueReasons: { weight: 'notApplicable' }, brand: null });
  });

  it('🔴 η τιμή σβήνει τον λόγο — πριν, το «16 kg» πάνω σε «δεν εφαρμόζεται» έδινε noValueConflict στην έγκριση', () => {
    const merged = mergeFieldsIntoHolder({ values: {}, noValueReasons: { weight: 'notApplicable' }, brand: null }, [weightField], accepted);
    expect(merged.noValueReasons).toEqual({});
    expect(merged.values.weight).toEqual({ [ANY_SLOT]: { [ANY_SLOT]: { type: 'measurement', amount: '16', unitCode: 'kg' } } });
  });

  it('και τα δύο για την ίδια ιδιότητα ⇒ κερδίζει η τιμή, ανεξάρτητα από τη σειρά', () => {
    const one = mergeFieldsIntoHolder(EMPTY_IMPORT_HOLDER, [reasonField('weight', 'unknown'), weightField], accepted);
    const other = mergeFieldsIntoHolder(EMPTY_IMPORT_HOLDER, [weightField, reasonField('weight', 'unknown')], accepted);
    expect(one).toEqual(other);
    expect(one.noValueReasons).toEqual({});
  });

  it('ό,τι δεν επιλέχθηκε δεν γράφεται', () => {
    const holder = { values: WEIGHT, noValueReasons: {}, brand: null };
    expect(mergeFieldsIntoHolder(holder, [reasonField('weight', 'notApplicable', 'reject')], accepted)).toEqual(holder);
  });

  it('κρατά τα υπόλοιπα πεδία του φορέα (κατηγορίες, κωδικό)', () => {
    const merged = mergeFieldsIntoHolder({ code: 'mfp', categoryIds: ['c'], values: {}, noValueReasons: {}, brand: null }, [reasonField('weight', 'unknown')], accepted);
    expect(merged).toMatchObject({ code: 'mfp', categoryIds: ['c'], noValueReasons: { weight: 'unknown' } });
  });
});

describe('ο κριτής βλέπει τον λόγο στο ΚΕΛΙ του', () => {
  it('🔴 λόγος απουσίας σε άξονα ⇒ noValueOnAxis πάνω στο πεδίο, όχι κρυμμένο στη γραμμή', () => {
    const group: ExtractedGroup = { groupKey: 'g', modelCode: 'mfp_tm', sharedCells: [], rows: [{ rowKey: 'r0', cells: [valueCell('model_code', 'MFP-15'), reasonCell('size', 'notApplicable')] }], pages: [] };
    const context: AttributeProposalContext = { schema: bySize, text, model: null, matches: new Map(), base: new Map() };
    const { rows } = judgeProposal({ rows: buildAttributeRows(group, context), modelCode: 'mfp_tm', familyId: 'fan_coil', categoryIds: [], holdings: { rootModel: null, products: new Map() }, schema: bySize, refs });
    const field = rows.flatMap((row) => row.fields).find((candidate) => candidate.target.kind === 'noValueReason');
    expect(field && codesOf(field)).toContain('noValueOnAxis');
    expect(field?.decision).toBe('pending');
  });
});
