/**
 * ADR-408 Φ11 — generic fitting BODY SSoT tests (computeFittingBody /
 * tessellateFittingFootprint / fittingTrimExtent).
 *
 * One body parametrisation feeds the 2D footprint, the 3D mesh and the pipe trim;
 * these tests pin the per-form shape (elbow bend, inline rect/trapezoid, tee/cross
 * arm union, cap dome) plus the trim half-extent and the degenerate null cases.
 */

import {
  computeFittingBody,
  tessellateFittingFootprint,
  fittingTrimExtent,
  type FittingBodyInput,
} from '../mep-fitting-body';

const RIGHT = { x: 1, y: 0 };
const LEFT = { x: -1, y: 0 };
const UP = { x: 0, y: 1 };
const DOWN = { x: 0, y: -1 };
const NODE = { x: 0, y: 0 };
const D = 10;

const input = (over: Partial<FittingBodyInput> & Pick<FittingBodyInput, 'kind' | 'incidents'>): FittingBodyInput => ({
  node: NODE,
  primaryDiameter: D,
  ...over,
});

describe('computeFittingBody — elbow (bend form)', () => {
  const body = computeFittingBody(
    input({ kind: 'elbow', incidents: [{ dir: RIGHT, diameter: D }, { dir: UP, diameter: D }] }),
  )!;

  it('produces a bend body', () => {
    expect(body.form).toBe('bend');
  });

  it('trims each leg by the bend tangent length (1.5·D at 90°)', () => {
    expect(fittingTrimExtent(body)).toBeCloseTo(15);
  });

  it('returns null for an elbow with a single incident (degenerate)', () => {
    expect(computeFittingBody(input({ kind: 'elbow', incidents: [{ dir: RIGHT, diameter: D }] }))).toBeNull();
  });
});

describe('computeFittingBody — reducing elbow (bend form, tapering Ø)', () => {
  // Leg A = Ø20, leg B = Ø6 at 90° → a reducing elbow.
  const body = computeFittingBody(
    input({
      kind: 'elbow',
      incidents: [{ dir: RIGHT, diameter: 20 }, { dir: UP, diameter: 6 }],
      primaryDiameter: 20,
      secondaryDiameter: 6,
    }),
  )!;

  it('carries the per-leg end radii onto the bend (radiusStart → radiusEnd)', () => {
    expect(body.form).toBe('bend');
    if (body.form !== 'bend') return;
    expect(body.bend.radiusStart).toBeCloseTo(10); // 20/2 at leg A
    expect(body.bend.radiusEnd).toBeCloseTo(3); // 6/2 at leg B
  });

  it('narrows the footprint band from tangentA to tangentB', () => {
    const segments = 8;
    const ring = tessellateFittingFootprint(body, segments);
    const outer = ring.slice(0, segments + 1);
    const inner = ring.slice(segments + 1).reverse();
    const band = (i: number) =>
      Math.hypot(outer[i]!.x - inner[i]!.x, outer[i]!.y - inner[i]!.y);
    expect(band(0)).toBeGreaterThan(band(segments));
  });
});

describe('computeFittingBody — coupling (inline form)', () => {
  const body = computeFittingBody(
    input({ kind: 'coupling', incidents: [{ dir: RIGHT, diameter: D }, { dir: LEFT, diameter: D }] }),
  )!;

  it('produces an inline body with equal sleeve radii', () => {
    expect(body.form).toBe('inline');
    if (body.form !== 'inline') return;
    expect(body.radiusPos).toBeCloseTo(body.radiusNeg);
    expect(body.radiusPos).toBeCloseTo((D * 1.15) / 2); // sleeve laps the pipe
  });

  it('trims by the body half-length (0.75·D)', () => {
    expect(fittingTrimExtent(body)).toBeCloseTo(7.5);
  });

  it('tessellates to a 4-corner quad', () => {
    expect(tessellateFittingFootprint(body)).toHaveLength(4);
  });
});

