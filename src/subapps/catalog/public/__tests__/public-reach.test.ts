/**
 * Το «γιατί» της δημόσιας εμβέλειας (ADR-923 §5.13 Σ9): ποια αιτία δείχνει η οθόνη, με ποια σειρά, και πότε καμία.
 */

import type { StoredVisibilityRule } from '../../pricing/visibility';
import type { PriceAudience } from '../../types/price-list';
import type { VisibilitySubject } from '../../types/visibility-rule';
import type { CatalogVisibility } from '../../vocabulary/pricing';
import { explainPublicReach, type PublicReachFacts } from '../public-reach';

const NOW = Date.UTC(2026, 10, 7);
const ANONYMOUS: PriceAudience = { kind: 'anonymous' };
const SIGNED_IN: PriceAudience = { kind: 'signedIn' };
const CATALOG: VisibilitySubject = { kind: 'catalog' };

const rule = (id: string, subject: VisibilitySubject, visibility: CatalogVisibility, audience: PriceAudience = ANONYMOUS): StoredVisibilityRule =>
  ({ id, subject, audience, visibility });
const variant = (variantId: string): VisibilitySubject => ({ kind: 'variant', variantId });

const OPEN = rule('open', CATALOG, 'visibleNoPrice');

const facts = (over: Partial<PublicReachFacts> = {}): PublicReachFacts => ({
  published: 2,
  total: 2,
  condition: 'open',
  rules: [OPEN],
  syncing: false,
  atMs: NOW,
  ...over,
});

const kinds = (over: Partial<PublicReachFacts>) => explainPublicReach(facts(over)).map((reason) => reason.kind);

describe('explainPublicReach', () => {
  it('όλα δημόσια ⇒ καμία αιτία', () => {
    expect(explainPublicReach(facts())).toEqual([]);
  });

  it('🔑 κενός κατάλογος ⇒ μόνο «δεν έχει προϊόντα», ακόμη και με κλειστή συνθήκη ή χωρίς κανόνα', () => {
    expect(kinds({ total: 0, published: 0, condition: 'closed', rules: [] })).toEqual(['catalogEmpty']);
  });

  it.each([
    ['closed', 'conditionClosed'],
    ['unknown', 'conditionUnknown'],
  ] as const)('συνθήκη %s ⇒ %s, πρώτη αιτία', (condition, expected) => {
    expect(kinds({ published: 0, condition })).toEqual([expected]);
  });

  it('χωρίς κανόνα για τον ανώνυμο ⇒ κρυφά από προεπιλογή', () => {
    expect(kinds({ published: 0, rules: [] })).toEqual(['noRuleForPublic']);
  });

  it('🔑 κανόνας μόνο για συνδεδεμένους δεν είναι κανόνας για τον ανώνυμο', () => {
    expect(kinds({ published: 0, rules: [rule('signed', CATALOG, 'visible', SIGNED_IN)] })).toEqual(['noRuleForPublic']);
  });

  it('🔑 ο κανόνας καταλόγου κρύβει ⇒ «ο κανόνας για όλο τον κατάλογο κρύβει» (η ζωντανή δοκιμή της 2026-11-07)', () => {
    expect(kinds({ published: 0, rules: [rule('open', CATALOG, 'hidden')] })).toEqual(['catalogRuleHides']);
  });

  it('ειδικότεροι κανόνες που κρύβουν από τον ανώνυμο ⇒ μετριούνται, όχι οι άλλοι', () => {
    const rules = [
      OPEN,
      rule('h1', variant('v1'), 'hidden'),
      rule('h2', variant('v2'), 'hidden'),
      rule('signed', variant('v3'), 'hidden', SIGNED_IN),
      rule('shown', variant('v4'), 'visible'),
    ];
    expect(explainPublicReach(facts({ published: 1, total: 3, rules }))).toEqual([{ kind: 'specificRulesHide', count: 2 }]);
  });

  it('καμία γνωστή αιτία ⇒ το υπόλοιπο είναι «χωρίς ορατή ενεργή παραλλαγή»', () => {
    expect(explainPublicReach(facts({ published: 1, total: 3 }))).toEqual([{ kind: 'noVisibleVariant', count: 2 }]);
  });

  it('σε εξέλιξη ⇒ λέει ότι ενημερώνεται, πριν από τους κανόνες', () => {
    expect(kinds({ published: 0, syncing: true, rules: [rule('open', CATALOG, 'hidden')] })).toEqual(['syncing', 'catalogRuleHides']);
  });

  it('🔑 σειρά: συνθήκη → συγχρονισμός → κανόνας καταλόγου → ειδικότεροι κανόνες', () => {
    const rules = [rule('open', CATALOG, 'hidden'), rule('h1', variant('v1'), 'hidden')];
    expect(kinds({ published: 0, condition: 'closed', syncing: true, rules })).toEqual(['conditionClosed', 'syncing', 'catalogRuleHides', 'specificRulesHide']);
  });

  it('🔒 X πάνω από Y (μετρήσεις σε διαφορετικές στιγμές) δεν δίνει ψευδή αιτία', () => {
    expect(explainPublicReach(facts({ published: 3, total: 2, rules: [] }))).toEqual([]);
  });
});
