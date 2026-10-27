/**
 * Επικύρωση τιμοκαταλόγου και συνθηκών (ADR-923 §5.11) + τα zod schemas του συνόρου.
 *
 * @module subapps/catalog/schema/__tests__/validate-pricing
 */

import {
  MFP_PRICE_LIST,
  PARTNER_TOSH_CARR,
  TOSH_CARR,
  VERSION_1_LINES,
  WHOLESALE,
  WHOLESALE_TOSH_CARR,
} from '../../__tests__/fixtures/mfp-price-list.fixture';
import type { DiscountConditionDefinition, PriceListLineDefinition } from '../../types/price-list';
import {
  findAmbiguousConditions,
  validateDiscountCondition,
  validateDiscountRule,
  validatePriceList,
  validatePriceListLine,
  validateVersionLines,
} from '../validate-pricing';
import { discountConditionDefinitionSchema, priceListLineDefinitionSchema } from '../zod/price-list.schema';

const codes = (issues: readonly { code: string }[]): string[] => issues.map((issue) => issue.code);

const lineContext = { priceType: 'net_list' as const, discountGroupIds: new Set([TOSH_CARR]) };
const conditionContext = { discountGroupIds: new Set([TOSH_CARR]), customerGroupIds: new Set([WHOLESALE]) };
const listContext = { customerGroupIds: new Set([WHOLESALE]) };

const costItem: PriceListLineDefinition = {
  versionId: 'v',
  subject: { kind: 'costItem', atoeCode: 'ΟΙΚ-7.01', region: null },
  netPrice: 4500,
  priceQuantity: 1,
  unitCode: 'm2',
  discountGroupId: null,
  breakdown: { material: 3000, labor: 1200, equipment: 300, defaultWasteBp: 500, materialVariantId: null },
};

describe('τιμοκατάλογος και γραμμές', () => {
  it('ο τιμοκατάλογος και οι γραμμές του fixture είναι έγκυρα', () => {
    expect(validatePriceList(MFP_PRICE_LIST.definition, listContext)).toEqual([]);
    for (const line of VERSION_1_LINES) expect(validatePriceListLine(line, lineContext)).toEqual([]);
    expect(validateVersionLines(VERSION_1_LINES)).toEqual([]);
    expect(validatePriceListLine(costItem, lineContext)).toEqual([]);
  });

  it('κοινό τιμοκαταλόγου (3β απόφαση Α): η λίστα κόστους δεν προσφέρεται· άγνωστη ομάδα πελάτη = unknownReference', () => {
    const list = MFP_PRICE_LIST.definition;
    expect(codes(validatePriceList({ ...list, kind: 'cost' }, listContext))).toEqual(['costListHasAudience']);
    expect(validatePriceList({ ...list, kind: 'cost', audience: null }, listContext)).toEqual([]);
    const known = { kind: 'customerGroup' as const, customerGroupId: WHOLESALE };
    expect(validatePriceList({ ...list, audience: known }, listContext)).toEqual([]);
    const unknown = validatePriceList({ ...list, audience: { kind: 'customerGroup', customerGroupId: 'ccgrp_x' } }, listContext);
    expect(unknown).toEqual([{ code: 'unknownReference', path: 'audience.customerGroupId' }]);
  });

  it('φράχτης ανά λίστα (3β απόφαση Β): μέσα στα όρια 5%–50% συμπεριληπτικά, ακέραιες μονάδες βάσης', () => {
    const list = MFP_PRICE_LIST.definition;
    for (const changeFenceBp of [null, 500, 2000, 5000]) expect(validatePriceList({ ...list, changeFenceBp }, listContext)).toEqual([]);
    for (const changeFenceBp of [499, 5001, 0, 1000.5]) {
      expect(validatePriceList({ ...list, changeFenceBp }, listContext)).toEqual([
        { code: 'fenceOutOfBounds', path: 'changeFenceBp', params: { min: 5, max: 50 } },
      ]);
    }
  });

  it('net_customer δεν δέχεται ομάδα έκπτωσης· άγνωστη ομάδα = unknownReference', () => {
    const line = VERSION_1_LINES[0];
    expect(codes(validatePriceListLine(line, { ...lineContext, priceType: 'net_customer' }))).toEqual(['discountGroupNotAccepted']);
    expect(codes(validatePriceListLine({ ...line, discountGroupId: 'cdgrp_x' }, lineContext))).toEqual(['unknownReference']);
  });

  it('ποσό, ποσότητα τιμής, μονάδα', () => {
    const line = { ...VERSION_1_LINES[0], netPrice: 12.5, priceQuantity: 7, unitCode: "" } as unknown as PriceListLineDefinition;
    expect(codes(validatePriceListLine(line, lineContext))).toEqual(['priceAmountInvalid', 'priceQuantityInvalid', 'measurementUnitUnknown']);
  });

  it('ανάλυση κόστους: υποχρεωτική για εργασία, απαγορευμένη για SKU, άθροισμα = τιμή μονάδας', () => {
    expect(codes(validatePriceListLine({ ...costItem, breakdown: null }, lineContext))).toEqual(['costBreakdownRequired']);
    expect(codes(validatePriceListLine({ ...VERSION_1_LINES[0], breakdown: costItem.breakdown }, lineContext))).toEqual([
      'costBreakdownNotAllowed',
    ]);
    expect(codes(validatePriceListLine({ ...costItem, netPrice: 4501 }, lineContext))).toEqual(['costBreakdownMismatch']);
  });

  it('δεύτερη γραμμή για το ίδιο είδος στην ίδια έκδοση', () => {
    const issues = validateVersionLines([...VERSION_1_LINES, VERSION_1_LINES[2]]);
    expect(issues).toEqual([{ code: 'priceLineSubjectDuplicate', path: 'lines[8].subject', params: { subject: 'variant:cpr_mfp_68' } }]);
  });
});

