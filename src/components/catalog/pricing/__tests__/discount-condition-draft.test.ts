import { localDateOf } from '@/lib/date-local';
import type { DiscountRule } from '@/lib/pricing/discount-rule';
import { validityAt } from '@/lib/pricing/validity';
import { conditionWindow } from '@/subapps/catalog/schema/validate-pricing';
import type { DiscountConditionDefinition } from '@/subapps/catalog/types/price-list';
import type { DiscountConditionWire } from '@/subapps/catalog/types/pricing-views';
import {
  chainExample,
  conditionDraftIssues,
  conditionDraftPlan,
  emptyConditionDraft,
  nextPeriodStart,
  nextTier,
  pickerOfLastDay,
  pickerOfValidFrom,
  tierExamples,
  validFromOfPicker,
  validUntilOfLastDay,
  withRuleKind,
  withTierBasis,
  type ConditionDraftContext,
} from '../discount-condition-draft';

const day = (year: number, month: number, date: number) => new Date(year, month - 1, date);

const base = (over: Partial<DiscountConditionDefinition> = {}): DiscountConditionDefinition => ({
  ...emptyConditionDraft({ discountGroupId: 'dgrp_tosh', audience: { kind: 'anonymous' }, validFrom: null }),
  rule: { kind: 'chain', steps: [5000, 1000] },
  ...over,
});
const stored = (id: string, definition: DiscountConditionDefinition) => ({ ...definition, id, revision: 1, isDeleted: false }) as unknown as DiscountConditionWire;

const context = (over: Partial<ConditionDraftContext> = {}): ConditionDraftContext => ({
  discountGroupIds: new Set(['dgrp_tosh']),
  customerGroupIds: new Set(['cgrp_w']),
  conditions: [],
  selfId: null,
  ...over,
});
const codes = (draft: DiscountConditionDefinition, ctx = context()) => conditionDraftIssues(draft, ctx).map((issue) => `${issue.code}@${issue.path}`);

describe('ισχύς σε ημέρες — «τελευταία ημέρα» συμπεριληπτικά, όπως το VK11', () => {
  it('«έως και 30/11» ισχύει ΟΛΗ την 30/11 και λήγει στην αρχή της 1/12', () => {
    const window = conditionWindow(base({ validFrom: validFromOfPicker(day(2026, 11, 1)), validUntil: validUntilOfLastDay(day(2026, 11, 30)) }));
    expect(window).not.toBeNull();
    if (window === null) return;
    expect(validityAt(window, day(2026, 11, 30).getTime() + 23 * 3_600_000)).toBe('valid');
    expect(validityAt(window, day(2026, 12, 1).getTime())).toBe('expired');
    expect(validityAt(window, day(2026, 10, 31).getTime() + 23 * 3_600_000)).toBe('notYetValid');
  });

  it('στρογγυλή διαδρομή επιλογέα ↔ αποθήκευσης: ίδια ημέρα πίσω· κενό ⇔ null', () => {
    const until = validUntilOfLastDay(day(2026, 11, 30));
    expect(localDateOf(pickerOfLastDay(until) ?? new Date(0))).toBe('2026-11-30');
    const from = validFromOfPicker(day(2026, 3, 29));
    expect(localDateOf(pickerOfValidFrom(from) ?? new Date(0))).toBe('2026-03-29');
    expect([validFromOfPicker(undefined), validUntilOfLastDay(undefined), pickerOfLastDay(null), pickerOfValidFrom(null)]).toEqual([null, null, undefined, undefined]);
  });

  it('η λήξη την ίδια ημέρα με την έναρξη είναι έγκυρη (μία ημέρα), νωρίτερα ⇒ ανάποδο διάστημα', () => {
    const oneDay = base({ validFrom: validFromOfPicker(day(2026, 11, 5)), validUntil: validUntilOfLastDay(day(2026, 11, 5)) });
    expect(codes(oneDay)).toEqual([]);
    const inverted = base({ validFrom: validFromOfPicker(day(2026, 11, 5)), validUntil: validUntilOfLastDay(day(2026, 11, 3)) });
    expect(codes(inverted)).toEqual(['validityRangeInverted@validUntil']);
  });
});

