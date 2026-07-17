/**
 * ADR-676 Phase 3 PILOT — OpeningFrameProfileStore (Zustand, mirrors
 * `bim-family-type-store.ts`): setProfiles round-trip + idempotent-bail on
 * identical content (no notify / no version bump when the value is unchanged).
 */

import {
  useOpeningFrameProfileStore,
  getUserFrameProfileById,
  listUserFrameProfiles,
} from '../opening-frame-profile-store';
import type { OpeningFrameProfile } from '../../types/opening-frame-profile';

const PROFILE_A: OpeningFrameProfile = {
  id: 'frmpst_a',
  manufacturer: 'MyBrand',
  series: 'A',
  role: 'frame',
  faceWidth: 60,
  depth: 40,
};

const PROFILE_B: OpeningFrameProfile = {
  id: 'frmpst_b',
  manufacturer: 'MyBrand',
  series: 'B',
  role: 'sash',
  faceWidth: 65,
  depth: 42,
};

afterEach(() => {
  useOpeningFrameProfileStore.getState().setProfiles([]);
});

describe('useOpeningFrameProfileStore — initial state', () => {
  it('starts empty', () => {
    expect(useOpeningFrameProfileStore.getState().getProfiles()).toEqual([]);
    expect(useOpeningFrameProfileStore.getState().version).toBe(0);
  });
});

describe('useOpeningFrameProfileStore — setProfiles / getProfile / getProfiles round-trip', () => {
  it('stores and returns profiles by id', () => {
    useOpeningFrameProfileStore.getState().setProfiles([PROFILE_A, PROFILE_B]);
    expect(useOpeningFrameProfileStore.getState().getProfile('frmpst_a')).toEqual(PROFILE_A);
    expect(useOpeningFrameProfileStore.getState().getProfile('frmpst_b')).toEqual(PROFILE_B);
    expect(useOpeningFrameProfileStore.getState().getProfile('missing')).toBeNull();
  });

  it('getProfiles returns a flat snapshot list', () => {
    useOpeningFrameProfileStore.getState().setProfiles([PROFILE_A, PROFILE_B]);
    const list = useOpeningFrameProfileStore.getState().getProfiles();
    expect(list).toHaveLength(2);
    expect(list).toEqual(expect.arrayContaining([PROFILE_A, PROFILE_B]));
  });

  it('a subsequent setProfiles replaces the entire set', () => {
    useOpeningFrameProfileStore.getState().setProfiles([PROFILE_A]);
    useOpeningFrameProfileStore.getState().setProfiles([PROFILE_B]);
    expect(useOpeningFrameProfileStore.getState().getProfiles()).toEqual([PROFILE_B]);
  });
});

describe('useOpeningFrameProfileStore — idempotent bail', () => {
  it('does not bump version when re-set with value-identical content (fresh references)', () => {
    useOpeningFrameProfileStore.getState().setProfiles([{ ...PROFILE_A }]);
    const versionAfterFirst = useOpeningFrameProfileStore.getState().version;

    useOpeningFrameProfileStore.getState().setProfiles([{ ...PROFILE_A }]);
    expect(useOpeningFrameProfileStore.getState().version).toBe(versionAfterFirst);
  });

  it('does not notify subscribers when re-set with identical content', () => {
    useOpeningFrameProfileStore.getState().setProfiles([PROFILE_A]);
    const cb = jest.fn();
    const unsub = useOpeningFrameProfileStore.subscribe((s) => s.version, cb);

    useOpeningFrameProfileStore.getState().setProfiles([{ ...PROFILE_A }]);
    expect(cb).not.toHaveBeenCalled();

    unsub();
  });

  it('bumps version and notifies when content actually changes', () => {
    useOpeningFrameProfileStore.getState().setProfiles([PROFILE_A]);
    const versionAfterFirst = useOpeningFrameProfileStore.getState().version;
    const cb = jest.fn();
    const unsub = useOpeningFrameProfileStore.subscribe((s) => s.version, cb);

    useOpeningFrameProfileStore.getState().setProfiles([PROFILE_A, PROFILE_B]);
    expect(useOpeningFrameProfileStore.getState().version).toBe(versionAfterFirst + 1);
    expect(cb).toHaveBeenCalledTimes(1);

    unsub();
  });
});

describe('getUserFrameProfileById / listUserFrameProfiles — sync accessors', () => {
  it('mirror the store getProfile/getProfiles for non-React readers', () => {
    useOpeningFrameProfileStore.getState().setProfiles([PROFILE_A, PROFILE_B]);
    expect(getUserFrameProfileById('frmpst_a')).toEqual(PROFILE_A);
    expect(getUserFrameProfileById('nope')).toBeNull();
    expect(listUserFrameProfiles()).toHaveLength(2);
  });

  it('return empty/null when the store is empty', () => {
    expect(listUserFrameProfiles()).toEqual([]);
    expect(getUserFrameProfileById('frmpst_a')).toBeNull();
  });
});
