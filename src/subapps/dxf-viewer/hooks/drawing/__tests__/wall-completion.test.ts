/**
 * ADR-363 Phase 1 — `wall-completion` builders tests.
 *
 * Coverage:
 *   - buildDefaultWallParams: category default, DNA preset selection, thickness
 *     derived from DNA, height defaults, scene-unit scaling
 *   - buildWallEntity: ok path returns entity with geometry + validation;
 *     fail path returns hardErrors for invalid params
 *   - completeWallFromTwoClicks: convenience wrapper end-to-end
 */

import {
  buildDefaultWallParams,
  buildWallEntity,
  completeWallFromTwoClicks,
} from '../wall-completion';
import { DEFAULT_WALL_HEIGHT_MM } from '../../../bim/types/wall-types';

describe('buildDefaultWallParams', () => {
  it('returns exterior category + DNA preset by default', () => {
    const params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 1000, y: 0 });
    expect(params.category).toBe('exterior');
    expect(params.dna).toBeDefined();
    expect(params.dna?.totalThickness).toBe(250); // exterior preset
    expect(params.thickness).toBe(250);
  });

  it('matches thickness to DNA total when DNA preset is used', () => {
    const params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 1000, y: 0 }, {
      category: 'interior',
    });
    expect(params.thickness).toBe(params.dna?.totalThickness);
  });

  it('honours explicit thickness override even with DNA', () => {
    const params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 1000, y: 0 }, {
      thickness: 300,
    });
    expect(params.thickness).toBe(300);
  });

  it('uses DEFAULT_WALL_HEIGHT_MM when no override', () => {
    const params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 1000, y: 0 });
    expect(params.height).toBe(DEFAULT_WALL_HEIGHT_MM);
  });

  it('honours height override', () => {
    const params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 1000, y: 0 }, {
      height: 2400,
    });
    expect(params.height).toBe(2400);
  });

  it('z-coordinate of start/end defaults to 0', () => {
    const params = buildDefaultWallParams({ x: 5, y: 10 }, { x: 100, y: 200 });
    expect(params.start.z).toBe(0);
    expect(params.end.z).toBe(0);
  });

  it('flip override propagates', () => {
    const params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 1000, y: 0 }, {
      flip: true,
    });
    expect(params.flip).toBe(true);
  });

  it('scene-unit m scales mm defaults', () => {
    const params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 1, y: 0 }, undefined, 'm');
    // DEFAULT_WALL_HEIGHT_MM (3000) × (1/1000) = 3.0 in metres
    expect(params.height).toBeCloseTo(3.0, 6);
    // exterior preset 250 mm → 0.25 m
    expect(params.thickness).toBeCloseTo(0.25, 6);
    expect(params.dna?.totalThickness).toBeCloseTo(0.25, 6);
  });
});

describe('buildWallEntity', () => {
  it('returns ok=true on valid params with id, kind, layerId, geometry, validation', () => {
    const params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 1000, y: 0 });
    const r = buildWallEntity(params, 'lyr_test', 'straight');
    expect(r.ok).toBe(true);
    if (!r.ok) return; // type narrow
    expect(r.entity.type).toBe('wall');
    expect(r.entity.kind).toBe('straight');
    expect(r.entity.layerId).toBe('lyr_test');
    expect(r.entity.id).toMatch(/^wall_/);
    expect(r.entity.geometry.length).toBeCloseTo(1.0, 6);
    expect(r.entity.validation.hasCodeViolations).toBe(false);
  });

  it('returns ok=false with hardErrors on zero-length wall', () => {
    const params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 0, y: 0 });
    const r = buildWallEntity(params, 'lyr_test');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.hardErrors.length).toBeGreaterThan(0);
    expect(r.hardErrors).toContain('wall.validation.hardErrors.lengthTooShort');
  });

  it('exterior wall with NOK-thin thickness still creates entity but flags violation', () => {
    const params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 1000, y: 0 }, {
      thickness: 100,
      category: 'exterior',
    });
    const r = buildWallEntity(params, 'lyr_test');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entity.validation.hasCodeViolations).toBe(true);
  });
});

describe('completeWallFromTwoClicks', () => {
  it('builds entity from 2 click points', () => {
    const r = completeWallFromTwoClicks({ x: 0, y: 0 }, { x: 2000, y: 0 }, 'lyr_x');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entity.geometry.length).toBeCloseTo(2.0, 6);
  });

  it('propagates overrides to params', () => {
    const r = completeWallFromTwoClicks(
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      'lyr_x',
      { category: 'partition', height: 2400 },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entity.params.category).toBe('partition');
    expect(r.entity.params.height).toBe(2400);
  });
});