describe('κανόνας — εναλλαγή χωρίς απώλεια, κλίμακες', () => {
  const tiers: Extract<DiscountRule, { kind: 'tiers' }> = { kind: 'tiers', basis: 'quantity', tiers: [{ min: 10, steps: [1000] }, { min: 0, steps: [500] }] };

  it('αλυσίδα → πρώτη κλίμακα · κλίμακες → η ΧΑΜΗΛΟΤΕΡΗ (όχι η πρώτη δηλωμένη)', () => {
    expect(withRuleKind({ kind: 'chain', steps: [5000] }, 'tiers')).toEqual({ kind: 'tiers', basis: 'quantity', tiers: [{ min: 0, steps: [5000] }] });
    expect(withRuleKind(tiers, 'chain')).toEqual({ kind: 'chain', steps: [500] });
  });

  it('αλλαγή βάσης μετατρέπει: 10 τεμ. ↔ 10,00 € (λεπτά), και πίσω ίδιο', () => {
    const amount = withTierBasis(tiers, 'amount');
    expect(amount).toEqual({ kind: 'tiers', basis: 'amount', tiers: [{ min: 1000, steps: [1000] }, { min: 0, steps: [500] }] });
    expect(amount.kind === 'tiers' ? withTierBasis(amount, 'quantity') : null).toEqual(tiers);
  });

  it('επόμενη κλίμακα: διπλάσιο κατώφλι του υψηλότερου, ίδια αλυσίδα', () => {
    expect(nextTier(tiers)).toEqual({ min: 20, steps: [1000] });
    expect(nextTier({ kind: 'tiers', basis: 'amount', tiers: [] })).toEqual({ min: 10_000, steps: [] });
  });

  it('μη μονότονες κλίμακες ⇒ η ΙΔΙΑ επικύρωση με τον γραφέα (ακριβότερη η μονάδα σε μεγαλύτερη αγορά)', () => {
    const rule = { kind: 'tiers', basis: 'quantity', tiers: [{ min: 0, steps: [1000] }, { min: 10, steps: [500] }] } as const;
    expect(codes(base({ rule }))).toEqual(['discountTiersNotMonotonic@rule.tiers']);
  });
});

describe('ζωντανό παράδειγμα — η ΙΔΙΑ μηχανή', () => {
  it('100,00 € «50 + 10» ⇒ 50,00 € ⇒ 45,00 € (πολλαπλασιαστικά, όχι 40,00 €)', () => {
    expect(chainExample([5000, 1000])).toEqual({ gross: 10_000, steps: [{ step: 5000, net: 5000 }, { step: 1000, net: 4500 }], discount: 5500, net: 4500 });
  });

  it('μία στρογγύλευση ανά ενδιάμεσο ποσό (όχι αλυσιδωτά στρογγυλεμένα βήματα)', () => {
    const example = chainExample([3333, 3333], 1);
    expect(example?.net).toBe(0);
    expect(chainExample([Number.NaN])).toBeNull();
  });

  it('κλίμακες κατά αύξον κατώφλι, ανεξάρτητα από τη σειρά δήλωσης', () => {
    const rule = { kind: 'tiers', basis: 'quantity', tiers: [{ min: 10, steps: [1000] }, { min: 0, steps: [500] }] } as const;
    expect(tierExamples(rule).map((tier) => [tier.min, tier.example?.net])).toEqual([[0, 9500], [10, 9000]]);
  });
});

