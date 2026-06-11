/**
 * ADR-370 — snap-description-keys (SSoT) tests.
 *
 * The 2D snap indicator and the 3D gizmo snap-type label both resolve labels here, so a
 * wrong mapping mislabels BOTH. Verifies the legacy BIM description map, the generic
 * `snapModes.labels.<type>` fallback, AND the ADR-370 characteristic-point composition
 * («Γωνία/Μέσο/Κέντρο» + entity noun).
 */

import {
  BIM_SNAP_DESCRIPTION_KEY,
  resolveSnapLabelKey,
  resolveBimSnapLabelText,
  resolveSnapLabelText,
} from '../snap-description-keys';
import { ExtendedSnapType } from '../extended-types';
import type { TFunction } from 'i18next';

// A t() stub that returns the key verbatim — lets us assert the composed key path.
const t = ((key: string) => key) as unknown as TFunction;

describe('snap-description-keys — legacy single-key map', () => {
  it('maps the wall FACE description (Slice 2i) to its own label key', () => {
    expect(BIM_SNAP_DESCRIPTION_KEY['bim-wall-face']).toBe('snapModes.labels.bim.wallFace');
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

describe('snap-description-keys — ADR-370 characteristic-point composition', () => {
  it('composes corner/mid/center labels from category + entity noun', () => {
    expect(resolveBimSnapLabelText(t, 'bim-wall-corner'))
      .toBe('snapModes.labels.bim.category.corner snapModes.labels.bim.noun.wall');
    expect(resolveBimSnapLabelText(t, 'bim-foundation-mid'))
      .toBe('snapModes.labels.bim.category.midpoint snapModes.labels.bim.noun.foundation');
    expect(resolveBimSnapLabelText(t, 'bim-column-center'))
      .toBe('snapModes.labels.bim.category.center snapModes.labels.bim.noun.column');
  });

  it('returns null for empty description («περίεργο σχήμα» → no label)', () => {
    expect(resolveBimSnapLabelText(t, '')).toBeNull();
    expect(resolveBimSnapLabelText(t, undefined)).toBeNull();
  });

  it('still resolves legacy non-characteristic descriptions', () => {
    expect(resolveBimSnapLabelText(t, 'bim-wall-face')).toBe('snapModes.labels.bim.wallFace');
    expect(resolveBimSnapLabelText(t, 'bim-mep-connector')).toBe('snapModes.labels.bim.mepConnector');
  });

  it('returns null for an unknown description (overlay shows glyph without text)', () => {
    expect(resolveBimSnapLabelText(t, 'something-else')).toBeNull();
  });

  it('resolveSnapLabelText falls back to the generic type label when no BIM label', () => {
    expect(resolveSnapLabelText(t, ExtendedSnapType.ENDPOINT)).toBe('snapModes.labels.endpoint');
    expect(resolveSnapLabelText(t, ExtendedSnapType.BIM_CORNER, 'bim-beam-corner'))
      .toBe('snapModes.labels.bim.category.corner snapModes.labels.bim.noun.beam');
  });
});
