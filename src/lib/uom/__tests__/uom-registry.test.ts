/**
 * ADR-923 §5.11 «3γ» Α10 — ΤΟ ΜΗΤΡΩΟ ΜΟΝΑΔΩΝ: μία γραφή ⇒ ένας κωδικός, κάθε κωδικός ⇒ ετικέτα σε κάθε γλώσσα.
 */

import elUom from '@/i18n/locales/el/uom.json';
import enUom from '@/i18n/locales/en/uom.json';
import { BOQ_MEASUREMENT_UNITS, BOQ_PICKER_UNITS } from '@/types/boq/units';
import { PROCUREMENT_UNIT_OPTIONS } from '@/config/procurement-units';
import {
  DEFAULT_UOM,
  adoptedUom,
  UOM_CODES,
  UOM_REGISTRY,
  isSpelledOutUom,
  isUomCode,
  normalizeUomText,
  resolveUom,
  uneceCodeOf,
  type UomCode,
} from '../uom-registry';

describe('ακεραιότητα μητρώου', () => {
  it('καμία γραφή δεν λύνεται σε δύο κωδικούς', () => {
    const owner = new Map<string, UomCode>();
    const clashes: string[] = [];
    for (const code of UOM_CODES) {
      const { unece, aliases } = UOM_REGISTRY[code];
      for (const spelling of [code, ...(unece ? [unece] : []), ...aliases]) {
        const key = normalizeUomText(spelling);
        const prior = owner.get(key);
        if (prior !== undefined && prior !== code) clashes.push(`${spelling}: ${prior} ≠ ${code}`);
        owner.set(key, code);
      }
    }
    expect(clashes).toEqual([]);
  });

  it('κάθε γραφή του μητρώου λύνεται στον δικό της κωδικό', () => {
    for (const code of UOM_CODES) {
      const { unece, aliases } = UOM_REGISTRY[code];
      for (const spelling of [code, ...(unece ? [unece] : []), ...aliases]) {
        expect([spelling, resolveUom(spelling)]).toEqual([spelling, code]);
      }
    }
  });

  it('κωδικοί UN/ECE: μοναδικοί, 2–3 χαρακτήρες Rec 20 ή X + Rec 21', () => {
    const codes = UOM_CODES.map((code) => UOM_REGISTRY[code].unece).filter((c): c is string => c !== null);
    expect(new Set(codes).size).toBe(codes.length);
    for (const unece of codes) expect(unece).toMatch(/^(?:[A-Z0-9]{2,3}|X[A-Z0-9]{2})$/);
  });

  it('μονάδες-λέξεις (spelledOut) = μετρούμενα ουσιαστικά: συσκευασίες Rec 21 + σετ/ζεύγος — το σύμβολό τους σε κάθε γλώσσα είναι λέξη χωρίς τελεία', () => {
    const spelled = UOM_CODES.filter((code) => UOM_REGISTRY[code].spelledOut);
    expect(spelled).toEqual(['set', 'pair', 'bag', 'box', 'pallet', 'roll', 'container', 'pack']);
    for (const code of spelled) {
      for (const bundle of [elUom, enUom]) expect(bundle.symbol[code]).toMatch(/^\p{L}{3,}$/u);
    }
  });

  it('isSpelledOutUom: κάθε γραφή της μονάδας-λέξης· όχι συντομογραφία, όχι άγνωστη', () => {
    expect([isSpelledOutUom('σακ'), isSpelledOutUom('XBG'), isSpelledOutUom('ζεύγη')]).toEqual([true, true, true]);
    expect([isSpelledOutUom('pcs'), isSpelledOutUom('τεμ'), isSpelledOutUom('lump')]).toEqual([false, false, false]);
    expect([isSpelledOutUom('καρότσι'), isSpelledOutUom(null)]).toEqual([false, false]);
  });

  it('μόνο το kWp δεν έχει κωδικό UN/ECE (η Rec 20 έχει KWT = kW, όχι μέγιστη ισχύ)', () => {
    expect(UOM_CODES.filter((code) => UOM_REGISTRY[code].unece === null)).toEqual(['kWp']);
  });
});

