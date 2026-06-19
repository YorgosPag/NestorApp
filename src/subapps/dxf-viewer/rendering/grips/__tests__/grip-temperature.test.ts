/**
 * @fileoverview Tests for the grip-temperature SSoT resolver.
 * Covers the full priority matrix: hovered / active / dragging / none × match / no-match.
 * @see ADR-397 §15
 */

import {
  resolveGripTemperature,
  gripKey,
  type GripTemperatureState,
} from '../grip-temperature';

const ENTITY = 'wall-123';
const OTHER_ENTITY = 'wall-999';
const GRIP = 2;
const OTHER_GRIP = 5;

const ref = (entityId: string, gripIndex: number) => ({ entityId, gripIndex });

describe('resolveGripTemperature — SSoT', () => {
  describe('no state', () => {
    it('returns cold when state is undefined', () => {
      expect(resolveGripTemperature(ENTITY, GRIP, undefined)).toBe('cold');
    });

    it('returns cold for an empty state', () => {
      expect(resolveGripTemperature(ENTITY, GRIP, {})).toBe('cold');
    });
  });

  describe('hovered → warm', () => {
    const state: GripTemperatureState = { hovered: ref(ENTITY, GRIP) };

    it('warm when entity + index match', () => {
      expect(resolveGripTemperature(ENTITY, GRIP, state)).toBe('warm');
    });

    it('cold when index differs', () => {
      expect(resolveGripTemperature(ENTITY, OTHER_GRIP, state)).toBe('cold');
    });

    it('cold when entity differs', () => {
      expect(resolveGripTemperature(OTHER_ENTITY, GRIP, state)).toBe('cold');
    });
  });

  describe('active → hot', () => {
    const state: GripTemperatureState = { active: ref(ENTITY, GRIP) };

    it('hot when entity + index match', () => {
      expect(resolveGripTemperature(ENTITY, GRIP, state)).toBe('hot');
    });

    it('cold when index differs', () => {
      expect(resolveGripTemperature(ENTITY, OTHER_GRIP, state)).toBe('cold');
    });
  });

  describe('dragging → hot (alias of active)', () => {
    const state: GripTemperatureState = { dragging: ref(ENTITY, GRIP) };

    it('hot when entity + index match', () => {
      expect(resolveGripTemperature(ENTITY, GRIP, state)).toBe('hot');
    });

    it('cold when entity differs', () => {
      expect(resolveGripTemperature(OTHER_ENTITY, GRIP, state)).toBe('cold');
    });
  });

  describe('priority', () => {
    it('hot wins over warm when active and hovered are the SAME grip', () => {
      const state: GripTemperatureState = {
        hovered: ref(ENTITY, GRIP),
        active: ref(ENTITY, GRIP),
      };
      expect(resolveGripTemperature(ENTITY, GRIP, state)).toBe('hot');
    });

    it('hot for the active grip, warm for a different hovered grip', () => {
      const state: GripTemperatureState = {
        hovered: ref(ENTITY, OTHER_GRIP),
        active: ref(ENTITY, GRIP),
      };
      expect(resolveGripTemperature(ENTITY, GRIP, state)).toBe('hot');
      expect(resolveGripTemperature(ENTITY, OTHER_GRIP, state)).toBe('warm');
    });

    it('dragging and active together still resolve hot', () => {
      const state: GripTemperatureState = {
        active: ref(ENTITY, GRIP),
        dragging: ref(ENTITY, GRIP),
      };
      expect(resolveGripTemperature(ENTITY, GRIP, state)).toBe('hot');
    });
  });

  describe('snappable → cyan (rotation snap targets, ADR-397)', () => {
    const snappableState = (...keys: string[]): GripTemperatureState => ({
      snappableKeys: new Set(keys),
    });

    it('snappable when the grip key is in snappableKeys', () => {
      const state = snappableState(gripKey(ENTITY, GRIP));
      expect(resolveGripTemperature(ENTITY, GRIP, state)).toBe('snappable');
    });

    it('cold when the grip key is NOT in snappableKeys', () => {
      const state = snappableState(gripKey(ENTITY, OTHER_GRIP));
      expect(resolveGripTemperature(ENTITY, GRIP, state)).toBe('cold');
    });

    it('hot wins over snappable (pressed handle stays red among cyan grips)', () => {
      const state: GripTemperatureState = {
        active: ref(ENTITY, GRIP),
        snappableKeys: new Set([gripKey(ENTITY, GRIP)]),
      };
      expect(resolveGripTemperature(ENTITY, GRIP, state)).toBe('hot');
    });

    it('snappable wins over warm (a hovered snap target is cyan, not orange)', () => {
      const state: GripTemperatureState = {
        hovered: ref(ENTITY, GRIP),
        snappableKeys: new Set([gripKey(ENTITY, GRIP)]),
      };
      expect(resolveGripTemperature(ENTITY, GRIP, state)).toBe('snappable');
    });

    it('empty snappableKeys behaves like no snap targets', () => {
      const state: GripTemperatureState = { snappableKeys: new Set(), hovered: ref(ENTITY, GRIP) };
      expect(resolveGripTemperature(ENTITY, GRIP, state)).toBe('warm');
    });
  });

  describe('armed → orange (clicked-to-select, ADR-501)', () => {
    const armedState = (...keys: string[]): GripTemperatureState => ({
      armedKeys: new Set(keys),
    });

    it('armed when the grip key is in armedKeys', () => {
      expect(resolveGripTemperature(ENTITY, GRIP, armedState(gripKey(ENTITY, GRIP)))).toBe('armed');
    });

    it('cold when the grip key is NOT in armedKeys', () => {
      expect(resolveGripTemperature(ENTITY, GRIP, armedState(gripKey(ENTITY, OTHER_GRIP)))).toBe('cold');
    });

    it('hot wins over armed (the dragged grip turns red even while selected)', () => {
      const state: GripTemperatureState = {
        active: ref(ENTITY, GRIP),
        armedKeys: new Set([gripKey(ENTITY, GRIP)]),
      };
      expect(resolveGripTemperature(ENTITY, GRIP, state)).toBe('hot');
    });

    it('armed wins over hover (a selected grip stays orange under the cursor)', () => {
      const state: GripTemperatureState = {
        hovered: ref(ENTITY, GRIP),
        armedKeys: new Set([gripKey(ENTITY, GRIP)]),
      };
      expect(resolveGripTemperature(ENTITY, GRIP, state)).toBe('armed');
    });

    it('armed wins over snappable (selection orange beats rotation cyan)', () => {
      const state: GripTemperatureState = {
        armedKeys: new Set([gripKey(ENTITY, GRIP)]),
        snappableKeys: new Set([gripKey(ENTITY, GRIP)]),
      };
      expect(resolveGripTemperature(ENTITY, GRIP, state)).toBe('armed');
    });

    it('supports several armed grips at once (multi-select)', () => {
      const state = armedState(gripKey(ENTITY, GRIP), gripKey(OTHER_ENTITY, OTHER_GRIP));
      expect(resolveGripTemperature(ENTITY, GRIP, state)).toBe('armed');
      expect(resolveGripTemperature(OTHER_ENTITY, OTHER_GRIP, state)).toBe('armed');
      expect(resolveGripTemperature(ENTITY, OTHER_GRIP, state)).toBe('cold');
    });

    it('empty armedKeys behaves like no armed grips', () => {
      const state: GripTemperatureState = { armedKeys: new Set(), hovered: ref(ENTITY, GRIP) };
      expect(resolveGripTemperature(ENTITY, GRIP, state)).toBe('warm');
    });
  });

  describe('gripKey', () => {
    it('composes a stable entity_index key', () => {
      expect(gripKey('wall-1', 3)).toBe('wall-1_3');
    });
  });

  describe('regression — the press→hot bug (ADR-397)', () => {
    // A pressed rotation handle arrives as `active` only (no `dragging`).
    // The old GripPhaseRenderer read ONLY `dragginGrip` → such a grip never
    // went hot. The SSoT must treat `active` as hot.
    it('a grip that is active-only (rotation handle armed) is hot', () => {
      const state: GripTemperatureState = { active: ref(ENTITY, GRIP) };
      expect(resolveGripTemperature(ENTITY, GRIP, state)).toBe('hot');
    });
  });
});
