/**
 * ADR-629 — unit tests for the point-placement completion primitives.
 *
 * Pure functions, no heavy deps: the `buildBimPointEntity` skeleton is exercised
 * with stub `validate` / `computeGeometry` / `createEntity`, and `resolveBodyPlacement`
 * with default-vs-override matrices.
 */

import {
  buildBimPointEntity,
  resolveBodyPlacement,
  type BimPointEntityBuildSpec,
} from '../point-completion-builders';
import type { BimValidation } from '../../../bim/types/bim-base';

const bimValidation = { errors: [], warnings: [] } as unknown as BimValidation;

interface FakeParams {
  readonly width: number;
}
interface FakeGeometry {
  readonly area: number;
}
interface FakeEntity {
  readonly id: string;
  readonly params: FakeParams;
  readonly geometry: FakeGeometry;
  readonly layerId: string;
  readonly visible: boolean;
}

describe('buildBimPointEntity', () => {
  function makeSpec(
    hardErrors: readonly string[],
  ): { spec: BimPointEntityBuildSpec<FakeParams, FakeGeometry, FakeEntity>; calls: { geometry: number; create: number } } {
    const calls = { geometry: 0, create: 0 };
    const spec: BimPointEntityBuildSpec<FakeParams, FakeGeometry, FakeEntity> = {
      validate: () => ({ hardErrors, bimValidation }),
      computeGeometry: (params) => {
        calls.geometry += 1;
        return { area: params.width * 2 };
      },
      createEntity: (input) => {
        calls.create += 1;
        return { id: 'e1', ...input };
      },
    };
    return { spec, calls };
  }

  it('validates → computes geometry → creates, returning ok+entity on the happy path', () => {
    const { spec, calls } = makeSpec([]);
    const result = buildBimPointEntity({ width: 10 }, 'layer-1', spec);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entity.geometry).toEqual({ area: 20 });
      expect(result.entity.layerId).toBe('layer-1');
      expect(result.entity.visible).toBe(true);
    }
    expect(calls).toEqual({ geometry: 1, create: 1 });
  });

  it('short-circuits on hard errors: no geometry, no create, ok=false', () => {
    const { spec, calls } = makeSpec(['err.tooSmall']);
    const result = buildBimPointEntity({ width: 0 }, 'layer-1', spec);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.hardErrors).toEqual(['err.tooSmall']);
    }
    expect(calls).toEqual({ geometry: 0, create: 0 });
  });

  it('passes the validation bimValidation payload straight to the factory', () => {
    let seen: BimValidation | null = null;
    const spec: BimPointEntityBuildSpec<FakeParams, FakeGeometry, FakeEntity> = {
      validate: () => ({ hardErrors: [], bimValidation }),
      computeGeometry: () => ({ area: 1 }),
      createEntity: (input) => {
        seen = input.validation;
        return { id: 'e1', ...input };
      },
    };
    buildBimPointEntity({ width: 5 }, 'layer-2', spec);
    expect(seen).toBe(bimValidation);
  });
});

describe('resolveBodyPlacement', () => {
  const defaults = { width: 100, length: 200, bodyHeightMm: 300, mountingElevationMm: 400 };

  it('uses defaults + z=0 position + rotation 0 when overrides are empty', () => {
    const r = resolveBodyPlacement({ x: 7, y: 9 }, {}, defaults);
    expect(r).toEqual({
      position: { x: 7, y: 9, z: 0 },
      rotation: 0,
      width: 100,
      length: 200,
      bodyHeightMm: 300,
      mountingElevationMm: 400,
    });
  });

  it('lets every override win over its default', () => {
    const r = resolveBodyPlacement(
      { x: 1, y: 2 },
      { width: 11, length: 22, bodyHeightMm: 33, mountingElevationMm: 44, rotation: 90 },
      defaults,
    );
    expect(r).toEqual({
      position: { x: 1, y: 2, z: 0 },
      rotation: 90,
      width: 11,
      length: 22,
      bodyHeightMm: 33,
      mountingElevationMm: 44,
    });
  });

  it('treats an explicit 0 override as a value, not a fallback trigger', () => {
    const r = resolveBodyPlacement({ x: 0, y: 0 }, { rotation: 0, width: 0 }, defaults);
    expect(r.rotation).toBe(0);
    // width 0 is a hard-error case downstream, but resolution must not swallow it.
    expect(r.width).toBe(0);
  });
});
