/**
 * Η κρίση ορατότητας (ADR-923 §12 · §5.12 Δ2 · Δ3 · Σ8): προεπιλογή `hidden`, ο ειδικότερος νικά, και η ισοπαλία κλείνει.
 */

import type { PriceAudience, PricingViewer } from '../../types/price-list';
import type { VisibilityAncestry, VisibilitySubject } from '../../types/visibility-rule';
import type { CatalogVisibility } from '../../vocabulary/pricing';
import { judgeVisibility, showsPrice, showsProduct, visibilityRuleKey, type StoredVisibilityRule } from '../visibility';

const AT = Date.parse('2026-10-31T12:00:00.000Z');

const ANCESTRY: VisibilityAncestry = {
  variantId: 'sku',
  modelIds: ['root', 'sub'],
  categoryDepths: { top: 0, mid: 1, leafA: 2, leafB: 2 },
};

const SIGNED_IN: PricingViewer = { kind: 'signedIn', customerGroupId: null, parties: [] };
const WHOLESALE: PricingViewer = { kind: 'signedIn', customerGroupId: 'wholesale', parties: [] };
const PARTNER: PricingViewer = { kind: 'signedIn', customerGroupId: 'wholesale', parties: [{ kind: 'contact', contactId: 'c1' }] };

const CATALOG: VisibilitySubject = { kind: 'catalog' };
const SIGNED: PriceAudience = { kind: 'signedIn' };
const GROUP: PriceAudience = { kind: 'customerGroup', customerGroupId: 'wholesale' };
const PARTY: PriceAudience = { kind: 'partner', party: { kind: 'contact', contactId: 'c1' } };

const rule = (id: string, subject: VisibilitySubject, audience: PriceAudience, visibility: CatalogVisibility): StoredVisibilityRule => ({
  id,
  subject,
  audience,
  visibility,
});

