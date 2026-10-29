import type { DiscountConditionDefinition } from '@/subapps/catalog/types/price-list';
import type { CustomerGroupWire, DiscountConditionWire, DiscountGroupWire } from '@/subapps/catalog/types/pricing-views';
import {
  ALL_GROUPS_ROW,
  buildConditionMatrix,
  cellKeyOf,
  PARTNER_COLUMN,
  ruleHeadline,
  type ConditionMatrixInput,
} from '../condition-matrix';

const NOW = Date.parse('2026-11-15T12:00:00.000Z');
const wire = <T>(id: string, fields: T) => ({ ...fields, id, revision: 1, isDeleted: false }) as unknown;

const TOSH = wire('dgrp_tosh', { code: 'tosh_carr', labels: { el: 'TOSH-CARR' } }) as DiscountGroupWire;
const ALPHA = wire('dgrp_alpha', { code: 'alpha', labels: { el: 'ALPHA' } }) as DiscountGroupWire;
const WHOLESALE = wire('cgrp_w', { code: 'wholesale', labels: { el: 'Χονδρέμπορος' } }) as CustomerGroupWire;

const chain = (...steps: number[]) => ({ kind: 'chain', steps }) as const;
const definition = (over: Partial<DiscountConditionDefinition>): DiscountConditionDefinition => ({
  discountGroupId: 'dgrp_tosh',
  audience: { kind: 'anonymous' },
  validFrom: null,
  validUntil: null,
  rule: chain(1000),
  ...over,
});
const condition = (id: string, over: Partial<DiscountConditionDefinition>) => wire(id, definition(over)) as DiscountConditionWire;

const input = (over: Partial<ConditionMatrixInput>): ConditionMatrixInput => ({
  discountGroups: [TOSH, ALPHA],
  customerGroups: [WHOLESALE],
  conditions: [],
  draft: null,
  nowMs: NOW,
  ...over,
});

describe('condition-matrix — SAP condition table: ομάδα έκπτωσης × κοινό', () => {
  it('άξονες: «Όλες» πρώτα + ομάδες κατά κωδικό · κοινά με τη σειρά ειδικότητας, μία στήλη ανά ομάδα πελατών', () => {
    const matrix = buildConditionMatrix(input({}));
    expect(matrix.rows.map((row) => row.key)).toEqual([ALL_GROUPS_ROW, 'dgrp_alpha', 'dgrp_tosh']);
    expect(matrix.columns.map((column) => column.key)).toEqual(['anonymous', 'signedIn', 'customerGroup:cgrp_w', PARTNER_COLUMN]);
  });

  it('κάθε συνθήκη στο κελί της· όλοι οι συνεργάτες σε ΜΙΑ στήλη, ο καθένας τρέχουσα στη δική του υποδοχή', () => {
    const conditions = [
      condition('c1', { discountGroupId: null, audience: { kind: 'customerGroup', customerGroupId: 'cgrp_w' } }),
      condition('c2', { audience: { kind: 'partner', party: { kind: 'contact', contactId: 'a' } } }),
      condition('c3', { audience: { kind: 'partner', party: { kind: 'contact', contactId: 'b' } } }),
    ];
    const matrix = buildConditionMatrix(input({ conditions }));
    expect(matrix.cells.get(cellKeyOf(ALL_GROUPS_ROW, 'customerGroup:cgrp_w'))?.current.map((entry) => entry.id)).toEqual(['c1']);
    const partners = matrix.cells.get(cellKeyOf('dgrp_tosh', PARTNER_COLUMN));
    expect(partners?.current.map((entry) => entry.id)).toEqual(['c2', 'c3']);
    expect(partners?.ambiguous).toBe(false);
  });

  it('περίοδοι του κελιού: ισχύουσα → μελλοντικές (νωρίτερη πρώτη) → ληγμένες (πιο πρόσφατη πρώτη)', () => {
    const conditions = [
      condition('expiredOld', { validUntil: '2026-01-01T00:00:00.000Z' }),
      condition('futureLate', { validFrom: '2027-03-01T00:00:00.000Z' }),
      condition('current', { validFrom: '2026-02-01T00:00:00.000Z', validUntil: '2026-12-01T00:00:00.000Z' }),
      condition('futureSoon', { validFrom: '2026-12-01T00:00:00.000Z', validUntil: '2027-03-01T00:00:00.000Z' }),
      condition('expiredRecent', { validFrom: '2026-01-01T00:00:00.000Z', validUntil: '2026-02-01T00:00:00.000Z' }),
    ];
    const cell = buildConditionMatrix(input({ conditions })).cells.get(cellKeyOf('dgrp_tosh', 'anonymous'));
    expect(cell?.entries.map((entry) => `${entry.id}:${entry.verdict}`)).toEqual([
      'current:valid', 'futureSoon:notYetValid', 'futureLate:notYetValid', 'expiredRecent:expired', 'expiredOld:expired',
    ]);
    expect(cell?.current.map((entry) => entry.id)).toEqual(['current']);
    expect(cell?.ambiguous).toBe(false);
  });

  it('ασάφεια με το ΠΡΟΧΕΙΡΟ, ζωντανά — και σημειώνονται ΚΑΙ οι δύο πλευρές (ισοπαλία ≠ «η πρώτη»)', () => {
    const conditions = [condition('stored', { validFrom: '2026-11-01T00:00:00.000Z' })];
    const draft = { id: 'dcnd_new', definition: definition({ validFrom: '2026-12-01T00:00:00.000Z' }) };
    const cell = buildConditionMatrix(input({ conditions, draft })).cells.get(cellKeyOf('dgrp_tosh', 'anonymous'));
    expect(cell?.ambiguous).toBe(true);
    expect(cell?.entries.filter((entry) => entry.ambiguous).map((entry) => entry.id).sort()).toEqual(['dcnd_new', 'stored'].sort());
  });

  it('Σ2 (ζωντανά): νέα συνθήκη σε αποστολή — το πρόχειρο αντικαθιστά την ΑΙΣΙΟΔΟΞΗ εγγραφή του, όχι «ασάφεια με τον εαυτό του»', () => {
    const conditions = [condition('dcnd_new', {})];
    const draft = { id: 'dcnd_new', definition: definition({}) };
    const cell = buildConditionMatrix(input({ conditions, draft })).cells.get(cellKeyOf('dgrp_tosh', 'anonymous'));
    expect(cell?.entries.map((entry) => [entry.id, entry.isDraft, entry.ambiguous])).toEqual([['dcnd_new', true, false]]);
    expect(cell?.ambiguous).toBe(false);
  });

  it('το πρόχειρο μιας αποθηκευμένης την ΑΝΤΙΚΑΘΙΣΤΑ (δεν συγκρούεται με τον εαυτό της) — και μετακομίζει κελί', () => {
    const conditions = [condition('c1', {})];
    const draft = { id: 'c1', definition: definition({ discountGroupId: null }) };
    const matrix = buildConditionMatrix(input({ conditions, draft }));
    expect(matrix.cells.get(cellKeyOf('dgrp_tosh', 'anonymous'))).toBeUndefined();
    const moved = matrix.cells.get(cellKeyOf(ALL_GROUPS_ROW, 'anonymous'));
    expect(moved?.entries.map((entry) => [entry.id, entry.isDraft, entry.ambiguous])).toEqual([['c1', true, false]]);
  });

  it('διαδοχικές περίοδοι [από, έως) δεν είναι ασάφεια · διαγραμμένη δεν μετρά · άγνωστη ομάδα λέγεται', () => {
    const conditions = [
      condition('nov', { validFrom: '2026-11-01T00:00:00.000Z', validUntil: '2026-12-01T00:00:00.000Z' }),
      condition('dec', { validFrom: '2026-12-01T00:00:00.000Z' }),
      { ...condition('gone', {}), isDeleted: true },
      condition('orphan', { discountGroupId: 'dgrp_deleted' }),
    ];
    const matrix = buildConditionMatrix(input({ conditions }));
    expect(matrix.cells.get(cellKeyOf('dgrp_tosh', 'anonymous'))?.ambiguous).toBe(false);
    expect(matrix.cells.get(cellKeyOf('dgrp_tosh', 'anonymous'))?.entries.map((entry) => entry.id)).toEqual(['nov', 'dec']);
    expect(matrix.unplaced).toBe(1);
  });
});

