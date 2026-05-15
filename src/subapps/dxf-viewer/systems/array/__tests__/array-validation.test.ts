import { validateArrayParams } from '../array-validation';
import type { RectParams, PolarParams, PathParams } from '../types';
import type { EntityType } from '../../../types/entities';

const LINE: EntityType = 'line';

function makeRect(rows: number, cols: number, overrides: Partial<RectParams> = {}): RectParams {
  return {
    kind: 'rect',
    rows,
    cols,
    rowSpacing: 10,
    colSpacing: 10,
    angle: 0,
    ...overrides,
  };
}

function makePolar(count: number, overrides: Partial<PolarParams> = {}): PolarParams {
  return {
    kind: 'polar',
    count,
    fillAngle: 360,
    startAngle: 0,
    rotateItems: true,
    center: { x: 0, y: 0 },
    radius: 10,
    ...overrides,
  };
}

function makePath(count: number, overrides: Partial<PathParams> = {}): PathParams {
  return {
    kind: 'path',
    count,
    method: 'divide',
    alignItems: true,
    pathEntityId: 'path-entity-1',
    reversed: false,
    ...overrides,
  };
}

// ── Nested array forbidden ────────────────────────────────────────────────────

describe('nested array forbidden', () => {
  it('rejects "array" as source type', () => {
    const result = validateArrayParams(makeRect(3, 4), ['array' as EntityType]);
    expect(result.severity).toBe('error');
    expect(result.messageKey).toContain('nested');
  });

  it('accepts regular source types', () => {
    const result = validateArrayParams(makeRect(3, 4), [LINE, 'circle']);
    expect(result.severity).toBe('ok');
  });
});

// ── Source-type allowlist ────────────────────────────────────────────────────

describe('source type allowlist', () => {
  it('rejects unknown source type', () => {
    const result = validateArrayParams(makeRect(1, 2), ['unknown-type' as EntityType]);
    expect(result.severity).toBe('error');
    expect(result.messageKey).toContain('sourceType');
  });

  it('accepts all listed source types', () => {
    const types: EntityType[] = ['line', 'circle', 'arc', 'polyline', 'lwpolyline',
      'ellipse', 'spline', 'text', 'mtext', 'hatch', 'dimension', 'leader'];
    const result = validateArrayParams(makeRect(2, 2), types);
    expect(result.severity).toBe('ok');
  });
});

// ── Hard limit (5000) ─────────────────────────────────────────────────────────

describe('hard limit 5000', () => {
  it('5001 items → error', () => {
    const result = validateArrayParams(makeRect(5001, 1), [LINE]);
    expect(result.severity).toBe('error');
    expect(result.messageKey).toContain('hardLimit');
    expect(result.totalCount).toBe(5001);
  });

  it('5000 items → warn (boundary: hard limit not exceeded but >1000)', () => {
    const result = validateArrayParams(makeRect(100, 50), [LINE]);
    expect(result.severity).toBe('warn');
    expect(result.totalCount).toBe(5000);
  });

  it('rect 70×72=5040 → error', () => {
    const result = validateArrayParams(makeRect(70, 72), [LINE]);
    expect(result.severity).toBe('error');
  });
});

// ── Warn limit (1000) ─────────────────────────────────────────────────────────

describe('warn limit 1000', () => {
  it('1001 items → warn', () => {
    const result = validateArrayParams(makePolar(1001), [LINE]);
    expect(result.severity).toBe('warn');
    expect(result.messageKey).toContain('warnLimit');
    expect(result.totalCount).toBe(1001);
  });

  it('1000 items → ok (boundary)', () => {
    const result = validateArrayParams(makePolar(1000), [LINE]);
    expect(result.severity).toBe('ok');
  });

  it('999 items → ok', () => {
    const result = validateArrayParams(makePath(999), [LINE]);
    expect(result.severity).toBe('ok');
  });
});

// ── Rect-specific param validation ───────────────────────────────────────────

describe('rect param validation', () => {
  it('zero colSpacing → error', () => {
    const result = validateArrayParams(makeRect(2, 2, { colSpacing: 0 }), [LINE]);
    expect(result.severity).toBe('error');
    expect(result.messageKey).toContain('spacing');
  });

  it('zero rowSpacing → error', () => {
    const result = validateArrayParams(makeRect(2, 2, { rowSpacing: 0 }), [LINE]);
    expect(result.severity).toBe('error');
  });

  it('negative spacing → ok (direction inversion is valid)', () => {
    const result = validateArrayParams(makeRect(2, 2, { colSpacing: -10 }), [LINE]);
    expect(result.severity).toBe('ok');
  });

  it('rows < 1 → error', () => {
    const result = validateArrayParams(makeRect(0, 4), [LINE]);
    expect(result.severity).toBe('error');
  });
});

// ── Polar-specific param validation ──────────────────────────────────────────

describe('polar param validation', () => {
  it('fillAngle=0 → error', () => {
    const result = validateArrayParams(makePolar(6, { fillAngle: 0 }), [LINE]);
    expect(result.severity).toBe('error');
    expect(result.messageKey).toContain('fillAngle');
  });

  it('count=0 → error', () => {
    const result = validateArrayParams(makePolar(0), [LINE]);
    expect(result.severity).toBe('error');
  });

  it('negative fillAngle → ok (CW direction)', () => {
    const result = validateArrayParams(makePolar(6, { fillAngle: -180 }), [LINE]);
    expect(result.severity).toBe('ok');
  });
});

// ── Path-specific param validation ───────────────────────────────────────────

describe('path param validation', () => {
  it('missing pathEntityId → error', () => {
    const result = validateArrayParams(makePath(6, { pathEntityId: '' }), [LINE]);
    expect(result.severity).toBe('error');
    expect(result.messageKey).toContain('pathEntity');
  });

  it('method=measure with spacing=0 → error', () => {
    const result = validateArrayParams(makePath(6, { method: 'measure', spacing: 0 }), [LINE]);
    expect(result.severity).toBe('error');
  });

  it('method=measure with valid spacing → ok', () => {
    const result = validateArrayParams(makePath(6, { method: 'measure', spacing: 5 }), [LINE]);
    expect(result.severity).toBe('ok');
  });
});