describe('judgeVisibility', () => {
  it('χωρίς κανόνα ⇒ κρυφό, χωρίς νικητή (Δ3)', () => {
    expect(judgeVisibility([], ANCESTRY, SIGNED_IN, AT)).toMatchObject({ visibility: 'hidden', ruleId: null, tied: false });
  });

  it('κανόνας για άλλο κοινό δεν ανοίγει τίποτα, και το ίχνος λέει γιατί', () => {
    const verdict = judgeVisibility([rule('g', CATALOG, GROUP, 'visible')], ANCESTRY, SIGNED_IN, AT);
    expect(verdict.visibility).toBe('hidden');
    expect(verdict.trace).toEqual([{ id: 'g', verdict: 'audienceMismatch' }]);
  });

  it('κανόνας για άλλο SKU, μοντέλο ή κατηγορία δεν αφορά αυτό το SKU', () => {
    const rules = [
      rule('v', { kind: 'variant', variantId: 'other' }, SIGNED, 'visible'),
      rule('m', { kind: 'productModel', modelId: 'other' }, SIGNED, 'visible'),
      rule('c', { kind: 'category', categoryId: 'other' }, SIGNED, 'visible'),
    ];
    const verdict = judgeVisibility(rules, ANCESTRY, SIGNED_IN, AT);
    expect(verdict.visibility).toBe('hidden');
    expect(verdict.trace.map((entry) => entry.verdict)).toEqual(['otherSubject', 'otherSubject', 'otherSubject']);
  });

  it('το αντικείμενο: SKU > μοντέλο > κατηγορία > κατάλογος', () => {
    const rules = [
      rule('cat', CATALOG, SIGNED, 'hidden'),
      rule('c', { kind: 'category', categoryId: 'leafA' }, SIGNED, 'visibleNoPrice'),
      rule('m', { kind: 'productModel', modelId: 'sub' }, SIGNED, 'hidden'),
      rule('v', { kind: 'variant', variantId: 'sku' }, SIGNED, 'visible'),
    ];
    expect(judgeVisibility(rules, ANCESTRY, SIGNED_IN, AT)).toMatchObject({ visibility: 'visible', ruleId: 'v' });
    expect(judgeVisibility(rules.slice(0, 3), ANCESTRY, SIGNED_IN, AT).ruleId).toBe('m');
    expect(judgeVisibility(rules.slice(0, 2), ANCESTRY, SIGNED_IN, AT).ruleId).toBe('c');
  });

  it('κοντινότερος πρόγονος νικά: βαθύτερη κατηγορία, βαθύτερο μοντέλο', () => {
    const categories = [rule('top', { kind: 'category', categoryId: 'top' }, SIGNED, 'hidden'), rule('leaf', { kind: 'category', categoryId: 'leafA' }, SIGNED, 'visible')];
    expect(judgeVisibility(categories, ANCESTRY, SIGNED_IN, AT).ruleId).toBe('leaf');
    const models = [rule('r', { kind: 'productModel', modelId: 'root' }, SIGNED, 'hidden'), rule('s', { kind: 'productModel', modelId: 'sub' }, SIGNED, 'visible')];
    expect(judgeVisibility(models, ANCESTRY, SIGNED_IN, AT).ruleId).toBe('s');
  });

  it('το κοινό μετρά ΠΡΙΝ από το αντικείμενο (§12): ο συνεργάτης στον κατάλογο νικά το SKU των συνδεδεμένων', () => {
    const rules = [rule('sku', { kind: 'variant', variantId: 'sku' }, SIGNED, 'visible'), rule('p', CATALOG, PARTY, 'hidden')];
    expect(judgeVisibility(rules, ANCESTRY, PARTNER, AT)).toMatchObject({ visibility: 'hidden', ruleId: 'p' });
    expect(judgeVisibility(rules, ANCESTRY, WHOLESALE, AT)).toMatchObject({ visibility: 'visible', ruleId: 'sku' });
  });

  it('ισοπαλία δύο κατηγοριών ίδιου βάθους ⇒ το περιοριστικότερο, με σημάδι (Σ8)', () => {
    const rules = [
      rule('a', { kind: 'category', categoryId: 'leafA' }, SIGNED, 'visible'),
      rule('b', { kind: 'category', categoryId: 'leafB' }, SIGNED, 'hidden'),
    ];
    expect(judgeVisibility(rules, ANCESTRY, SIGNED_IN, AT)).toMatchObject({ visibility: 'hidden', ruleId: 'b', tied: true });
    expect(judgeVisibility([...rules].reverse(), ANCESTRY, SIGNED_IN, AT)).toMatchObject({ visibility: 'hidden', ruleId: 'b', tied: true });
  });

  it('ισοπαλία ανοιχτού με «χωρίς τιμή» ⇒ χωρίς τιμή', () => {
    const rules = [
      rule('a', { kind: 'category', categoryId: 'leafA' }, SIGNED, 'visible'),
      rule('b', { kind: 'category', categoryId: 'leafB' }, SIGNED, 'visibleNoPrice'),
    ];
    expect(judgeVisibility(rules, ANCESTRY, SIGNED_IN, AT)).toMatchObject({ visibility: 'visibleNoPrice', ruleId: 'b' });
  });

  it('ανώνυμος: μόνο το ανώνυμο κοινό τον καλύπτει', () => {
    const rules = [rule('s', CATALOG, SIGNED, 'visible'), rule('a', CATALOG, { kind: 'anonymous' }, 'visibleNoPrice')];
    expect(judgeVisibility(rules, ANCESTRY, { kind: 'anonymous' }, AT)).toMatchObject({ visibility: 'visibleNoPrice', ruleId: 'a' });
  });
});

describe('visibilityRuleKey', () => {
  it('ίδιο κελί ⇒ ίδιο κλειδί· άλλο αντικείμενο ή κοινό ⇒ άλλο', () => {
    const base = { subject: { kind: 'category', categoryId: 'x' }, audience: GROUP } as const;
    expect(visibilityRuleKey(base)).toBe(visibilityRuleKey({ ...base }));
    expect(visibilityRuleKey(base)).not.toBe(visibilityRuleKey({ ...base, audience: SIGNED }));
    expect(visibilityRuleKey(base)).not.toBe(visibilityRuleKey({ ...base, subject: { kind: 'productModel', modelId: 'x' } }));
  });
});

describe('showsProduct · showsPrice', () => {
  it('τρεις απαντήσεις, χωρίς άκυρο συνδυασμό', () => {
    expect([showsProduct('visible'), showsPrice('visible')]).toEqual([true, true]);
    expect([showsProduct('visibleNoPrice'), showsPrice('visibleNoPrice')]).toEqual([true, false]);
    expect([showsProduct('hidden'), showsPrice('hidden')]).toEqual([false, false]);
  });
});
