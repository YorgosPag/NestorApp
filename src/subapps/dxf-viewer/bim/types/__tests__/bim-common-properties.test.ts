/**
 * ADR-363 Phase 7.1 Step 6.1 — common-properties registry tests.
 */

import {
  COMMON_PROPERTIES_BY_KIND,
  SUPPORTED_BIM_KINDS,
  getCommonProperties,
  countByKind,
  isHomogeneous,
} from '../bim-common-properties';
import type { EntityType } from '../../../types/entities';

describe('bim-common-properties', () => {
  describe('COMMON_PROPERTIES_BY_KIND', () => {
    it('covers all 7 supported BIM kinds', () => {
      expect(Object.keys(COMMON_PROPERTIES_BY_KIND).sort()).toEqual(
        [...SUPPORTED_BIM_KINDS].sort(),
      );
    });

    it('wall: height + thickness', () => {
      const keys = COMMON_PROPERTIES_BY_KIND.wall!.map((p) => p.key);
      expect(keys).toEqual(['height', 'thickness']);
    });

    it('opening: width + height + sillHeight', () => {
      const keys = COMMON_PROPERTIES_BY_KIND.opening!.map((p) => p.key);
      expect(keys).toEqual(['width', 'height', 'sillHeight']);
    });

    it('column: width + depth + height', () => {
      const keys = COMMON_PROPERTIES_BY_KIND.column!.map((p) => p.key);
      expect(keys).toEqual(['width', 'depth', 'height']);
    });

    it('slab-opening: no editable numeric params', () => {
      expect(COMMON_PROPERTIES_BY_KIND['slab-opening']).toEqual([]);
    });

    it('each property carries an i18n labelKey', () => {
      for (const props of Object.values(COMMON_PROPERTIES_BY_KIND)) {
        for (const prop of props ?? []) {
          expect(prop.labelKey).toMatch(/^ribbon\.contextualTabs\.multiSelection\.properties\./);
        }
      }
    });
  });

  describe('getCommonProperties', () => {
    it('returns [] για 0 kinds', () => {
      expect(getCommonProperties([])).toEqual([]);
    });

    it('returns full set για 1 kind', () => {
      expect(getCommonProperties(['wall']).map((p) => p.key)).toEqual([
        'height', 'thickness',
      ]);
    });

    it('homogeneous wall+wall = full wall set', () => {
      expect(getCommonProperties(['wall', 'wall']).map((p) => p.key)).toEqual([
        'height', 'thickness',
      ]);
    });

    it('wall + column intersection = height', () => {
      expect(getCommonProperties(['wall', 'column']).map((p) => p.key)).toEqual([
        'height',
      ]);
    });

    it('wall + slab intersection = thickness', () => {
      expect(getCommonProperties(['wall', 'slab']).map((p) => p.key)).toEqual([
        'thickness',
      ]);
    });

    it('opening + column intersection = width + height', () => {
      expect(getCommonProperties(['opening', 'column']).map((p) => p.key)).toEqual([
        'width', 'height',
      ]);
    });

    it('wall + stair → empty (no shared numeric prop)', () => {
      expect(getCommonProperties(['wall', 'stair'])).toEqual([]);
    });

    it('slab-opening drags intersection to empty', () => {
      expect(getCommonProperties(['wall', 'slab-opening'])).toEqual([]);
    });

    it('first-kind property order preserved (visual order)', () => {
      const keys = getCommonProperties(['opening', 'wall']).map((p) => p.key);
      expect(keys).toEqual(['height']);
    });
  });

  describe('countByKind', () => {
    it('empty entries → empty map', () => {
      expect(countByKind([]).size).toBe(0);
    });

    it('counts homogeneous selection', () => {
      const counts = countByKind(['wall', 'wall', 'wall']);
      expect(counts.get('wall')).toBe(3);
      expect(counts.size).toBe(1);
    });

    it('counts heterogeneous selection', () => {
      const counts = countByKind(['wall', 'wall', 'opening', 'slab', 'slab']);
      expect(counts.get('wall')).toBe(2);
      expect(counts.get('opening')).toBe(1);
      expect(counts.get('slab')).toBe(2);
      expect(counts.size).toBe(3);
    });
  });

  describe('isHomogeneous', () => {
    it.each([
      [[], true],
      [['wall'], true],
      [['wall', 'wall', 'wall'], true],
      [['wall', 'opening'], false],
      [['wall', 'wall', 'opening'], false],
    ] as const)('kinds=%j → %s', (kinds, expected) => {
      expect(isHomogeneous(kinds as readonly EntityType[])).toBe(expected);
    });
  });
});
