/**
 * ADR-358 Phase 5a — `stair-completion` builders.
 */
import {
  buildDefaultStairParams,
  buildStairEntity,
  buildStairCommandHistoryEntry,
  directionFromPoints,
} from '../stair-completion';

describe('stair-completion builders (Phase 5a)', () => {
  const basePoint = { x: 100, y: 200 };

  it('1. buildStairEntity → entity with valid `stair_<ulid26>` id', () => {
    const params = buildDefaultStairParams(basePoint, 0);
    const entity = buildStairEntity(params, '0');
    // Accept both ulid26 (production) and uuid (test fallback) shapes.
    expect(entity.id).toMatch(/^stair_[A-Za-z0-9_-]+$/);
    expect(entity.type).toBe('stair');
    expect(entity.kind).toBe('straight');
  });

  it('2. geometry field populated by computeStairGeometry SSoT', () => {
    const params = buildDefaultStairParams(basePoint, 0);
    const entity = buildStairEntity(params, '0');
    expect(entity.geometry.treads.length).toBeGreaterThan(0);
    expect(entity.geometry.walkline.length).toBeGreaterThanOrEqual(2);
    expect(entity.geometry.arrowSymbol.label).toBe('UP');
  });

  it('3. zero `undefined` in required fields (Firestore safe)', () => {
    const params = buildDefaultStairParams(basePoint, 45);
    const entity = buildStairEntity(params, '0');
    const requiredKeys: ReadonlyArray<keyof typeof entity> = [
      'id', 'type', 'kind', 'params', 'geometry', 'validation',
    ];
    for (const key of requiredKeys) {
      expect(entity[key]).not.toBeUndefined();
    }
    expect(entity.validation.hasCodeViolations).toBe(false);
    expect(entity.validation.violationKeys).toEqual([]);
  });

  it('4. params echo input (rise/tread/width overrides preserved)', () => {
    const overrides = { rise: 180, tread: 300, width: 1500, stepCount: 14 };
    const params = buildDefaultStairParams(basePoint, 30, overrides);
    const entity = buildStairEntity(params, '0');
    expect(entity.params.rise).toBe(180);
    expect(entity.params.tread).toBe(300);
    expect(entity.params.width).toBe(1500);
    expect(entity.params.stepCount).toBe(14);
    expect(entity.params.basePoint).toEqual({ x: 100, y: 200, z: 0 });
    expect(entity.params.direction).toBe(30);
  });

  it('5. command history entry round-trip-able', () => {
    const params = buildDefaultStairParams(basePoint, 0);
    const entity = buildStairEntity(params, 'layerX');
    const entry = buildStairCommandHistoryEntry(entity);
    expect(entry.entityId).toBe(entity.id);
    expect(entry.kind).toBe('straight');
    expect(entry.params).toBe(entity.params);
    expect(typeof entry.createdAt).toBe('number');
  });

  it('6. levelId stored in dedicated field — layer no longer abused', () => {
    const params = buildDefaultStairParams(basePoint, 0);
    const entity = buildStairEntity(params, 'level-42');
    expect(entity.levelId).toBe('level-42');
    // base-entity requires `layerId: string`; the builder uses '' (no layer)
    // rather than abusing it to carry the level — the level lives in `levelId`.
    expect(entity.layerId).toBe('');
  });

  it('extra: directionFromPoints returns 0 for +X cardinal direction', () => {
    expect(directionFromPoints({ x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(0, 6);
    expect(directionFromPoints({ x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(90, 6);
  });
});
