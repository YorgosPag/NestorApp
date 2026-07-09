/**
 * ADR-611 — opening-frame-profile-bridge pure resolver tests.
 *
 * Covers: manufacturer/profile combobox state derivation, cascading
 * manufacturer→profile default pick, the CATALOG_CUSTOM_SENTINEL flip on
 * hand-edited faceWidth/depth, and the legacy `frameWidth` zero-regression
 * fallback (no `frameProfileId` anywhere).
 */

import {
  resolveOpeningFrameProfileComboboxState,
  buildOpeningFrameProfileParamsPatch,
} from '../opening-frame-profile-bridge';
import { OPENING_RIBBON_KEYS } from '../opening-command-keys';
import { CATALOG_CUSTOM_SENTINEL } from '../../../../../bim/types/opening-frame-profile';
import type { OpeningEntity, OpeningParams } from '../../../../../bim/types/opening-types';

function makeOpening(paramsOverride: Partial<OpeningParams>): OpeningEntity {
  const params: OpeningParams = {
    kind: 'window',
    wallId: 'wall-1',
    width: 1200,
    height: 1400,
    sillHeight: 900,
    offsetFromStart: 500,
    ...paramsOverride,
  };
  return {
    id: 'op-1',
    type: 'opening',
    layerId: 'lvl-1',
    visible: true,
    kind: params.kind,
    ifcType: 'IfcWindow',
    params,
    geometry: {} as OpeningEntity['geometry'],
    validation: { isValid: true, hardErrors: [], softWarnings: [], hasCodeViolations: false },
  } as OpeningEntity;
}

describe('resolveOpeningFrameProfileComboboxState', () => {
  it('legacy opening (no frameProfileId, no frameWidth) resolves the catalog default', () => {
    const opening = makeOpening({});
    const profileState = resolveOpeningFrameProfileComboboxState(
      OPENING_RIBBON_KEYS.frameProfile.profile,
      opening,
    );
    expect(profileState?.value).toBe('GENERIC-70x70-frame');
    const faceWidthState = resolveOpeningFrameProfileComboboxState(
      OPENING_RIBBON_KEYS.frameProfile.faceWidth,
      opening,
    );
    expect(faceWidthState?.value).toBe('70');
  });

  it('legacy opening WITH frameWidth resolves faceWidth = depth = frameWidth (zero regression)', () => {
    const opening = makeOpening({ frameWidth: 45 });
    const faceWidthState = resolveOpeningFrameProfileComboboxState(
      OPENING_RIBBON_KEYS.frameProfile.faceWidth,
      opening,
    );
    const depthState = resolveOpeningFrameProfileComboboxState(
      OPENING_RIBBON_KEYS.frameProfile.depth,
      opening,
    );
    expect(faceWidthState?.value).toBe('45');
    expect(depthState?.value).toBe('45');
  });

  it('profile options are filtered to the resolved manufacturer + always include the custom row', () => {
    const opening = makeOpening({ frameProfileId: 'ALUMIL-M9660-frame' });
    const profileState = resolveOpeningFrameProfileComboboxState(
      OPENING_RIBBON_KEYS.frameProfile.profile,
      opening,
    );
    const values = profileState?.options.map((o) => o.value) ?? [];
    expect(values).toContain(CATALOG_CUSTOM_SENTINEL);
    expect(values).toContain('ALUMIL-M9660-frame');
    expect(values).not.toContain('EUROPA-A5500-frame');
  });

  it('manufacturer combobox lists all catalog manufacturers with the resolved brand as value', () => {
    const opening = makeOpening({ frameProfileId: 'EUROPA-A5500-frame' });
    const state = resolveOpeningFrameProfileComboboxState(
      OPENING_RIBBON_KEYS.frameProfile.manufacturer,
      opening,
    );
    expect(state?.value).toBe('Europa');
    expect(state?.options.map((o) => o.value)).toEqual(
      expect.arrayContaining(['Generic', 'Alumil', 'Europa', 'Elvial', 'Exalco']),
    );
  });
});

describe('buildOpeningFrameProfileParamsPatch', () => {
  it('picking a manufacturer assigns that brand\'s default frame profile + clears overrides', () => {
    const opening = makeOpening({
      frameProfileId: CATALOG_CUSTOM_SENTINEL,
      frameProfileOverrides: { faceWidth: 999, depth: 999 },
    });
    const next = buildOpeningFrameProfileParamsPatch(
      OPENING_RIBBON_KEYS.frameProfile.manufacturer,
      'Elvial',
      opening,
    );
    expect(next?.frameProfileId).toBe('ELVIAL-4400-frame');
    expect(next?.frameProfileOverrides).toBeUndefined();
  });

  it('picking a catalog profile clears any prior overrides', () => {
    const opening = makeOpening({
      frameProfileId: CATALOG_CUSTOM_SENTINEL,
      frameProfileOverrides: { faceWidth: 33, depth: 44 },
    });
    const next = buildOpeningFrameProfileParamsPatch(
      OPENING_RIBBON_KEYS.frameProfile.profile,
      'ALUMIL-S350-frame',
      opening,
    );
    expect(next?.frameProfileId).toBe('ALUMIL-S350-frame');
    expect(next?.frameProfileOverrides).toBeUndefined();
  });

  it('hand-editing faceWidth flips frameProfileId to the custom sentinel, seeding depth from the resolved profile', () => {
    const opening = makeOpening({ frameProfileId: 'ALUMIL-M9660-frame' }); // faceWidth 72, depth 60
    const next = buildOpeningFrameProfileParamsPatch(
      OPENING_RIBBON_KEYS.frameProfile.faceWidth,
      '80',
      opening,
    );
    expect(next?.frameProfileId).toBe(CATALOG_CUSTOM_SENTINEL);
    expect(next?.frameProfileOverrides?.faceWidth).toBe(80);
  });

  it('hand-editing depth on an already-custom profile only changes depth', () => {
    const opening = makeOpening({
      frameProfileId: CATALOG_CUSTOM_SENTINEL,
      frameProfileOverrides: { faceWidth: 80, depth: 60 },
    });
    const next = buildOpeningFrameProfileParamsPatch(
      OPENING_RIBBON_KEYS.frameProfile.depth,
      '65',
      opening,
    );
    expect(next?.frameProfileOverrides).toEqual({ faceWidth: 80, depth: 65 });
  });

  it('invalid numeric input (<=0 / NaN) is rejected (returns null)', () => {
    const opening = makeOpening({ frameProfileId: 'ALUMIL-M9660-frame' });
    expect(
      buildOpeningFrameProfileParamsPatch(OPENING_RIBBON_KEYS.frameProfile.faceWidth, '0', opening),
    ).toBeNull();
    expect(
      buildOpeningFrameProfileParamsPatch(OPENING_RIBBON_KEYS.frameProfile.faceWidth, 'abc', opening),
    ).toBeNull();
  });
});