describe('κανόνας έκπτωσης', () => {
  it('ποσοστά εκτός 0..100% ή μη ακέραιες μονάδες βάσης· πάνω από 5 βήματα', () => {
    expect(codes(validateDiscountRule({ kind: 'chain', steps: [10001] }))).toEqual(['discountStepInvalid']);
    expect(codes(validateDiscountRule({ kind: 'chain', steps: [12.5] }))).toEqual(['discountStepInvalid']);
    expect(codes(validateDiscountRule({ kind: 'chain', steps: [1, 1, 1, 1, 1, 1] }))).toEqual(['tooMany']);
  });

  it('κλίμακες: τουλάχιστον μία, χωρίς διπλό κατώφλι, μονότονες', () => {
    expect(codes(validateDiscountRule({ kind: 'tiers', basis: 'quantity', tiers: [] }))).toEqual(['discountTiersRequired']);
    const duplicate = [{ min: 10, steps: [100] }, { min: 10, steps: [200] }];
    expect(codes(validateDiscountRule({ kind: 'tiers', basis: 'quantity', tiers: duplicate }))).toEqual(['discountTierDuplicate']);
    // από 10 τεμάχια «50» < «40+20» (52%) των 5 τεμαχίων ⇒ ακριβότερη μονάδα για όποιον αγοράζει περισσότερα
    const inverted = [{ min: 10, steps: [5000] }, { min: 5, steps: [4000, 2000] }];
    expect(validateDiscountRule({ kind: 'tiers', basis: 'quantity', tiers: inverted })).toEqual([
      { code: 'discountTiersNotMonotonic', path: 'rule.tiers', params: { min: 10 } },
    ]);
  });

  it('κατώφλι ποσού = ακέραια λεπτά· κατώφλι ποσότητας έως 3 δεκαδικά', () => {
    expect(codes(validateDiscountRule({ kind: 'tiers', basis: 'amount', tiers: [{ min: 99.5, steps: [100] }] }))).toEqual([
      'discountTierMinInvalid',
    ]);
    expect(validateDiscountRule({ kind: 'tiers', basis: 'quantity', tiers: [{ min: 0.125, steps: [100] }] })).toEqual([]);
  });
});

describe('συνθήκη και ασάφεια', () => {
  const withWindow = (validFrom: string | null, validUntil: string | null): DiscountConditionDefinition => ({
    ...WHOLESALE_TOSH_CARR.definition,
    validFrom,
    validUntil,
  });

  it('οι συνθήκες του fixture είναι έγκυρες και μη ασαφείς μεταξύ τους', () => {
    expect(validateDiscountCondition(WHOLESALE_TOSH_CARR.definition, conditionContext)).toEqual([]);
    expect(findAmbiguousConditions(WHOLESALE_TOSH_CARR.definition, [PARTNER_TOSH_CARR])).toEqual([]);
  });

  it('ανάποδη περίοδος, άκυρη ημερομηνία, άγνωστη ομάδα πελάτη', () => {
    expect(codes(validateDiscountCondition(withWindow('2026-05-01T00:00:00Z', '2026-04-01T00:00:00Z'), conditionContext))).toEqual([
      'validityRangeInverted',
    ]);
    expect(codes(validateDiscountCondition(withWindow('όχι-ημερομηνία', null), conditionContext))).toEqual(['invalidDate']);
    const foreign = { ...WHOLESALE_TOSH_CARR.definition, audience: { kind: 'customerGroup' as const, customerGroupId: 'ccgrp_x' } };
    expect(codes(validateDiscountCondition(foreign, conditionContext))).toEqual(['unknownReference']);
  });

  it('ίδιο κοινό + ίδια ομάδα + επικαλυπτόμενη ισχύς ⇒ ασάφεια· διαδοχικές περίοδοι ⇒ όχι', () => {
    const others = [{ id: 'cdcnd_q1', definition: withWindow('2026-01-01T00:00:00Z', '2026-04-01T00:00:00Z') }];
    expect(findAmbiguousConditions(withWindow('2026-03-01T00:00:00Z', null), others)).toEqual([
      { code: 'discountConditionAmbiguous', path: 'validFrom', params: { conditionId: 'cdcnd_q1' } },
    ]);
    expect(findAmbiguousConditions(withWindow('2026-04-01T00:00:00Z', null), others)).toEqual([]);
  });
});

describe('zod — σύνορο δομής', () => {
  it('δέχεται τις γραμμές και τις συνθήκες του fixture', () => {
    expect(priceListLineDefinitionSchema.safeParse(VERSION_1_LINES[0]).success).toBe(true);
    expect(priceListLineDefinitionSchema.safeParse(costItem).success).toBe(true);
    expect(discountConditionDefinitionSchema.safeParse(PARTNER_TOSH_CARR.definition).success).toBe(true);
  });

  it('αρνείται ποσό σε ευρώ αντί λεπτών, ποσότητα τιμής εκτός λεξιλογίου, άγνωστο κοινό', () => {
    expect(priceListLineDefinitionSchema.safeParse({ ...VERSION_1_LINES[0], netPrice: 520.5 }).success).toBe(false);
    expect(priceListLineDefinitionSchema.safeParse({ ...VERSION_1_LINES[0], priceQuantity: 5 }).success).toBe(false);
    const audience = { kind: 'everyone' };
    expect(discountConditionDefinitionSchema.safeParse({ ...PARTNER_TOSH_CARR.definition, audience }).success).toBe(false);
  });
});
