import { evaluateConsistency } from '../../rules/evaluate-consistency';
import { PLATFORM_MEASUREMENT_REGISTRY } from '../../measurement/measurement-registry';
import { MFP_ATTRIBUTE_MAP, MFP_FAMILY } from '../../__tests__/fixtures/mfp-fan-coil.fixture';
import { amountFromCanonical, amountIdentityKey, isCanonicalAmount, parseEnteredAmount } from '../decimal-amount';
import { normalizeUniqueText, uniqueValueKey } from '../normalize-unique';

describe('parseEnteredAmount — ό,τι πληκτρολογεί ο άνθρωπος → κανονικό ποσό', () => {
  it.each([
    ['2,50', '2.50', 2.5, 2],
    ['2.50', '2.50', 2.5, 2],
    ['1.200,50', '1200.50', 1200.5, 2],
    ['1,200.50', '1200.50', 1200.5, 2],
    ['1.200.000', '1200000', 1200000, 0],
    ['−3,5', '-3.5', -3.5, 1],
    ['+4', '4', 4, 0],
    ['007', '7', 7, 0],
    ['0,05', '0.05', 0.05, 2],
    ['-0,0', '0.0', 0, 1],
    ['  15,4 ', '15.4', 15.4, 1],
  ])('%p → %p', (input, amount, value, decimals) => {
    expect(parseEnteredAmount(input)).toEqual({ amount, value, decimals });
  });

  it.each(['', ' ', '2,5 kW', 'abc', '1e3', '0x10', '1,2,3', '1.23.4', '--2', '2,', ',5', 'Infinity', '12 345'])(
    '🔴 %p ⇒ null (ποτέ σιωπηλή αφαίρεση θορύβου, ποτέ μαντεψιά)',
    (input) => {
      expect(parseEnteredAmount(input)).toBeNull();
    },
  );

  it('ακολουθεί τον ΕΝΑΝ κανόνα της πλατφόρμας: ένα μόνο διαχωριστικό = υποδιαστολή', () => {
    expect(parseEnteredAmount('1.200')?.amount).toBe('1.200');
  });

  it('απορρίπτει ακρίβεια που δεν χωρά σε double (> 15 σημαντικά ψηφία)', () => {
    expect(parseEnteredAmount('1234567890,1234567')).toBeNull();
    expect(parseEnteredAmount('123456789012345')).not.toBeNull();
  });
});

describe('κανονικό ποσό — η μορφή αποθήκευσης', () => {
  it.each(['0', '2.50', '-3.5', '1200', '0.05'])('%p είναι κανονικό', (amount) => {
    expect(isCanonicalAmount(amount)).toBe(true);
    expect(amountFromCanonical(amount)?.amount).toBe(amount);
  });

  it.each(['2,50', '007', '-0', '-0.0', '1.', '.5', '1e3', ' 1'])('%p ΔΕΝ είναι κανονικό', (amount) => {
    expect(isCanonicalAmount(amount)).toBe(false);
  });

  it('κλειδί ισότητας: «1.50» ≡ «1.5» ≡ «1.500», η ακρίβεια μένει στο ποσό', () => {
    expect(new Set(['1.50', '1.5', '1.500'].map(amountIdentityKey))).toEqual(new Set(['1.5']));
    expect(amountIdentityKey('2.0')).toBe('2');
    expect(amountIdentityKey('1200')).toBe('1200');
  });
});

describe('normalizeUniqueText — η ΜΙΑ ταυτότητα κωδικού (κράτηση + κανόνας + εισαγωγή)', () => {
  it.each([
    [' 016-15-001 ', '016-15-001'],
    ['016–15–001', '016-15-001'], // en dash από PDF
    ['016‑15‑001', '016-15-001'], // non-breaking hyphen
    ['０１６-15-001', '016-15-001'], // πλήρους πλάτους
    ['016-15-​001', '016-15-001'], // μηδενικού πλάτους
    ['MFP-34TM', 'mfp-34tm'],
    ['ΚΩΔΙΚΟΣ', 'κωδικοσ'], // τελικό σίγμα
    ['Straße', 'strasse'],
    ['A  B', 'a b'],
  ])('%p ≡ %p', (input, key) => {
    expect(normalizeUniqueText(input)).toBe(key);
  });

  it('🔑 ΔΕΝ ταυτίζει ομόγλυφα: ελληνικό «Α» ≠ λατινικό «A» (αυτό είναι προειδοποίηση, όχι ταυτότητα)', () => {
    expect(normalizeUniqueText('ΑB-1')).not.toBe(normalizeUniqueText('AB-1'));
    expect(normalizeUniqueText('I1')).not.toBe(normalizeUniqueText('11'));
  });

  it('κρατά τους τόνους: «Κωδικός» ≠ «Κωδικος»', () => {
    expect(normalizeUniqueText('Κωδικός')).not.toBe(normalizeUniqueText('Κωδικος'));
  });

  it('κλειδί τιμής: κείμενο → κανονικοποίηση, αριθμός → κλειδί ισότητας, κενό → null', () => {
    expect(uniqueValueKey({ type: 'text', text: ' 099-01-001' })).toBe('099-01-001');
    expect(uniqueValueKey({ type: 'number', amount: '12.50' })).toBe('12.5');
    expect(uniqueValueKey({ type: 'text', text: '  ' })).toBeNull();
    expect(uniqueValueKey({ type: 'boolean', value: true })).toBeNull();
  });

  it('🔴 ο κανόνας `unique` της οικογένειας ΣΥΜΦΩΝΕΙ με την κράτηση (ίδια κανονικοποίηση)', () => {
    const violations = evaluateConsistency({
      rules: MFP_FAMILY.consistencyRules.filter((rule) => rule.kind === 'unique'),
      rows: [
        { variantId: 'a', values: { model_code: '016-15-001' } },
        { variantId: 'b', values: { model_code: ' 016–15–001' } },
      ],
      schemeAxisIds: ['size'],
      attributes: MFP_ATTRIBUTE_MAP,
      registry: PLATFORM_MEASUREMENT_REGISTRY,
    });
    expect(violations).toEqual([expect.objectContaining({ ruleId: 'rule_unique_code', variantIds: ['a', 'b'] })]);
  });
});
