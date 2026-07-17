/**
 * ADR-676 Phase 3 PILOT — Frame-profile merge-lookup SSoT (builtin ∪ user library).
 *
 * Covers `resolveFrameProfileById` / `listMergedFrameProfiles` /
 * `listMergedFrameProfileManufacturers` — the ONE place the immutable builtin
 * catalog and the loaded user-library store are folded together. Builtin ALWAYS
 * wins an id collision (see module header in `opening-frame-profile-lookup.ts`).
 */

import {
  resolveFrameProfileById,
  listMergedFrameProfiles,
  listMergedFrameProfileManufacturers,
} from '../opening-frame-profile-lookup';
import {
  FRAME_PROFILE_CATALOG,
  getFrameProfileById,
  listFrameProfileManufacturers,
} from '../opening-frame-profile-catalog';
import { useOpeningFrameProfileStore } from '../opening-frame-profile-store';
import type { OpeningFrameProfile } from '../../types/opening-frame-profile';

const USER_PROFILE: OpeningFrameProfile = {
  id: 'frmpst_test1',
  manufacturer: 'MyBrand',
  series: 'Custom 60',
  role: 'frame',
  faceWidth: 60,
  depth: 40,
  label: 'MyBrand Custom 60',
};

const BUILTIN_ID = 'ALUMIL-M9660-frame';

afterEach(() => {
  // Module-level Zustand singleton — reset so tests don't leak profiles.
  useOpeningFrameProfileStore.getState().setProfiles([]);
});

describe('resolveFrameProfileById', () => {
  it('resolves a user-library id from the loaded store', () => {
    useOpeningFrameProfileStore.getState().setProfiles([USER_PROFILE]);
    expect(resolveFrameProfileById('frmpst_test1')).toEqual(USER_PROFILE);
  });

  it('resolves a builtin id from the catalog', () => {
    const expected = getFrameProfileById(BUILTIN_ID);
    expect(resolveFrameProfileById(BUILTIN_ID)).toEqual(expected);
  });

  it('returns undefined for an id present in neither source', () => {
    expect(resolveFrameProfileById('nope')).toBeUndefined();
  });

  it('builtin wins when a user profile id collides with a builtin id', () => {
    const shadow: OpeningFrameProfile = {
      id: BUILTIN_ID,
      manufacturer: 'Impostor',
      series: 'Fake',
      role: 'frame',
      faceWidth: 999,
      depth: 999,
    };
    useOpeningFrameProfileStore.getState().setProfiles([shadow]);
    const resolved = resolveFrameProfileById(BUILTIN_ID);
    expect(resolved).toEqual(getFrameProfileById(BUILTIN_ID));
    expect(resolved?.manufacturer).not.toBe('Impostor');
  });
});

describe('listMergedFrameProfiles', () => {
  it('includes both builtin and user-library profiles when none are loaded vs loaded', () => {
    expect(listMergedFrameProfiles()).toHaveLength(FRAME_PROFILE_CATALOG.length);

    useOpeningFrameProfileStore.getState().setProfiles([USER_PROFILE]);
    const merged = listMergedFrameProfiles();
    expect(merged).toHaveLength(FRAME_PROFILE_CATALOG.length + 1);
    expect(merged.find((p) => p.id === 'frmpst_test1')).toEqual(USER_PROFILE);
    expect(merged.find((p) => p.id === BUILTIN_ID)).toBeDefined();
  });

  it('drops a user profile whose id collides with a builtin id (never listed twice)', () => {
    const shadow: OpeningFrameProfile = { ...USER_PROFILE, id: BUILTIN_ID };
    useOpeningFrameProfileStore.getState().setProfiles([shadow]);
    const merged = listMergedFrameProfiles();
    expect(merged).toHaveLength(FRAME_PROFILE_CATALOG.length);
    expect(merged.filter((p) => p.id === BUILTIN_ID)).toHaveLength(1);
  });

  it('filters both builtin and user profiles by manufacturer', () => {
    useOpeningFrameProfileStore.getState().setProfiles([USER_PROFILE]);
    expect(listMergedFrameProfiles('MyBrand')).toEqual([USER_PROFILE]);
    expect(listMergedFrameProfiles('Alumil').every((p) => p.manufacturer === 'Alumil')).toBe(true);
  });
});

describe('listMergedFrameProfileManufacturers', () => {
  it('appends user-only brands after the builtin brands, builtin order first', () => {
    const builtinBrands = listFrameProfileManufacturers();
    useOpeningFrameProfileStore.getState().setProfiles([USER_PROFILE]);
    const merged = listMergedFrameProfileManufacturers();
    expect(merged.slice(0, builtinBrands.length)).toEqual(builtinBrands);
    expect(merged).toContain('MyBrand');
    expect(merged.indexOf('MyBrand')).toBe(builtinBrands.length);
  });

  it('does not duplicate a user brand that already exists in the builtin catalog', () => {
    const sameAlumil: OpeningFrameProfile = { ...USER_PROFILE, id: 'frmpst_test2', manufacturer: 'Alumil' };
    useOpeningFrameProfileStore.getState().setProfiles([sameAlumil]);
    const merged = listMergedFrameProfileManufacturers();
    expect(merged.filter((b) => b === 'Alumil')).toHaveLength(1);
  });
});
