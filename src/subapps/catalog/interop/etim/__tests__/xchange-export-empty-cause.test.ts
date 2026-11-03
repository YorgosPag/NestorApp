/**
 * Η διάγνωση της κενής εξαγωγής xChange (ADR-923 §5.14.1 · απόφαση Ε3): μία αιτία, η πρώτη που εξηγεί το κενό, και `null` όταν
 * υπάρχει έστω ένα προϊόν. Το σχήμα 2.0 ζητά `Product` με `minItems: 1`, άρα κάθε αιτία σημαίνει «καμία λήψη».
 */

import schema20 from './fixtures/xchange-2.0.schema.json';
import { xchangeEmptyCause, xchangeNothingToExportIssue, type XChangeAssembly } from '../xchange-export-assembly';
import { ETIM_ITEM_NUMBER_MAX } from '../../../vocabulary/etim';

const assembly = (over: Partial<XChangeAssembly>): XChangeAssembly => ({ sources: [], hidden: 0, unfitIdentifier: 0, onRequest: {}, ...over });
const ONE_SOURCE = [{ identifier: 'A', label: 'A', familyId: 'f', values: new Map(), noValueReasons: new Map(), price: null }];

describe('xchangeEmptyCause', () => {
  it('έστω ένα προϊόν ⇒ καμία αιτία, όσα κι αν μένουν εκτός', () => {
    expect(xchangeEmptyCause(assembly({ sources: ONE_SOURCE, hidden: 7 }), { productCount: 8, visibilityRuleCount: 0 })).toBeNull();
  });

  it('κατάλογος χωρίς προϊόντα ⇒ catalogEmpty, πριν από κάθε κανόνα', () => {
    expect(xchangeEmptyCause(assembly({}), { productCount: 0, visibilityRuleCount: 0 })).toBe('catalogEmpty');
  });

  it('όλα κρυφά χωρίς κανέναν κανόνα ⇒ noVisibilityRules (Δ3: χωρίς κανόνα ⇒ κρυφό)', () => {
    expect(xchangeEmptyCause(assembly({ hidden: 8 }), { productCount: 8, visibilityRuleCount: 0 })).toBe('noVisibilityRules');
  });

  it('όλα κρυφά ενώ υπάρχουν κανόνες ⇒ hiddenForAudience', () => {
    expect(xchangeEmptyCause(assembly({ hidden: 8 }), { productCount: 8, visibilityRuleCount: 3 })).toBe('hiddenForAudience');
  });

  it('κάποια ορατά αλλά κανένα με κωδικό που χωρά ⇒ noUsableIdentifier, ακόμη κι αν τα υπόλοιπα είναι κρυφά', () => {
    expect(xchangeEmptyCause(assembly({ hidden: 5, unfitIdentifier: 3 }), { productCount: 8, visibilityRuleCount: 0 })).toBe('noUsableIdentifier');
  });
});

describe('το εύρημα της άρνησης', () => {
  it('ένας κωδικός, η αιτία και το όριο του κωδικού ως παράμετροι', () => {
    expect(xchangeNothingToExportIssue('noUsableIdentifier')).toEqual({
      code: 'xchangeNothingToExport', path: 'audience', params: { cause: 'noUsableIdentifier', max: ETIM_ITEM_NUMBER_MAX },
    });
  });

  it('ο λόγος ύπαρξης: το επίσημο σχήμα δεν δέχεται Supplier χωρίς προϊόν', () => {
    const supplier = schema20.properties.Supplier.items;
    expect(supplier.required).toContain('Product');
    expect(supplier.properties.Product.minItems).toBe(1);
  });
});