describe('ruleHeadline — τι γράφει το κελί', () => {
  it('«50 + 10» ⇒ −55%: τα βήματα ΠΟΛΛΑΠΛΑΣΙΑΖΟΝΤΑΙ, δεν προστίθενται', () => {
    expect(ruleHeadline(chain(5000, 1000))).toEqual({ kind: 'chain', steps: [5000, 1000], figure: { kind: 'single', percent: 55 } });
  });

  it('κλίμακες ⇒ πλήθος + εύρος · άκυρο βήμα ⇒ unreadable, ποτέ NaN%', () => {
    const tiers = { kind: 'tiers', basis: 'quantity', tiers: [{ min: 0, steps: [500] }, { min: 10, steps: [1000, 500] }] } as const;
    expect(ruleHeadline(tiers)).toEqual({ kind: 'tiers', count: 2, figure: { kind: 'range', lowest: 5, highest: 14.5 } });
    expect(ruleHeadline(chain(Number.NaN))).toEqual({ kind: 'unreadable' });
    expect(ruleHeadline({ kind: 'tiers', basis: 'amount', tiers: [] })).toEqual({ kind: 'unreadable' });
  });

  // 🔴 Ζωντανό εύρημα (ADR-923 «3δ» ζωντανή επαλήθευση): νέα συνθήκη έγραφε «−0%» στο κελί και κλίμακα «−0% … −0%» —
  //    το κελί είχε ΔΙΚΟ του κλάδο απόδοσης, χωρίς το «χωρίς έκπτωση» του κανόνα σε λέξεις.
  it('μηδέν ⇒ «χωρίς έκπτωση», ποτέ «−0%» — σε αλυσίδα ΚΑΙ σε κλίμακες', () => {
    expect(ruleHeadline(chain())).toEqual({ kind: 'chain', steps: [], figure: { kind: 'none' } });
    expect(ruleHeadline({ kind: 'tiers', basis: 'quantity', tiers: [{ min: 0, steps: [] }] }))
      .toEqual({ kind: 'tiers', count: 1, figure: { kind: 'none' } });
  });

  it('ίδια άκρα ⇒ ΕΝΑ ποσοστό · κάτω άκρο 0 ⇒ εύρος από το 0 (οι λέξεις: «έως −10%»)', () => {
    const same = { kind: 'tiers', basis: 'quantity', tiers: [{ min: 0, steps: [1000] }, { min: 10, steps: [1000] }] } as const;
    expect(ruleHeadline(same)).toEqual({ kind: 'tiers', count: 2, figure: { kind: 'single', percent: 10 } });
    const fromZero = { kind: 'tiers', basis: 'quantity', tiers: [{ min: 0, steps: [] }, { min: 10, steps: [1000] }] } as const;
    expect(ruleHeadline(fromZero)).toEqual({ kind: 'tiers', count: 2, figure: { kind: 'range', lowest: 0, highest: 10 } });
  });
});
