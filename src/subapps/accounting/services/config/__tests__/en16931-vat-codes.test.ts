/**
 * @fileoverview en16931-vat-codes — η ΜΙΑ ρίζα UNCL5305 + VATEX v9 (ADR-ACC-003 §22.6)
 */

import {
  EN16931_CATEGORY_RULES,
  EN16931_EXEMPT_CATEGORIES,
  EN16931_VAT_CATEGORIES,
  VATEX_ARTICLE_CODES,
  VATEX_CATEGORY_BOUND_CODES,
  VATEX_CODES,
  VATEX_CODE_LIST,
  isVatexCode,
  vatexCategory,
} from '../en16931-vat-codes';

describe('VATEX v9 (eu)', () => {
  it('έκδοση 9.0 — 62 κωδικοί eu (54 άρθρων Οδηγίας + 8 με δεσμό κατηγορίας), μοναδικοί', () => {
    expect(VATEX_CODE_LIST.version).toBe(9);
    expect(VATEX_ARTICLE_CODES).toHaveLength(54);
    expect(VATEX_CATEGORY_BOUND_CODES).toHaveLength(8);
    expect(VATEX_CODES).toHaveLength(62);
    expect(new Set(VATEX_CODES).size).toBe(62);
    for (const code of VATEX_CODES) expect(code).toMatch(/^VATEX-EU-[0-9A-Z-]+$/);
  });

  it('οι κωδικοί που πρόσθεσαν οι εκδόσεις 6–8 υπάρχουν (λείπουν από το BIS v8.1 της ΓΓΠΣ)', () => {
    for (const code of ['VATEX-EU-135-1', 'VATEX-EU-144', 'VATEX-EU-146-1E', 'VATEX-EU-153', 'VATEX-EU-159']) {
      expect(isVatexCode(code)).toBe(true);
    }
  });

  it.each([
    ['VATEX-EU-AE', 'AE'],
    ['VATEX-EU-IC', 'K'],
    ['VATEX-EU-G', 'G'],
    ['VATEX-EU-O', 'O'],
    ['VATEX-EU-D', 'E'],
    ['VATEX-EU-F', 'E'],
    ['VATEX-EU-I', 'E'],
    ['VATEX-EU-J', 'E'],
  ] as const)('Peppol P0104–P0111: %s ⇒ κατηγορία %s', (code, category) => {
    expect(vatexCategory(code)).toBe(category);
  });

  it('κάθε κωδικός άρθρου Οδηγίας δένει με E', () => {
    for (const code of VATEX_ARTICLE_CODES) expect(vatexCategory(code)).toBe('E');
  });

  it.each([['VATEX-EU-IC '], ['vatex-eu-ae'], ['VATEX-FR-FRANCHISE'], [''], [null], [42]])(
    'isVatexCode(%p) === false — εθνικοί κωδικοί και παραλλαγές εκτός ρίζας',
    (value) => {
      expect(isVatexCode(value)).toBe(false);
    },
  );
});

describe('EN16931_CATEGORY_RULES', () => {
  it('οι κατηγορίες με αιτία είναι υποσύνολο του UNCL5305 του EN 16931', () => {
    for (const category of EN16931_EXEMPT_CATEGORIES) expect(EN16931_VAT_CATEGORIES).toContain(category);
  });

  it('κάθε κατηγορία με αιτία την απαιτεί (BR-x-10)· S / Z την απαγορεύουν (BR-S-10 / BR-Z-10)', () => {
    for (const category of EN16931_EXEMPT_CATEGORIES) {
      expect(EN16931_CATEGORY_RULES[category].exemptionReason).toBe('required');
    }
    expect(EN16931_CATEGORY_RULES.S.exemptionReason).toBe('forbidden');
    expect(EN16931_CATEGORY_RULES.Z.exemptionReason).toBe('forbidden');
  });

  it('O: απαγορεύει ΑΦΜ πωλητή/αγοραστή (BR-O-02) και κάθε άλλη κατηγορία (BR-O-11)', () => {
    expect(EN16931_CATEGORY_RULES.O).toMatchObject({ sellerVatId: 'forbidden', buyerVatId: 'forbidden', exclusive: true });
  });

  it('G απαιτεί ΑΦΜ πωλητή (BR-G-02) — γι’ αυτό εκεί πηγαίνει η υπηρεσία εκτός ΕΕ, όχι στο O', () => {
    expect(EN16931_CATEGORY_RULES.G.sellerVatId).toBe('required');
  });

  it('AE / K απαιτούν ταυτοποίηση αγοραστή (BR-AE-02 / BR-IC-02)· K και στοιχεία παράδοσης (BR-IC-11/12)', () => {
    expect(EN16931_CATEGORY_RULES.AE.buyerVatId).toBe('requiredOrRegistration');
    expect(EN16931_CATEGORY_RULES.K.buyerVatId).toBe('required');
    expect(EN16931_CATEGORY_RULES.K.extra).toEqual(['deliveryDateOrPeriod', 'deliverToCountry']);
  });
});