describe('resolveUom — ανεκτική ανάγνωση κάθε παλιού λεξιλογίου', () => {
  it.each([
    ['τεμ', 'pcs'], ['τμχ', 'pcs'], ['ΤΕΜΑΧΙΟ', 'pcs'], ['τεμαχιο', 'pcs'], ['H87', 'pcs'], ['C62', 'pcs'],
    ['m²', 'm2'], ['M2', 'm2'], ['τ.μ.', 'm2'], ['Τ. Μ.', 'm2'], ['m³', 'm3'], ['κ.μ.', 'm3'],
    ['l', 'lt'], ['LTR', 'lt'], ['ώρα', 'hr'], ['σακ', 'bag'], ['XBG', 'bag'], ['παλ', 'pallet'], ['ζεύγ', 'pair'],
    ['δοχ', 'container'], ['ρολ', 'roll'], ['κουτ', 'box'], ["κατ' αποκοπή", 'lump'], ['kwp', 'kWp'],
  ])('«%s» ⇒ %s', (raw, code) => {
    expect(resolveUom(raw)).toBe(code);
  });

  it.each([[''], ['   '], [null], [undefined], ['σημεία'], ['kW']])('«%s» ⇒ null (άγνωστη ή κενή)', (raw) => {
    expect(resolveUom(raw)).toBeNull();
  });

  it('ο κωδικός UN/ECE της αποθηκευμένης γραφής (EN 16931 BT-130)', () => {
    expect(uneceCodeOf('τεμ')).toBe('H87');
    expect(uneceCodeOf('m²')).toBe('MTK');
    expect(uneceCodeOf('kWp')).toBeNull();
    expect(uneceCodeOf('σημεία')).toBeNull();
  });

  it('isUomCode δέχεται μόνο κανονικό κωδικό, όχι γραφή', () => {
    expect(isUomCode('pcs')).toBe(true);
    expect(isUomCode('τεμ')).toBe(false);
  });
});

describe('adoptedUom — η γραμμή υιοθετεί τη μονάδα της πηγής μόνο από την προεπιλογή', () => {
  it('υλικό BOQ `pcs` σε γραμμή με την παλιά προεπιλογή `τεμ` ⇒ κανονικός κωδικός (το ζωντανό σύμπτωμα Α10)', () => {
    expect(adoptedUom('τεμ', 'pcs')).toBe('pcs');
    expect(adoptedUom('pcs', 'm2')).toBe('m2');
    expect(adoptedUom('pcs', 'τ.μ.')).toBe('m2');
  });

  it('μονάδα που διάλεξε άνθρωπος δεν αντικαθίσταται', () => {
    expect(adoptedUom('kg', 'pcs')).toBeNull();
  });

  it('πηγή χωρίς μονάδα ⇒ καμία αλλαγή· άγνωστη ⇒ αυτούσια', () => {
    expect(adoptedUom('pcs', null)).toBeNull();
    expect(adoptedUom('pcs', '  ')).toBeNull();
    expect(adoptedUom('pcs', ' σημεία ')).toBe('σημεία');
  });
});

describe('ετικέτες: κάθε κωδικός σε κάθε γλώσσα, τίποτα παραπάνω', () => {
  it.each([['el', elUom], ['en', enUom]])('%s', (_language, bundle) => {
    expect(Object.keys(bundle.symbol).sort()).toEqual([...UOM_CODES].sort());
    expect(Object.keys(bundle.name).sort()).toEqual([...UOM_CODES].sort());
  });
});

describe('οι προβολές του μητρώου', () => {
  it('η προεπιλογή και κάθε λίστα επιλογής είναι κανονικοί κωδικοί', () => {
    expect(isUomCode(DEFAULT_UOM)).toBe(true);
    for (const code of [...PROCUREMENT_UNIT_OPTIONS, ...BOQ_MEASUREMENT_UNITS]) expect(isUomCode(code)).toBe(true);
  });

  it('η λίστα επιλογής BOQ = όλες οι μονάδες BOQ εκτός kWp (το δηλώνει μόνο η κατηγορία ΦΒ)', () => {
    expect(BOQ_PICKER_UNITS).toEqual(BOQ_MEASUREMENT_UNITS.filter((code) => code !== 'kWp'));
  });

  it('η παραγγελία προσφέρει την προεπιλογή', () => {
    expect(PROCUREMENT_UNIT_OPTIONS).toContain(DEFAULT_UOM);
  });
});
