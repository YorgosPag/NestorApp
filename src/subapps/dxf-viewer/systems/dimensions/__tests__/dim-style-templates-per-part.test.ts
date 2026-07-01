/**
 * ADR-562 Φ1 — per-part styling data-model defaults.
 *
 * Locks the contract for the new `DimStyle` fields added in Φ1 (lineweight /
 * linetype per part + separate arrow-color channel) across the 3 built-in
 * templates. Φ2 (renderer) relies on these defaults resolving to ByLayer.
 */

import { BUILTIN_DIM_STYLES } from '../dim-style-templates';

describe('ADR-562 Φ1 — per-part DimStyle defaults', () => {
  it('every built-in template carries ByLayer lineweight (dimlwd/dimlwe = -2)', () => {
    for (const style of BUILTIN_DIM_STYLES) {
      expect(style.dimlwd).toBe(-2);
      expect(style.dimlwe).toBe(-2);
    }
  });

  it('every built-in template carries ByLayer linetype (dim + both extensions)', () => {
    for (const style of BUILTIN_DIM_STYLES) {
      expect(style.dimltype).toBe('ByLayer');
      expect(style.dimltex1).toBe('ByLayer');
      expect(style.dimltex2).toBe('ByLayer');
    }
  });

  it('arrowColor is an unset override channel → arrows inherit dimclrd', () => {
    // Optional by design: absent means `arrowColor ?? dimclrd` resolves to the
    // dim-line color (incl. ASME/Arch dimclrd=5), not a hardcoded ByLayer.
    for (const style of BUILTIN_DIM_STYLES) {
      expect(style.arrowColor).toBeUndefined();
    }
  });
});