describe('ευρήματα — ό,τι θα έλεγε ο γραφέας, πριν από την αποστολή', () => {
  it('έγκυρο ⇒ κανένα · άγνωστη ομάδα · συνεργάτης χωρίς συμβαλλόμενο', () => {
    expect(codes(base())).toEqual([]);
    expect(codes(base({ discountGroupId: 'dgrp_x' }))).toEqual(['unknownReference@discountGroupId']);
    expect(codes(base({ audience: { kind: 'partner', party: { kind: 'contact', contactId: '' } } }))).toEqual(['unknownParty@audience.party']);
  });

  it('ασάφεια με το id της ΑΛΛΗΣ συνθήκης (για τον σύνδεσμο) — ποτέ με τον εαυτό της', () => {
    const other = stored('cdcnd_other', base());
    const issues = conditionDraftIssues(base(), context({ conditions: [other] }));
    expect(issues).toEqual([{ code: 'discountConditionAmbiguous', path: 'validFrom', params: { conditionId: 'cdcnd_other' } }]);
    expect(codes(base(), context({ conditions: [other], selfId: 'cdcnd_other' }))).toEqual([]);
  });

  // Σ7 (ζωντανή επαλήθευση): «Νέα περίοδος από 1/12» πάνω σε ανοιχτή ήταν ΠΑΝΤΑ ασάφεια με κλειδωμένη αποθήκευση.
  it('Σ7: νέα περίοδος μέσα σε ανοιχτή ⇒ ΟΡΙΟΘΕΤΗΣΗ, όχι εύρημα · ίδια αρχή ⇒ ασάφεια (καμία «προηγούμενη»)', () => {
    const open = stored('cdcnd_open', base());
    const december = validFromOfPicker(day(2026, 12, 1));
    const next = base({ validFrom: december });
    expect(conditionDraftIssues(next, context({ conditions: [open] }))).toEqual([]);
    expect(conditionDraftPlan(next, context({ conditions: [open] })).delimitations).toEqual([{ id: 'cdcnd_open', validUntil: december }]);
    const twin = stored('cdcnd_twin', base({ validFrom: december }));
    expect(codes(next, context({ conditions: [twin] }))).toEqual(['discountConditionAmbiguous@validFrom']);
  });
});

describe('«Νέα περίοδος» — πού αρχίζει (Σ7)', () => {
  const now = day(2026, 10, 30).getTime() + 15 * 3_600_000;

  it('αύριο (ποτέ αναδρομικά, ποτέ «από πάντα») — ανοιχτή προηγούμενη δεν μετακινεί την αρχή, την οριοθετεί η αποθήκευση', () => {
    expect(nextPeriodStart([], now)).toBe(validFromOfPicker(day(2026, 10, 31)));
    expect(nextPeriodStart([{ validFrom: null, validUntil: null }], now)).toBe(validFromOfPicker(day(2026, 10, 31)));
  });

  it('μετά το ΤΕΛΕΥΤΑΙΟ όριο αν είναι αργότερα (συνέχεια χωρίς κενό) · ληγμένα όρια δεν μετρούν', () => {
    const lastDay = validUntilOfLastDay(day(2026, 11, 30));
    const periods = [{ validFrom: null, validUntil: validUntilOfLastDay(day(2026, 3, 1)) }, { validFrom: null, validUntil: lastDay }, { validFrom: null, validUntil: null }];
    expect(nextPeriodStart(periods, now)).toBe(lastDay);
  });

  // Σ7 ζωντανά, μετά την αποθήκευση «−40% από 1/12»: η επόμενη «Νέα περίοδος» άρχιζε 1/12 = ΙΔΙΑ αρχή ⇒ ασάφεια.
  it('τουλάχιστον την ΕΠΟΜΕΝΗ ημέρα της πιο πρόσφατης έναρξης — ώστε η ανοιχτή τελευταία να οριοθετείται, όχι να συγκρούεται', () => {
    const periods = [{ validFrom: null, validUntil: validFromOfPicker(day(2026, 12, 1)) }, { validFrom: validFromOfPicker(day(2026, 12, 1)), validUntil: null }];
    expect(nextPeriodStart(periods, now)).toBe(validFromOfPicker(day(2026, 12, 2)));
  });
});