describe('computeFittingBody — reducer (inline form, unequal radii)', () => {
  const body = computeFittingBody(
    input({
      kind: 'reducer',
      incidents: [{ dir: RIGHT, diameter: 20 }, { dir: LEFT, diameter: 10 }],
      primaryDiameter: 20,
      secondaryDiameter: 10,
    }),
  )!;

  it('matches each face to its own pipe radius (+axis = incident[0])', () => {
    expect(body.form).toBe('inline');
    if (body.form !== 'inline') return;
    expect(body.radiusPos).toBeCloseTo(10); // 20/2
    expect(body.radiusNeg).toBeCloseTo(5); // 10/2
  });

  it('trims by the taper half-length (1.0·primary)', () => {
    expect(fittingTrimExtent(body)).toBeCloseTo(20);
  });
});

describe('computeFittingBody — tee/cross (legs form)', () => {
  const tee = computeFittingBody(
    input({ kind: 'tee', incidents: [{ dir: RIGHT, diameter: D }, { dir: LEFT, diameter: D }, { dir: UP, diameter: D }] }),
  )!;
  const cross = computeFittingBody(
    input({ kind: 'cross', incidents: [{ dir: RIGHT, diameter: D }, { dir: LEFT, diameter: D }, { dir: UP, diameter: D }, { dir: DOWN, diameter: D }] }),
  )!;

  it('produces one leg per incident', () => {
    expect(tee.form).toBe('legs');
    if (tee.form === 'legs') expect(tee.legs).toHaveLength(3);
    if (cross.form === 'legs') expect(cross.legs).toHaveLength(4);
  });

  it('emits a union outline with 3 vertices per arm', () => {
    expect(tessellateFittingFootprint(tee)).toHaveLength(9);
    expect(tessellateFittingFootprint(cross)).toHaveLength(12);
  });

  it('trims by the arm half-extent (0.6·D)', () => {
    expect(fittingTrimExtent(tee)).toBeCloseTo(6);
  });

  it('returns null for a single-leg degenerate junction', () => {
    expect(computeFittingBody(input({ kind: 'tee', incidents: [{ dir: RIGHT, diameter: D }] }))).toBeNull();
  });
});

describe('computeFittingBody — cap (dome form)', () => {
  const body = computeFittingBody(
    input({ kind: 'cap', incidents: [{ dir: RIGHT, diameter: D }] }),
  )!;

  it('bulges OUTWARD, opposite the incident direction', () => {
    expect(body.form).toBe('cap');
    if (body.form !== 'cap') return;
    expect(body.dir.x).toBeCloseTo(-1); // incident RIGHT → dome faces LEFT
    expect(body.dir.y).toBeCloseTo(0);
    expect(body.radius).toBeCloseTo(D / 2);
  });

  it('trims nothing (the cap sits on the pipe end)', () => {
    expect(fittingTrimExtent(body)).toBe(0);
  });

  it('tessellates to a half-disk arc', () => {
    expect(tessellateFittingFootprint(body, 8)).toHaveLength(9);
  });
});

describe('tessellateFittingFootprint — invariants', () => {
  const bodies = [
    computeFittingBody(input({ kind: 'elbow', incidents: [{ dir: RIGHT, diameter: D }, { dir: UP, diameter: D }] }))!,
    computeFittingBody(input({ kind: 'coupling', incidents: [{ dir: RIGHT, diameter: D }, { dir: LEFT, diameter: D }] }))!,
    computeFittingBody(input({ kind: 'tee', incidents: [{ dir: RIGHT, diameter: D }, { dir: LEFT, diameter: D }, { dir: UP, diameter: D }] }))!,
    computeFittingBody(input({ kind: 'cap', incidents: [{ dir: RIGHT, diameter: D }] }))!,
  ];

  it('every footprint is a valid z=0 polygon (≥3 vertices)', () => {
    for (const body of bodies) {
      const verts = tessellateFittingFootprint(body);
      expect(verts.length).toBeGreaterThanOrEqual(3);
      for (const v of verts) expect(v.z).toBe(0);
    }
  });
});
