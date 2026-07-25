/**
 * Regression anchors for the building-space route field mapper (ADR-696).
 *
 * `mapCommonSpaceFields` replaced two hand-copied `updateData` builders in
 * `api/parking/[id]` and `api/storages/[id]`. These tests pin the EXACT
 * semantics both routes had, because a Firestore write path that silently
 * changes `undefined` / `null` / `''` handling corrupts documents rather than
 * failing loudly.
 *
 * Kept in a separate file from the handler factory on purpose: the mapper is
 * pure, so it needs none of the `server-only` / Firebase Admin module graph.
 */

import { mapCommonSpaceFields, resolveAllocationCodeChange } from '../space-entity-fields';

describe('mapCommonSpaceFields — provided vs omitted', () => {
  it('writes nothing for an empty body (no accidental null-wipes)', () => {
    expect(mapCommonSpaceFields({}, 'number')).toEqual({});
  });

  it('omits a field that is absent, but writes null for an explicit null', () => {
    expect(mapCommonSpaceFields({}, 'name').notes).toBeUndefined();
    expect(mapCommonSpaceFields({ notes: null }, 'name')).toEqual({ notes: null });
  });
});

describe('mapCommonSpaceFields — display field', () => {
  it('writes the trimmed display field under its own key', () => {
    expect(mapCommonSpaceFields({ number: '  P-12  ' }, 'number')).toEqual({ number: 'P-12' });
    expect(mapCommonSpaceFields({ name: '  A1  ' }, 'name')).toEqual({ name: 'A1' });
  });

  it('ignores a blank display field — both routes used a truthy trim guard', () => {
    expect(mapCommonSpaceFields({ number: '   ' }, 'number')).toEqual({});
  });

  it('ignores the OTHER entity display key', () => {
    expect(mapCommonSpaceFields({ name: 'A1' }, 'number')).toEqual({});
  });
});

describe('mapCommonSpaceFields — string fields collapse blank to null', () => {
  it.each([
    ['code', '  C-9  ', 'C-9'],
    ['description', ' hello ', 'hello'],
    ['notes', ' x ', 'x'],
  ])('trims %s', (field, input, expected) => {
    expect(mapCommonSpaceFields({ [field]: input }, 'number')).toEqual({ [field]: expected });
  });

  it.each(['code', 'description', 'notes'])('collapses blank %s to null', (field) => {
    expect(mapCommonSpaceFields({ [field]: '   ' }, 'number')).toEqual({ [field]: null });
  });
});

describe('mapCommonSpaceFields — floor accepts string or number', () => {
  it('keeps a numeric floor as a number', () => {
    expect(mapCommonSpaceFields({ floor: 0 }, 'number')).toEqual({ floor: 0 });
    expect(mapCommonSpaceFields({ floor: 3 }, 'number')).toEqual({ floor: 3 });
  });

  it('trims a string floor and collapses blank to null', () => {
    expect(mapCommonSpaceFields({ floor: ' B1 ' }, 'number')).toEqual({ floor: 'B1' });
    expect(mapCommonSpaceFields({ floor: '  ' }, 'number')).toEqual({ floor: null });
  });

  it('maps an explicit null floor to null', () => {
    expect(mapCommonSpaceFields({ floor: null }, 'number')).toEqual({ floor: null });
  });
});

describe('mapCommonSpaceFields — numeric fields reject non-numbers', () => {
  it('keeps zero (falsy but valid)', () => {
    expect(mapCommonSpaceFields({ area: 0, price: 0 }, 'number')).toEqual({ area: 0, price: 0 });
  });

  it('maps a non-number area/price to null rather than persisting garbage', () => {
    expect(mapCommonSpaceFields({ area: null, price: 'abc' }, 'number'))
      .toEqual({ area: null, price: null });
  });
});

describe('mapCommonSpaceFields — type/status use a truthy guard', () => {
  it('writes non-empty type/status', () => {
    expect(mapCommonSpaceFields({ type: 'large', status: 'available' }, 'number'))
      .toEqual({ type: 'large', status: 'available' });
  });

  it('ignores empty type/status instead of writing an empty string', () => {
    expect(mapCommonSpaceFields({ type: '', status: '' }, 'number')).toEqual({});
  });
});

describe('mapCommonSpaceFields — buildingId unlink', () => {
  it('writes null when explicitly unlinked', () => {
    expect(mapCommonSpaceFields({ buildingId: null }, 'number')).toEqual({ buildingId: null });
  });

  it('writes the id when linked', () => {
    expect(mapCommonSpaceFields({ buildingId: 'bld_1' }, 'number')).toEqual({ buildingId: 'bld_1' });
  });
});

describe('resolveAllocationCodeChange — ADR-247 F-4 cascade trigger', () => {
  it('prefers code over the display field', () => {
    expect(resolveAllocationCodeChange({ code: 'C-1', number: 'P-9' }, {}, 'number')).toBe('C-1');
  });

  it('falls back to the display field for legacy docs with no code', () => {
    expect(resolveAllocationCodeChange({ number: 'P-9' }, {}, 'number')).toBe('P-9');
    expect(resolveAllocationCodeChange({ name: 'A1' }, {}, 'name')).toBe('A1');
  });

  it('returns null when nothing changed — the cascade must NOT fire', () => {
    expect(resolveAllocationCodeChange({ code: 'C-1' }, { code: 'C-1' }, 'number')).toBeNull();
    expect(resolveAllocationCodeChange({ number: 'P-9' }, { number: 'P-9' }, 'number')).toBeNull();
  });

  it('compares against the existing code before the existing display field', () => {
    expect(resolveAllocationCodeChange({ code: 'C-1' }, { code: 'C-1', number: 'P-9' }, 'number'))
      .toBeNull();
    expect(resolveAllocationCodeChange({ code: 'C-2' }, { code: 'C-1', number: 'P-9' }, 'number'))
      .toBe('C-2');
  });

  it('returns null when the body carries no identifier at all', () => {
    expect(resolveAllocationCodeChange({}, { code: 'C-1' }, 'number')).toBeNull();
    expect(resolveAllocationCodeChange({ code: '   ' }, { code: 'C-1' }, 'number')).toBeNull();
  });
});
