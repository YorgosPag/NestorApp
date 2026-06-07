/**
 * ADR-421 SLICE C — auto-opening-type + opening built-in catalog tests.
 *
 * Covers the pure «Revit Generic» link policy (`resolveAutoOpeningTypeId`) and
 * the deterministic one-built-in-per-kind catalog (`getBuiltInOpeningTypes`):
 *   - default dimensions → link to the matching built-in,
 *   - custom dimensions → undefined (stays ad-hoc, legacy fast-path),
 *   - 17 built-ins, deterministic ids, dims sourced from OPENING_KIND_DEFAULTS,
 *   - glazed kinds default to double glazing.
 */

import { resolveAutoOpeningTypeId } from '../auto-opening-type';
import { getBuiltInOpeningTypes, getBuiltInOpeningTypeId } from '../built-in-types';
import {
  OPENING_KIND_DEFAULTS,
  isGlazedKind,
  type OpeningKind,
} from '../../types/opening-types';

describe('resolveAutoOpeningTypeId', () => {
  it('links to the matching built-in when dimensions equal the kind default', () => {
    const def = OPENING_KIND_DEFAULTS.door;
    expect(
      resolveAutoOpeningTypeId({ kind: 'door', width: def.width, height: def.height }),
    ).toBe(getBuiltInOpeningTypeId('door'));
  });

  it('returns undefined for a non-default width (stays ad-hoc)', () => {
    const def = OPENING_KIND_DEFAULTS.window;
    expect(
      resolveAutoOpeningTypeId({ kind: 'window', width: def.width + 123, height: def.height }),
    ).toBeUndefined();
  });

  it('returns undefined for a non-default height (stays ad-hoc)', () => {
    const def = OPENING_KIND_DEFAULTS['sliding-door'];
    expect(
      resolveAutoOpeningTypeId({ kind: 'sliding-door', width: def.width, height: def.height + 50 }),
    ).toBeUndefined();
  });

  it('rounds sub-mm dimensions before matching', () => {
    const def = OPENING_KIND_DEFAULTS.fixed;
    expect(
      resolveAutoOpeningTypeId({ kind: 'fixed', width: def.width + 0.3, height: def.height - 0.4 }),
    ).toBe(getBuiltInOpeningTypeId('fixed'));
  });
});

describe('getBuiltInOpeningTypes', () => {
  const types = getBuiltInOpeningTypes('company_1');

  it('seeds exactly one built-in per kind (17)', () => {
    expect(types).toHaveLength(17);
    const kinds = new Set(types.map((t) => t.typeParams.kind));
    expect(kinds.size).toBe(17);
  });

  it('derives dimensions from OPENING_KIND_DEFAULTS (no drift)', () => {
    for (const t of types) {
      const def = OPENING_KIND_DEFAULTS[t.typeParams.kind as OpeningKind];
      expect(t.typeParams.width).toBe(def.width);
      expect(t.typeParams.height).toBe(def.height);
      expect(t.category).toBe('opening');
      expect(t.origin).toBe('built-in');
      expect(t.id).toBe(getBuiltInOpeningTypeId(t.typeParams.kind));
    }
  });

  it('defaults glazed kinds to double glazing, opaque kinds to none', () => {
    for (const t of types) {
      if (isGlazedKind(t.typeParams.kind)) {
        expect(t.typeParams.glazingPanes).toBe(2);
      } else {
        expect(t.typeParams.glazingPanes).toBeUndefined();
      }
    }
  });

  it('is deterministic (same company → identical ids)', () => {
    const again = getBuiltInOpeningTypes('company_1');
    expect(again.map((t) => t.id)).toEqual(types.map((t) => t.id));
  });
});
