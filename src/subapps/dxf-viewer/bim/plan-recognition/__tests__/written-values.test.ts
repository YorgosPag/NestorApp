/**
 * ADR-929 Φ0.5 — το SSoT των γραμμένων τιμών: μήκη με μονάδα, μονάδα σκέτων ακεραίων ανά σχέδιο, κλίμακα, εμβαδό, είδος.
 */

import {
  classifyWrittenText, inferBareIntegerUnit, parseDimensionValue, parseWrittenAreaM2, parseWrittenScale, writtenDimensions, writtenLengthsMm, writtenLike,
  writtenNumberTokens,
} from '../reading/written-values';
import { writtenPrecisionMm } from '../fusion/dimension-precision';

describe('parseDimensionValue — μήκος από το κείμενο όπως γράφτηκε', () => {
  it.each([
    ['3.50', null, 3500, 10, 'm'],
    ['2,85', null, 2850, 10, 'm'],
    ['3.505', null, 3505, 1, 'm'],
    ['350', 'cm', 3500, 10, 'cm'],
    ['3500', 'mm', 3500, 1, 'mm'],
    ['350 cm', null, 3500, 10, 'cm'],
    ['35εκ.', null, 350, 10, 'cm'],
    ['3.50m', null, 3500, 10, 'm'],
    ['3500mm', null, 3500, 1, 'mm'],
  ] as const)('«%s» (ακέραιοι σε %s) ⇒ %d mm, ακρίβεια %d mm, %s', (raw, bare, valueMm, precisionMm, unit) => {
    const got = parseDimensionValue(raw, bare);
    expect(got).not.toBeNull();
    expect(got?.valueMm).toBeCloseTo(valueMm, 6);
    expect(got?.precisionMm).toBeCloseTo(precisionMm, 6);
    expect(got?.unit).toBe(unit);
  });

  it.each([
    ['350', null],
    ['3.50x3.40', 'cm'],
    ['+3.20', 'cm'],
    ['0.80/2.20', 'cm'],
    ['ΣΑΛΟΝΙ', 'cm'],
    ['3.50 kg', 'cm'],
    ['0', 'cm'],
    ['3.50⁵', 'cm'],
  ] as const)('«%s» (ακέραιοι σε %s) ⇒ null, ποτέ μαντεψιά', (raw, bare) => {
    expect(parseDimensionValue(raw, bare)).toBeNull();
  });
});

describe('inferBareIntegerUnit — η μονάδα των ακεραίων τη λέει το σχέδιο', () => {
  it('μέτρα με δεκαδικά στο ίδιο σχέδιο ⇒ οι ακέραιοι είναι εκατοστά', () => {
    expect(inferBareIntegerUnit(['3.50', '20', '4.15'])).toBe('cm');
  });
  it('μόνο ακέραιοι ⇒ δεν αποδεικνύεται', () => {
    expect(inferBareIntegerUnit(['350', '20', '415'])).toBeNull();
  });
  it('ρητή μονάδα εκατοστών δεν είναι απόδειξη μέτρων', () => {
    expect(inferBareIntegerUnit(['350 cm', '20'])).toBeNull();
  });
});

describe('writtenLengthsMm — Φ0.6: ο ΕΝΑΣ κανόνας τιμής για OCR και VLM', () => {
  it('η μονάδα των σκέτων ακεραίων κρίνεται ΜΙΑ φορά από όλο το σύνολο, ανεξάρτητα από τη σειρά', () => {
    expect(writtenLengthsMm(['20', '3.50', '250'])).toEqual([200, 3500, 2500]);
    expect(writtenLengthsMm(['3.50', '20', '250'])).toEqual([3500, 200, 2500]);
  });
  it('μόνο ακέραιοι ⇒ καμία τιμή (η μονάδα δεν αποδεικνύεται)· ρητή μονάδα μετρά πάντα', () => {
    expect(writtenLengthsMm(['350', '415'])).toEqual([null, null]);
    expect(writtenLengthsMm(['350', '35 εκ.', '3500 mm'])).toEqual([null, 350, 3500]);
  });
  it('κείμενο που δεν είναι μήκος ⇒ null στη θέση του, η αντιστοίχιση θέσεων μένει', () => {
    expect(writtenLengthsMm(['Α1', '3,50', '', '1:50'])).toEqual([null, 3500, null, null]);
    expect(writtenLengthsMm([])).toEqual([]);
  });
});

describe('κλίμακα, εμβαδό, είδος', () => {
  it.each([['1:100', 100], ['Κλ. 1:50', 50], ['ΚΛΙΜΑΚΑ 1 : 200', 200], ['11:50', null], ['1:1', null], ['ΣΑΛΟΝΙ', null]] as const)(
    'κλίμακα «%s» ⇒ %s', (raw, expected) => expect(parseWrittenScale(raw)).toBe(expected),
  );
  it.each([['24 τ.μ.', 24], ['24,5 m²', 24.5], ['Ε=231.04τμ', 231.04], ['3.50', null]] as const)(
    'εμβαδό «%s» ⇒ %s', (raw, expected) => expect(parseWrittenAreaM2(raw)).toBe(expected),
  );
  it.each([
    ['3.50', 'dimension'], ['20', 'dimension'], ['350 cm', 'dimension'], ['1:50', 'scale'], ['24 τ.μ.', 'area'],
    ['0.80/2.20', 'opening-size'], ['ΣΑΛΟΝΙ', 'other'], ['+3.20', 'other'], ['3.50x3.40', 'other'],
  ] as const)('«%s» ⇒ %s', (raw, kind) => expect(classifyWrittenText(raw)).toBe(kind));
});

