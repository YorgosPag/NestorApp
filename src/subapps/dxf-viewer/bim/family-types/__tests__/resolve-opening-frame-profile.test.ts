/**
 * ADR-611 — Opening frame-profile resolution (LAST-wins order + legacy fallback).
 */

import { resolveOpeningFrameProfile } from '../resolve-opening-frame-profile';
import { getFrameProfileById } from '../opening-frame-profile-catalog';
import { useOpeningFrameProfileStore } from '../opening-frame-profile-store';
import { CATALOG_CUSTOM_SENTINEL } from '../../types/opening-frame-profile';
import type { OpeningFrameProfile } from '../../types/opening-frame-profile';
import type { OpeningParams } from '../../types/opening-types';
import type { OpeningTypeParams } from '../../types/bim-family-type';

/** Minimal valid OpeningParams builder — frame fields opt-in per test. */
function makeParams(overrides: Partial<OpeningParams> = {}): OpeningParams {
  return {
    kind: 'door',
    wallId: 'wall-1',
    offsetFromStart: 0,
    width: 900,
    height: 2100,
    sillHeight: 0,
    ...overrides,
  };
}

describe('resolveOpeningFrameProfile — default (no signal)', () => {
  it('falls back to the catalog default 70×70 when nothing is set', () => {
    const r = resolveOpeningFrameProfile(makeParams());
    const def = getFrameProfileById('GENERIC-70x70-frame');
    expect(r.id).toBe('GENERIC-70x70-frame');
    expect(r.faceWidth).toBe(def?.faceWidth);
    expect(r.depth).toBe(def?.depth);
  });
});

describe('resolveOpeningFrameProfile — catalog id layers (LAST wins)', () => {
  it('uses the family type frameProfileId when the instance has none', () => {
    const typeParams: OpeningTypeParams = {
      kind: 'door',
      width: 900,
      height: 2100,
      frameProfileId: 'ALUMIL-M9660-frame',
    };
    const r = resolveOpeningFrameProfile(makeParams(), typeParams);
    expect(r.id).toBe('ALUMIL-M9660-frame');
    expect(r.manufacturer).toBe('Alumil');
    expect(r.faceWidth).toBe(72);
    expect(r.depth).toBe(60);
  });

  it('instance frameProfileId wins over the type frameProfileId', () => {
    const typeParams: OpeningTypeParams = {
      kind: 'door',
      width: 900,
      height: 2100,
      frameProfileId: 'ALUMIL-M9660-frame',
    };
    const r = resolveOpeningFrameProfile(
      makeParams({ frameProfileId: 'EUROPA-A5500-frame' }),
      typeParams,
    );
    expect(r.id).toBe('EUROPA-A5500-frame');
    expect(r.manufacturer).toBe('Europa');
    expect(r.faceWidth).toBe(68);
    expect(r.depth).toBe(55);
  });
});

describe('resolveOpeningFrameProfile — overrides win last over catalog', () => {
  it('applies frameProfileOverrides on top of the resolved catalog profile', () => {
    const r = resolveOpeningFrameProfile(
      makeParams({
        frameProfileId: 'ALUMIL-M9660-frame',
        frameProfileOverrides: { faceWidth: 90, depth: 65 },
      }),
    );
    // id echoes the chosen profile; dims come from overrides.
    expect(r.id).toBe('ALUMIL-M9660-frame');
    expect(r.faceWidth).toBe(90);
    expect(r.depth).toBe(65);
  });

  it('custom sentinel id + overrides drive the cross-section', () => {
    const r = resolveOpeningFrameProfile(
      makeParams({
        frameProfileId: CATALOG_CUSTOM_SENTINEL,
        frameProfileOverrides: {
          faceWidth: 120,
          depth: 80,
          manufacturer: 'ACME',
          series: 'X1',
        },
      }),
    );
    expect(r.id).toBe(CATALOG_CUSTOM_SENTINEL);
    expect(r.manufacturer).toBe('ACME');
    expect(r.series).toBe('X1');
    expect(r.faceWidth).toBe(120);
    expect(r.depth).toBe(80);
  });

  it('a partial override only touches the given field', () => {
    const r = resolveOpeningFrameProfile(
      makeParams({
        frameProfileId: 'ALUMIL-M9660-frame',
        frameProfileOverrides: { faceWidth: 100 },
      }),
    );
    expect(r.faceWidth).toBe(100);
    expect(r.depth).toBe(60); // untouched → catalog depth
  });
});

describe('resolveOpeningFrameProfile — legacy frameWidth fallback (zero regression)', () => {
  it('uses legacy frameWidth as a square cross-section when no profile id exists', () => {
    const r = resolveOpeningFrameProfile(makeParams({ frameWidth: 45 }));
    expect(r.faceWidth).toBe(45);
    expect(r.depth).toBe(45);
  });

  it('legacy frameWidth is IGNORED once a frameProfileId is chosen', () => {
    const r = resolveOpeningFrameProfile(
      makeParams({ frameWidth: 45, frameProfileId: 'EUROPA-A5500-frame' }),
    );
    expect(r.faceWidth).toBe(68);
    expect(r.depth).toBe(55);
  });

  it('legacy frameWidth is IGNORED once a type frameProfileId is chosen', () => {
    const typeParams: OpeningTypeParams = {
      kind: 'door',
      width: 900,
      height: 2100,
      frameProfileId: 'ELVIAL-4400-frame',
    };
    const r = resolveOpeningFrameProfile(makeParams({ frameWidth: 45 }), typeParams);
    expect(r.faceWidth).toBe(70);
    expect(r.depth).toBe(62);
  });
});

describe('resolveOpeningFrameProfile — user-library id (ADR-676 Phase 3 PILOT)', () => {
  const USER_PROFILE: OpeningFrameProfile = {
    id: 'frmpst_res1',
    manufacturer: 'MyBrand',
    series: 'Custom',
    role: 'frame',
    faceWidth: 123,
    depth: 45,
  };

  afterEach(() => {
    useOpeningFrameProfileStore.getState().setProfiles([]);
  });

  it('resolves an instance frameProfileId that only exists in the user library', () => {
    useOpeningFrameProfileStore.getState().setProfiles([USER_PROFILE]);
    const r = resolveOpeningFrameProfile(makeParams({ frameProfileId: 'frmpst_res1' }));
    expect(r.id).toBe('frmpst_res1');
    expect(r.manufacturer).toBe('MyBrand');
    expect(r.faceWidth).toBe(123);
    expect(r.depth).toBe(45);
  });

  it('resolves a type-level frameProfileId that only exists in the user library', () => {
    useOpeningFrameProfileStore.getState().setProfiles([USER_PROFILE]);
    const typeParams: OpeningTypeParams = {
      kind: 'door',
      width: 900,
      height: 2100,
      frameProfileId: 'frmpst_res1',
    };
    const r = resolveOpeningFrameProfile(makeParams(), typeParams);
    expect(r.faceWidth).toBe(123);
    expect(r.depth).toBe(45);
  });
});
