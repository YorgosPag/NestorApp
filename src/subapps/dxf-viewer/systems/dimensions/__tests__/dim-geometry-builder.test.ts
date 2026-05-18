/**
 * ADR-362 Phase O2 — dim-geometry-builder orchestrator dispatch tests.
 *
 * Verifies that `buildDimensionGeometry` routes every DimensionType to the
 * correct per-variant builder and that the returned geometry has the expected
 * `kind` discriminant. Does NOT re-test detailed geometry math (covered by
 * per-builder suites in `linear-aligned-builder.test.ts` etc.).
 */

import type {
  AlignedDimensionEntity,
  Angular2LDimensionEntity,
  Angular3PDimensionEntity,
  ArcLengthDimensionEntity,
  BaselineDimensionEntity,
  ContinuedDimensionEntity,
  DiameterDimensionEntity,
  DimStyle,
  JoggedRadiusDimensionEntity,
  LinearDimensionEntity,
  OrdinateDimensionEntity,
  RadiusDimensionEntity,
} from '../../../types/dimension';
import { buildDimensionGeometry, type DimensionLookup } from '../dim-geometry-builder';
import { ISO_129_TEMPLATE } from '../dim-style-templates';

const STYLE: DimStyle = ISO_129_TEMPLATE;

function base(id: string) {
  return {
    id,
    type: 'dimension' as const,
    styleId: STYLE.id,
    layerId: '0',
  };
}

// Minimal parent linear entity for baseline/continued lookup
const LINEAR_PARENT: LinearDimensionEntity = {
  ...base('parent'),
  dimensionType: 'linear',
  rotation: 0,
  defPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 50 }],
};

const LOOKUP: DimensionLookup = (id) => (id === 'parent' ? LINEAR_PARENT : undefined);

describe('buildDimensionGeometry — orchestrator dispatch', () => {
  it('linear → kind=linear', () => {
    const entity: LinearDimensionEntity = {
      ...base('d1'),
      dimensionType: 'linear',
      rotation: 0,
      defPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 50 }],
    };
    expect(buildDimensionGeometry(entity, STYLE).kind).toBe('linear');
  });

  it('aligned → kind=linear', () => {
    const entity: AlignedDimensionEntity = {
      ...base('d2'),
      dimensionType: 'aligned',
      defPoints: [{ x: 0, y: 0 }, { x: 100, y: 50 }, { x: 50, y: 60 }],
    };
    expect(buildDimensionGeometry(entity, STYLE).kind).toBe('linear');
  });

  it('angular2L → kind=angular', () => {
    const entity: Angular2LDimensionEntity = {
      ...base('d3'),
      dimensionType: 'angular2L',
      defPoints: [
        { x: 0, y: 0 }, { x: 0, y: 100 },
        { x: 0, y: 0 }, { x: 100, y: 0 },
        { x: 80, y: 80 },
      ],
    };
    expect(buildDimensionGeometry(entity, STYLE).kind).toBe('angular');
  });

  it('angular3P → kind=angular', () => {
    const entity: Angular3PDimensionEntity = {
      ...base('d4'),
      dimensionType: 'angular3P',
      defPoints: [
        { x: 50, y: 0 },
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 80, y: 50 },
      ],
    };
    expect(buildDimensionGeometry(entity, STYLE).kind).toBe('angular');
  });

  it('radius → kind=radial', () => {
    const entity: RadiusDimensionEntity = {
      ...base('d5'),
      dimensionType: 'radius',
      defPoints: [{ x: 0, y: 0 }, { x: 50, y: 0 }],
    };
    expect(buildDimensionGeometry(entity, STYLE).kind).toBe('radial');
  });

  it('diameter → kind=radial', () => {
    const entity: DiameterDimensionEntity = {
      ...base('d6'),
      dimensionType: 'diameter',
      defPoints: [{ x: -50, y: 0 }, { x: 50, y: 0 }],
    };
    expect(buildDimensionGeometry(entity, STYLE).kind).toBe('radial');
  });

  it('arcLength → kind=radial', () => {
    const entity: ArcLengthDimensionEntity = {
      ...base('d7'),
      dimensionType: 'arcLength',
      defPoints: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 0, y: 50 }],
    };
    expect(buildDimensionGeometry(entity, STYLE).kind).toBe('radial');
  });

  it('joggedRadius → kind=radial', () => {
    const entity: JoggedRadiusDimensionEntity = {
      ...base('d8'),
      dimensionType: 'joggedRadius',
      defPoints: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 30, y: 10 },
        { x: 40, y: 5 },
      ],
    };
    expect(buildDimensionGeometry(entity, STYLE).kind).toBe('radial');
  });

  it('ordinate → kind=linear', () => {
    const entity: OrdinateDimensionEntity = {
      ...base('d9'),
      dimensionType: 'ordinate',
      axis: 'x',
      datum: { x: 0, y: 0 },
      defPoints: [{ x: 30, y: 0 }], // |feature.x - datum.x| = 30 — non-degenerate
    };
    expect(buildDimensionGeometry(entity, STYLE).kind).toBe('linear');
  });

  it('baseline → kind=linear (resolves parent via lookup)', () => {
    const entity: BaselineDimensionEntity = {
      ...base('d10'),
      dimensionType: 'baseline',
      parentDimensionId: 'parent',
      defPoints: [{ x: 150, y: 0 }],
    };
    expect(buildDimensionGeometry(entity, STYLE, LOOKUP).kind).toBe('linear');
  });

  it('continued → kind=linear (resolves parent via lookup)', () => {
    const entity: ContinuedDimensionEntity = {
      ...base('d11'),
      dimensionType: 'continued',
      parentDimensionId: 'parent',
      defPoints: [{ x: 150, y: 0 }],
    };
    expect(buildDimensionGeometry(entity, STYLE, LOOKUP).kind).toBe('linear');
  });

  it('unknown dimensionType → throws with entity id', () => {
    const entity = {
      ...base('d-unknown'),
      dimensionType: 'unknown_future_type',
      defPoints: [],
    } as never;
    expect(() => buildDimensionGeometry(entity, STYLE)).toThrow(/d-unknown/);
  });
});