describe('ένα SSoT — η ακρίβεια της σύντηξης διαβάζει τους ίδιους αριθμούς', () => {
  it('writtenNumberTokens βρίσκει κάθε αριθμό του κειμένου', () => {
    expect(writtenNumberTokens('3.50x3,40')).toEqual(['3.50', '3,40']);
  });
  it('writtenPrecisionMm συμφωνεί με το parseDimensionValue', () => {
    for (const [raw, bare] of [['3.50', null], ['350', 'cm'], ['3500', 'mm']] as const) {
      const length = parseDimensionValue(raw, bare);
      expect(length).not.toBeNull();
      if (length !== null) expect(writtenPrecisionMm(raw, length.valueMm)).toBe(length.precisionMm);
    }
  });
});

describe('ADR-929 Δ21 (ε) — «μ.μ.» = μέτρα· «μμ» χωρίς τελείες ΔΕΝ γίνεται δεκτό', () => {
  it.each([['4,12 μ.μ.', 4120], ['2.05μ.μ', 2050], ['4.12 Μ.Μ.', 4120]] as const)('«%s» ⇒ %d mm, μέτρα, διάσταση', (raw, valueMm) => {
    const got = parseDimensionValue(raw, null);
    expect(got?.unit).toBe('m');
    expect(got?.valueMm).toBeCloseTo(valueMm, 6);
    expect(classifyWrittenText(raw)).toBe('dimension');
  });
  it.each(['4,12 μμ', '412μμ'])('«%s» ⇒ καμία τιμή, όχι διάσταση (σύγχυση με χιλιοστά)', (raw) => {
    expect(parseDimensionValue(raw, 'cm')).toBeNull();
    expect(classifyWrittenText(raw)).toBe('other');
  });
  it('«μ.μ.» στο σχέδιο ⇒ οι σκέτοι ακέραιοι γίνονται εκατοστά (ο ΙΔΙΟΣ κανόνας)', () => {
    expect(writtenLengthsMm(['4,12 μ.μ.', '20'])).toEqual([4120, 200]);
  });
});

describe('ADR-929 Δ21 (δ) βήμα 8 — writtenDimensions: η ΜΙΑ μετατροπή «κείμενα → διαστάσεις»', () => {
  const conf = { score: 0.8, factors: { reading: 0.8 } };
  const candidate = (textId: string, raw: string, segmentIds: readonly string[] = []) => ({ textId, raw, segmentIds, confidence: conf });

  it('κρατά τμήματα και βεβαιότητα της πηγής, τιμή από τον κανόνα', () => {
    expect(writtenDimensions([candidate('t1', '3.50', ['s1', 's2'])])).toEqual([
      { textId: 't1', valueMm: 3500, segmentIds: ['s1', 's2'], confidence: conf },
    ]);
  });
  it('η μονάδα των σκέτων ακεραίων κρίνεται από ΟΛΟ το σύνολο, μία φορά', () => {
    expect(writtenDimensions([candidate('t1', '20'), candidate('t2', '3.50')]).map((d) => d.valueMm)).toEqual([200, 3500]);
  });
  it('χωρίς αποδεδειγμένη μονάδα ή κενό κείμενο ⇒ καμία διάσταση (ποτέ μαντεψιά)', () => {
    expect(writtenDimensions([candidate('t1', '20'), candidate('t2', ''), candidate('t3', '0.00')])).toEqual([]);
  });
});

describe('ADR-929 Δ21 (δ) βήμα 7 — writtenLike: μήκος γραμμένο όπως το γράφει το σχέδιο', () => {
  it.each([
    [4118.3, '4.15', null, '4.12'],
    [4118, '4,15 μ.μ.', null, '4,12 μ.μ.'],
    [4118, '412', 'cm', '412'],
    [3421, '350 cm', null, '342 cm'],
    [4118.3, '3.505', null, '4.118'],
    [3700, '4.12', null, '3.70'],
  ] as const)('%d mm σαν «%s» (ακέραιοι σε %s) ⇒ «%s»', (valueMm, sample, bare, expected) => {
    expect(writtenLike(valueMm, sample, bare)).toBe(expected);
  });
  it('ξαναδιαβάζεται από τον ΙΔΙΟ κανόνα στην ακρίβεια γραφής του δείγματος', () => {
    const written = writtenLike(4118.3, '4,15 μ.μ.', null) ?? '';
    expect(parseDimensionValue(written, null)?.valueMm).toBeCloseTo(4120, 6);
  });
  it('δείγμα που δεν είναι μήκος, ακέραιος χωρίς αποδεδειγμένη μονάδα, ή τιμή ≤ 0 ⇒ null', () => {
    expect(writtenLike(4118, 'ΣΑΛΟΝΙ', null)).toBeNull();
    expect(writtenLike(4118, '412', null)).toBeNull();
    expect(writtenLike(0, '4.15', null)).toBeNull();
    expect(writtenLike(2, '4.15', null)).toBeNull();
  });
});
