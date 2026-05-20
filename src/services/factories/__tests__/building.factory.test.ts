/**
 * Tests — Building Factory (ADR-369 §9 Q2) — Phase A2
 */

import { createBuilding } from '../building.factory';

const baseInput = {
  projectId: 'proj_test',
  name: 'Κτίριο Α',
  totalArea: 1200,
  floors: 5,
  status: 'planning' as const,
  progress: 0,
};

describe('createBuilding', () => {
  // ─── Defaults ─────────────────────────────────────────────────────────────

  describe('ADR-369 elevation defaults', () => {
    it('baseElevation default = 0', () => {
      const b = createBuilding(baseInput);
      expect(b.baseElevation).toBe(0);
    });

    it('rotation default = 0', () => {
      const b = createBuilding(baseInput);
      expect(b.rotation).toBe(0);
    });

    it('phase default = "planned"', () => {
      const b = createBuilding(baseInput);
      expect(b.phase).toBe('planned');
    });

    it('siteOrigin remains undefined when not provided', () => {
      const b = createBuilding(baseInput);
      expect(b.siteOrigin).toBeUndefined();
    });

    it('baseElevationReference remains undefined when not provided', () => {
      const b = createBuilding(baseInput);
      expect(b.baseElevationReference).toBeUndefined();
    });
  });

  // ─── User overrides ───────────────────────────────────────────────────────

  describe('user overrides preserved', () => {
    it('baseElevation override (e.g. building on slope)', () => {
      const b = createBuilding({ ...baseInput, baseElevation: -2.5 });
      expect(b.baseElevation).toBe(-2.5);
    });

    it('rotation override', () => {
      const b = createBuilding({ ...baseInput, rotation: 45 });
      expect(b.rotation).toBe(45);
    });

    it('phase override', () => {
      const b = createBuilding({ ...baseInput, phase: 'under_construction' });
      expect(b.phase).toBe('under_construction');
    });

    it('siteOrigin propagated', () => {
      const b = createBuilding({ ...baseInput, siteOrigin: { x: 10, y: 20 } });
      expect(b.siteOrigin).toEqual({ x: 10, y: 20 });
    });

    it('baseElevationReference propagated', () => {
      const b = createBuilding({ ...baseInput, baseElevationReference: 'sea-level' });
      expect(b.baseElevationReference).toBe('sea-level');
    });
  });

  // ─── Caller fields preserved ──────────────────────────────────────────────

  describe('caller fields preserved', () => {
    it('name, projectId, totalArea, floors, status, progress', () => {
      const b = createBuilding(baseInput);
      expect(b.name).toBe('Κτίριο Α');
      expect(b.projectId).toBe('proj_test');
      expect(b.totalArea).toBe(1200);
      expect(b.floors).toBe(5);
      expect(b.status).toBe('planning');
      expect(b.progress).toBe(0);
    });
  });

  // ─── Enterprise ID ────────────────────────────────────────────────────────

  describe('enterprise ID', () => {
    it('id starts with "bldg_" prefix', () => {
      const b = createBuilding(baseInput);
      expect(b.id).toMatch(/^bldg_/);
    });

    it('100 calls produce unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(createBuilding(baseInput).id);
      }
      expect(ids.size).toBe(100);
    });
  });
});
