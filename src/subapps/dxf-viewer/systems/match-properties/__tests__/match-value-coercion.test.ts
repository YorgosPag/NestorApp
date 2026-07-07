/**
 * ADR-581 — Value coercion tests.
 */

import { coerceValue } from '../match-value-coercion';
import { COERCE_SKIP, type ColorValue } from '../match-types';
import { getDescriptorByKey, __clearMatchRegistryCache } from '../match-registry';

beforeEach(() => __clearMatchRegistryCache());

const transparency = () => getDescriptorByKey('line', 'scene.transparency')!;
const material = () => getDescriptorByKey('column', 'params.material')!;
const color = () => getDescriptorByKey('line', 'scene.color')!;
const linetype = () => getDescriptorByKey('line', 'scene.linetypeName')!;

describe('coerceValue', () => {
  it('αριθμός → clamp στα όρια του target (transparency 0..1)', () => {
    const d = transparency();
    expect(coerceValue(2, d, d)).toBe(1);
    expect(coerceValue(-3, d, d)).toBe(0);
    expect(coerceValue(0.4, d, d)).toBe(0.4);
  });

  it('enum: άγνωστη τιμή → SKIP, γνωστή → pass', () => {
    const d = material();
    expect(coerceValue('titanium', d, d)).toBe(COERCE_SKIP);
    expect(coerceValue('steel', d, d)).toBe('steel');
  });

  it('color: ατομικό ColorValue περνάει, κενό → SKIP', () => {
    const d = color();
    const c: ColorValue = { color: '#ff0000', colorMode: 'Concrete', colorAci: 1 };
    expect(coerceValue(c, d, d)).toEqual(c);
    expect(coerceValue({}, d, d)).toBe(COERCE_SKIP);
  });

  it('type mismatch (number → string descriptor) → SKIP', () => {
    expect(coerceValue(5 as unknown as string, transparency(), linetype())).toBe(COERCE_SKIP);
  });

  it('undefined → SKIP', () => {
    const d = transparency();
    expect(coerceValue(undefined, d, d)).toBe(COERCE_SKIP);
  });
});
