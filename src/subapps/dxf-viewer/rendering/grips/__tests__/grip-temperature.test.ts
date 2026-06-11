/**
 * @fileoverview Tests for the grip-temperature SSoT resolver.
 * Covers the full priority matrix: hovered / active / dragging / none × match / no-match.
 * @see ADR-397 §15
 */

import {
  resolveGripTemperature,
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
