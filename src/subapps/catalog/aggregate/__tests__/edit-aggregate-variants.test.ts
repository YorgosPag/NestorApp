/**
 * ADR-923 §5.10.4 Β4 — η οθόνη κρίνει το πλέγμα παραλλαγών με την ΙΔΙΑ `judgeAggregate` πριν από τη δέσμη,
 * πάνω στο ΙΔΙΟ σύνολο (`editAggregate` + κοινά `aggregate-members`). Πραγματικά σενάρια του MFP × 7.
 */
import { MFP_ATTRIBUTE_MAP, MFP_FAMILY, MFP_SIZES } from '../../__tests__/fixtures/mfp-fan-coil.fixture';
import {
  AI_SHIFTED_HEATING,
  MFP_ASSETS,
  MFP_MODEL,
  MFP_MODEL_ID,
  MFP_PAGE_60,
  MFP_SETTINGS,
  MFP_VARIANTS,
  mfpVariant,
  mfpVariantId,
} from '../../__tests__/fixtures/mfp-fan-coil-products.fixture';
import { PLATFORM_MEASUREMENT_REGISTRY } from '../../measurement/measurement-registry';
import type { CatalogProductDefinition } from '../../types/product';
import type { StoredMemberShape } from '../aggregate-members';
import { NO_EDITS, editAggregate, modelDefinitionOf, productDefinitionOf, schemaSnapshotOf } from '../edit-aggregate';
import { judgeAggregate, memberPath } from '../judge-aggregate';
import { generateVariants } from '../variant-generator';

const derived = {} as never;
const stored: StoredMemberShape[] = [
  { kind: 'productModel', record: { ...MFP_MODEL, id: MFP_MODEL_ID, revision: 1, derived } },
  ...MFP_VARIANTS.map((variant, index): StoredMemberShape => ({ kind: 'product', record: { ...variant, id: mfpVariantId(index), revision: 1, derived } })),
];
const schema = schemaSnapshotOf({ family: MFP_FAMILY, attributes: MFP_ATTRIBUTE_MAP, registry: PLATFORM_MEASUREMENT_REGISTRY, settings: MFP_SETTINGS, variantSchemeCode: 'by_size' });
const refs = { assets: MFP_ASSETS, categories: new Set<string>(), references: new Map() };
const judge = (updates: ReadonlyMap<string, CatalogProductDefinition>, creates: { id: string; definition: CatalogProductDefinition }[] = []) =>
  judgeAggregate({ aggregate: editAggregate(MFP_MODEL_ID, stored, { updates, creates, deletes: [] }), schema, refs });

describe('editAggregate + judgeAggregate στον πελάτη', () => {
  it('καμία αλλαγή ⇒ καθαρό · ο ορισμός εξάγεται χωρίς μεταδεδομένα', () => {
    expect(judgeAggregate({ aggregate: editAggregate(MFP_MODEL_ID, stored, NO_EDITS), schema, refs }).issues).toEqual([]);
    expect(modelDefinitionOf(stored[0].record as never)).toEqual(MFP_MODEL);
    expect(productDefinitionOf(stored[1].record as never)).toEqual(MFP_VARIANTS[0]);
  });

  it('🔴 θέρμανση όπως τη διάβασε το gpt-4o (επικόλληση) ⇒ μπλοκάρει 7/7 ΣΤΟ ΚΕΛΙ, πριν σταλεί', () => {
    const updates = new Map(MFP_SIZES.map((_, index) => [mfpVariantId(index), mfpVariant(index, {
      heating_h: AI_SHIFTED_HEATING.heating_h, heating_m: AI_SHIFTED_HEATING.heating_m,
    })] as const));
    const issues = judge(updates).issues.filter((issue) => issue.code === 'consistencyRuleViolated');
    const variants = new Set(issues.map((issue) => issue.path.split('.')[1]));
    expect(variants.size).toBe(7);
    expect(issues.some((issue) => issue.path === `${memberPath(mfpVariantId(0))}.values.heating_h`)).toBe(true);
  });

  it('🔴 διπλός κωδικός (το 016-15-001 της σελ. 200) ⇒ μπλοκάρει, στα ΔΥΟ κελιά του ζεύγους (η παράβαση είναι του ζεύγους)', () => {
    const codes = [...MFP_PAGE_60.code];
    codes[3] = codes[0];
    const issues = judge(new Map([[mfpVariantId(3), mfpVariant(3, { code: codes })]])).issues;
    const blocked = issues.filter((issue) => issue.code === 'consistencyRuleViolated' && issue.params?.ruleId === 'rule_unique_code');
    expect(blocked.map((issue) => issue.path).sort()).toEqual([
      `${memberPath(mfpVariantId(0))}.values.model_code`,
      `${memberPath(mfpVariantId(3))}.values.model_code`,
    ]);
    // Το είδος ταξιδεύει μαζί: το μήνυμα λέει «επαναλαμβάνεται», όχι «rule_unique_code».
    expect(blocked.every((issue) => issue.params?.kind === 'unique')).toBe(true);
  });

  it('νέα παραλλαγή με ήδη υπάρχον μέγεθος ⇒ axisComboDuplicate στο κελί του άξονα', () => {
    const creates = [{ id: 'cprod_new', definition: mfpVariant(0) }];
    const issues = judge(new Map(), creates).issues;
    expect(issues.some((issue) => issue.code === 'axisComboDuplicate')).toBe(true);
  });
});

describe('generateVariants', () => {
  const sizes = (codes: string[]) => ({ attributeId: 'size', values: codes.map((optionCode) => ({ type: 'select' as const, optionCode })) });
  const base = { attributes: MFP_ATTRIBUTE_MAP, registry: PLATFORM_MEASUREMENT_REGISTRY };

  it('τα 7 μεγέθη υπάρχουν ⇒ 0 νέα, 7 «υπάρχουν ήδη» (σημειωμένα, όχι σιωπηλά)', () => {
    const result = generateVariants({ ...base, axes: [sizes([...MFP_SIZES])], existing: MFP_VARIANTS.map((v) => v.values), descendantCount: 7 });
    expect(result).toEqual({ combos: [], existing: 7, budget: [] });
  });

  it('καρτεσιανό γινόμενο 2 αξόνων · διπλή επιλογή μετρά μία φορά', () => {
    const second = { attributeId: 'heating_h', values: [{ type: 'measurement' as const, amount: '1', unitCode: 'kW' }, { type: 'measurement' as const, amount: '1000', unitCode: 'W' }] };
    const result = generateVariants({ ...base, axes: [sizes(['mfp_34', 'mfp_51']), second], existing: [], descendantCount: 0 });
    expect(result.combos).toHaveLength(2);
    expect(result.existing).toBe(2);
  });

  it('πάνω από 200 απογόνους ⇒ tooManyDescendants (ο ΙΔΙΟΣ checkDescendantBudget)', () => {
    const result = generateVariants({ ...base, axes: [sizes(['mfp_34', 'mfp_51'])], existing: [], descendantCount: 199 });
    expect(result.budget.map((issue) => issue.code)).toEqual(['tooManyDescendants']);
  });
});
