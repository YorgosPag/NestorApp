/**
 * ADR-909 Γ2.9 — συμβόλαιο της λίστας πεδίων για ellipse / spline / point.
 *
 * Η αλυσίδα σκηνή → μετατροπέας → μοντέλο ζωγράφου κρίνεται στο `build-entity-model-coverage.test.ts`, και το
 * hit-test στο `hit-test-entity-model-coverage.test.ts`. Εδώ κρίνεται η ίδια η λίστα και οι δύο συναρτήσεις της.
 */

import {
  PRIMITIVE_RENDER_FIELDS,
  PRIMITIVE_REQUIRED_FIELDS,
  missingPrimitiveField,
  pickPrimitiveRenderFields,
  type PrimitiveRenderType,
} from '../primitive-render-fields';

const TYPES = Object.keys(PRIMITIVE_RENDER_FIELDS) as PrimitiveRenderType[];

describe('primitive-render-fields (ADR-909 Γ2.9)', () => {
  it('καλύπτει ακριβώς τους τρεις τύπους που δεν είχαν σχήμα', () => {
    expect([...TYPES].sort()).toEqual(['ellipse', 'point', 'spline']);
    expect(Object.keys(PRIMITIVE_REQUIRED_FIELDS).sort()).toEqual([...TYPES].sort());
  });

  it.each(TYPES)('"%s" — κάθε υποχρεωτικό πεδίο ΕΙΝΑΙ πεδίο όψης, και η λίστα δεν έχει διπλότυπα', (type) => {
    const all: readonly string[] = PRIMITIVE_RENDER_FIELDS[type];
    const required: readonly string[] = PRIMITIVE_REQUIRED_FIELDS[type];
    expect(required.length).toBeGreaterThan(0);
    for (const field of required) expect(all).toContain(field);
    expect(new Set(all).size).toBe(all.length);
  });

  it('pick: κρατά ΜΟΝΟ τα πεδία της λίστας — ό,τι άλλο κουβαλά η πηγή μένει έξω', () => {
    const source = { center: { x: 1, y: 2 }, majorAxis: 3, minorAxis: 2, id: 'e', layerId: 'L', strokeWidth: 9 };
    expect(pickPrimitiveRenderFields('ellipse', source)).toEqual({ center: { x: 1, y: 2 }, majorAxis: 3, minorAxis: 2 });
  });

  it('pick: πεδίο με τιμή `undefined` ΠΑΡΑΛΕΙΠΕΤΑΙ· το `0` και το `false` ΟΧΙ', () => {
    const picked = pickPrimitiveRenderFields('spline', {
      controlPoints: [], degree: 0, closed: false, knots: undefined, weights: undefined,
    });
    expect(picked).toEqual({ controlPoints: [], degree: 0, closed: false });
    expect('knots' in picked).toBe(false);
  });

  it('pick: δεν ανακατεύει τύπους — το `position` δεν είναι πεδίο έλλειψης', () => {
    expect(pickPrimitiveRenderFields('ellipse', { position: { x: 1, y: 1 } })).toEqual({});
    expect(pickPrimitiveRenderFields('point', { position: { x: 1, y: 1 } })).toEqual({ position: { x: 1, y: 1 } });
  });

  it('missing: πλήρες ⇒ undefined· αλλιώς το ΠΡΩΤΟ που λείπει, με το όνομά του', () => {
    expect(missingPrimitiveField('ellipse', { center: {}, majorAxis: 1, minorAxis: 1 })).toBeUndefined();
    expect(missingPrimitiveField('ellipse', { center: {}, minorAxis: 1 })).toBe('majorAxis');
    expect(missingPrimitiveField('ellipse', {})).toBe('center');
    expect(missingPrimitiveField('spline', {})).toBe('controlPoints');
    expect(missingPrimitiveField('point', { position: { x: 0, y: 0 } })).toBeUndefined();
  });
});
