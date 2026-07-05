/**
 * ADR-370 §unified-glyph (2026-07-05) — snap visual SSoT regression guard.
 *
 * A BIM corner/midpoint/centre is the SAME KIND of point as the geometric
 * endpoint/midpoint/centre, so — like Revit/AutoCAD — it MUST render with the SAME
 * colour (the entity noun lives in the label, not in a distinct colour). This guard
 * locks that unification so a future palette edit cannot silently re-diverge them.
 *
 * @see rendering/ui/snap/snap-visual-config.ts — resolveSnapColor SSoT
 * @see canvas-v2/overlays/SnapIndicatorGlyph.tsx — the matching ■/△/○ shape unification
 */

import { resolveSnapColor } from '../snap-visual-config';

describe('snap-visual-config — BIM/geometric colour unification (ADR-370 §unified-glyph)', () => {
  it('bim_corner shares the endpoint colour', () => {
    expect(resolveSnapColor('bim_corner')).toBe(resolveSnapColor('endpoint'));
  });

  it('bim_midpoint shares the midpoint colour', () => {
    expect(resolveSnapColor('bim_midpoint')).toBe(resolveSnapColor('midpoint'));
  });

  it('bim_center shares the center colour', () => {
    expect(resolveSnapColor('bim_center')).toBe(resolveSnapColor('center'));
  });

  it('separate-kind BIM snaps keep their own colour (NOT unified)', () => {
    // wall-face / mep-connector are distinct KINDS of point (not corner/mid/centre),
    // so they must NOT collapse onto endpoint's colour.
    expect(resolveSnapColor('bim_wall_face')).not.toBe(resolveSnapColor('endpoint'));
    expect(resolveSnapColor('bim_mep_connector')).not.toBe(resolveSnapColor('endpoint'));
  });
});
