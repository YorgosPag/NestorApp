/**
 * Η καθαρή λογική της οθόνης κανόνων ορατότητας (ADR-923 §5.12 Δ1): ο κωδικός γίνεται αντικείμενο μόνο στο σωστό είδος,
 * και το διπλότυπο κελί φαίνεται πριν από το κλικ.
 */

import type { VisibilityRuleWire } from '@/subapps/catalog/types/pricing-views';
import type { VisibilityRuleDefinition } from '@/subapps/catalog/types/visibility-rule';
import { hasRuleFor, needsCode, rulesBySpecificity, subjectOfTarget } from '../visibility-rule-draft';

const wire = (id: string, definition: VisibilityRuleDefinition): VisibilityRuleWire => ({
  ...definition,
  id,
  companyId: 'c',
  revision: 1,
  isDeleted: false,
  createdAt: '',
  createdBy: '',
  updatedAt: '',
  updatedBy: '',
  deletedAt: null,
  deletedBy: null,
});

const CATALOG_SIGNED = wire('a', { subject: { kind: 'catalog' }, audience: { kind: 'signedIn' }, visibility: 'visible' });
const SKU_SIGNED = wire('b', { subject: { kind: 'variant', variantId: 'v' }, audience: { kind: 'signedIn' }, visibility: 'hidden' });
const CATALOG_PARTNER = wire('c', {
  subject: { kind: 'catalog' },
  audience: { kind: 'partner', party: { kind: 'contact', contactId: 'x' } },
  visibility: 'visible',
});

describe('needsCode', () => {
  it('μοντέλο και SKU με κωδικό· κατάλογος και κατηγορία όχι', () => {
    expect(['catalog', 'category', 'productModel', 'variant'].map((kind) => needsCode(kind as 'catalog'))).toEqual([false, false, true, true]);
  });
});

describe('subjectOfTarget', () => {
  it('σωστό είδος ⇒ αντικείμενο', () => {
    expect(subjectOfTarget('productModel', { kind: 'productModel', id: 'm' })).toEqual({ kind: 'productModel', modelId: 'm' });
    expect(subjectOfTarget('variant', { kind: 'product', id: 'p' })).toEqual({ kind: 'variant', variantId: 'p' });
  });

  it('λάθος είδος ή καμία επίλυση ⇒ `null`, ποτέ σιωπηλή μετατροπή', () => {
    expect(subjectOfTarget('variant', { kind: 'productModel', id: 'm' })).toBeNull();
    expect(subjectOfTarget('productModel', { kind: 'product', id: 'p' })).toBeNull();
    expect(subjectOfTarget('variant', null)).toBeNull();
  });
});

describe('hasRuleFor', () => {
  it('ίδιο κελί ναι· άλλο κοινό ή αντικείμενο όχι', () => {
    const rules = [CATALOG_SIGNED];
    expect(hasRuleFor(rules, { kind: 'catalog' }, { kind: 'signedIn' })).toBe(true);
    expect(hasRuleFor(rules, { kind: 'catalog' }, { kind: 'anonymous' })).toBe(false);
    expect(hasRuleFor(rules, { kind: 'variant', variantId: 'v' }, { kind: 'signedIn' })).toBe(false);
  });
});

describe('rulesBySpecificity', () => {
  it('η σειρά της κρίσης: πρώτα το κοινό, μετά το αντικείμενο', () => {
    expect(rulesBySpecificity([CATALOG_SIGNED, SKU_SIGNED, CATALOG_PARTNER]).map((rule) => rule.id)).toEqual(['c', 'b', 'a']);
  });
});
