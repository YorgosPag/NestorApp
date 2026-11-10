/**
 * @fileoverview company-vat-regime — ο ΕΝΑΣ κριτής του καθεστώτος ΦΠΑ της επιχείρησης (ADR-ACC-003 §22.4)
 */

import { GREEK_EXEMPT_VAT_RATE, GREEK_STANDARD_VAT_RATE } from '../../config/vat-rates';
import { requiresVatExemption } from '../../mydata/mydata-codes';
import {
  companyLineVatDefault,
  isCompanyVatRegime,
  parseCompanyVatRegime,
  withVatRegime,
} from '../company-vat-regime';

describe('GREEK_EXEMPT_VAT_RATE', () => {
  it('είναι ο συντελεστής «Άνευ ΦΠΑ» που απαιτεί αιτία (κατηγορία myDATA 7)', () => {
    expect(GREEK_EXEMPT_VAT_RATE).toBe(0);
    expect(requiresVatExemption(GREEK_EXEMPT_VAT_RATE)).toBe(true);
  });
});

describe('companyLineVatDefault', () => {
  it('χωρίς προφίλ ⇒ κανονικός συντελεστής, χωρίς αιτία', () => {
    expect(companyLineVatDefault(null)).toEqual({ vatRate: GREEK_STANDARD_VAT_RATE, vatExemptionCategory: null });
  });

  it('κανονικό καθεστώς ⇒ κανονικός συντελεστής, ακόμη κι αν (παλιό έγγραφο) έμεινε κωδικός', () => {
    expect(companyLineVatDefault({ vatRegime: 'normal', vatExemptionCategory: 15 })).toEqual({
      vatRate: GREEK_STANDARD_VAT_RATE,
      vatExemptionCategory: null,
    });
  });

  it('απαλλασσόμενη με κωδ. 15 ⇒ 0% + 15', () => {
    expect(companyLineVatDefault({ vatRegime: 'exempt', vatExemptionCategory: 15 })).toEqual({
      vatRate: 0,
      vatExemptionCategory: 15,
    });
  });

  it.each([undefined, null, 99, 1.5])('απαλλασσόμενη με κωδικό %p ⇒ 0% ΧΩΡΙΣ αιτία (καμία μαντεψιά)', (code) => {
    expect(companyLineVatDefault({ vatRegime: 'exempt', vatExemptionCategory: code })).toEqual({
      vatRate: 0,
      vatExemptionCategory: null,
    });
  });
});

describe('withVatRegime', () => {
  it('σε κανονικό ⇒ η αιτία καθαρίζει', () => {
    expect(withVatRegime({ vatRegime: 'exempt' as const, vatExemptionCategory: 15 }, 'normal')).toEqual({
      vatRegime: 'normal',
      vatExemptionCategory: null,
    });
  });

  it('σε απαλλασσόμενη ⇒ η αιτία μένει', () => {
    expect(withVatRegime({ vatRegime: 'exempt' as const, vatExemptionCategory: 7 }, 'exempt')).toEqual({
      vatRegime: 'exempt',
      vatExemptionCategory: 7,
    });
  });

  it('δεν μεταλλάσσει το όρισμα', () => {
    const input = Object.freeze({ vatRegime: 'exempt' as const, vatExemptionCategory: 15 });
    expect(() => withVatRegime(input, 'normal')).not.toThrow();
    expect(input.vatExemptionCategory).toBe(15);
  });
});

describe('isCompanyVatRegime', () => {
  it.each(['normal', 'exempt'])('%s ⇒ true', (value) => expect(isCompanyVatRegime(value)).toBe(true));
  it.each(['common', '', null, 1])('%p ⇒ false', (value) => expect(isCompanyVatRegime(value)).toBe(false));
});

describe('parseCompanyVatRegime', () => {
  it('απουσία ⇒ κανονικό / null (όπως πριν)', () => {
    expect(parseCompanyVatRegime({})).toEqual({ kind: 'value', vatRegime: 'normal', vatExemptionCategory: null });
  });

  it('απαλλασσόμενη χωρίς κωδικό ⇒ έγκυρη (σημάδι «λείπει», όπως το πρόχειρο)', () => {
    expect(parseCompanyVatRegime({ vatRegime: 'exempt', vatExemptionCategory: null })).toEqual({
      kind: 'value',
      vatRegime: 'exempt',
      vatExemptionCategory: null,
    });
  });

  it('απαλλασσόμενη με κωδ. 15 ⇒ τιμή', () => {
    expect(parseCompanyVatRegime({ vatRegime: 'exempt', vatExemptionCategory: 15 })).toEqual({
      kind: 'value',
      vatRegime: 'exempt',
      vatExemptionCategory: 15,
    });
  });

  it.each(['common', 'EXEMPT', 1])('άγνωστο καθεστώς %p ⇒ invalid', (vatRegime) => {
    expect(parseCompanyVatRegime({ vatRegime }).kind).toBe('invalid');
  });

  it.each([0, 32, 15.5, '15'])('κωδικός εκτός §8.3 %p ⇒ invalid', (vatExemptionCategory) => {
    expect(parseCompanyVatRegime({ vatRegime: 'exempt', vatExemptionCategory }).kind).toBe('invalid');
  });

  it('🔴 αντίφαση: κωδικός σε κανονικό καθεστώς ⇒ invalid, ποτέ σιωπηλή διόρθωση', () => {
    expect(parseCompanyVatRegime({ vatRegime: 'normal', vatExemptionCategory: 15 })).toEqual({
      kind: 'invalid',
      reason: 'vatExemptionCategory is allowed only when vatRegime is exempt',
    });
  });
});
