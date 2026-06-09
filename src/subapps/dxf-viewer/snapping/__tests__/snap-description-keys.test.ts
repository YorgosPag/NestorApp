/**
 * ADR-363 Φ1G.5 Slice 2i — snap-description-keys (SSoT) tests.
 *
 * The 2D snap indicator and the 3D gizmo snap-type label both resolve labels through
 * this map, so a wrong key here mislabels BOTH. Verifies the BIM description map + the
 * generic `snapModes.labels.<type>` fallback.
 */

import { BIM_SNAP_DESCRIPTION_KEY, resolveSnapLabelKey } from '../snap-description-keys';
import { ExtendedSnapType } from '../extended-types';

describe('snap-description-keys', () => {
  it('maps the wall FACE description (Slice 2i) to its own label key', () => {
    expect(BIM_SNAP_DESCRIPTION_KEY['bim-wall-face']).toBe('snapModes.labels.bim.wallFace');
  });

  it('keeps the existing wall CORNER key distinct from the face key', () => {
    expect(BIM_SNAP_DESCRIPTION_KEY['bim-wall-corner']).toBe('snapModes.labels.bim.wallCorner');
  });

  it('resolveSnapLabelKey prefers the BIM description over the type', () => {
    expect(resolveSnapLabelKey(ExtendedSnapType.BIM_WALL_FACE, 'bim-wall-face'))
      .toBe('snapModes.labels.bim.wallFace');
  });

  it('resolveSnapLabelKey falls back to snapModes.labels.<type> for a generic snap', () => {
    expect(resolveSnapLabelKey(ExtendedSnapType.ENDPOINT)).toBe('snapModes.labels.endpoint');
    expect(resolveSnapLabelKey(ExtendedSnapType.MIDPOINT, 'Midpoint')).toBe('snapModes.labels.midpoint');
  });
});
