/**
 * ADR-611 — Opening frame-profile catalog (seed data + lookup helpers).
 */

import {
  FRAME_PROFILE_CATALOG,
  DEFAULT_FRAME_PROFILE_ID,
  getFrameProfileById,
  listFrameProfiles,
  listFrameProfileManufacturers,
} from '../opening-frame-profile-catalog';

describe('FRAME_PROFILE_CATALOG', () => {
  it('seeds the generic + four Greek-market manufacturers', () => {
    const brands = new Set(FRAME_PROFILE_CATALOG.map((p) => p.manufacturer));
    expect(brands).toEqual(
      new Set(['Generic', 'Alumil', 'Europa', 'Elvial', 'Exalco']),
    );
  });

  it('has unique catalog ids', () => {
    const ids = FRAME_PROFILE_CATALOG.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('stores positive faceWidth/depth (mm) on every entry', () => {
    for (const p of FRAME_PROFILE_CATALOG) {
      expect(p.faceWidth).toBeGreaterThan(0);
      expect(p.depth).toBeGreaterThan(0);
    }
  });
});

describe('DEFAULT_FRAME_PROFILE_ID', () => {
  it('resolves to an existing catalog entry (70×70 generic)', () => {
    const def = getFrameProfileById(DEFAULT_FRAME_PROFILE_ID);
    expect(def).toBeDefined();
    expect(def?.faceWidth).toBe(70);
    expect(def?.depth).toBe(70);
  });
});

describe('getFrameProfileById', () => {
  it('returns the matching profile', () => {
    expect(getFrameProfileById('ALUMIL-M9660-frame')?.manufacturer).toBe('Alumil');
  });

  it('returns undefined for unknown / custom ids', () => {
    expect(getFrameProfileById('__custom__')).toBeUndefined();
    expect(getFrameProfileById('nope')).toBeUndefined();
  });
});

describe('listFrameProfiles', () => {
  it('returns the whole catalog when no manufacturer given', () => {
    expect(listFrameProfiles()).toHaveLength(FRAME_PROFILE_CATALOG.length);
  });

  it('filters by manufacturer', () => {
    const alumil = listFrameProfiles('Alumil');
    expect(alumil.length).toBeGreaterThan(0);
    expect(alumil.every((p) => p.manufacturer === 'Alumil')).toBe(true);
  });

  it('returns a fresh array (not the frozen source)', () => {
    expect(listFrameProfiles()).not.toBe(FRAME_PROFILE_CATALOG);
  });
});

describe('listFrameProfileManufacturers', () => {
  it('lists distinct brands, Generic first', () => {
    const brands = listFrameProfileManufacturers();
    expect(brands[0]).toBe('Generic');
    expect(new Set(brands).size).toBe(brands.length);
  });
});
