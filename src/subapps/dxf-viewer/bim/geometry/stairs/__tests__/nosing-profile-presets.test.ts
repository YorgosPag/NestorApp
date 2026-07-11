/**
 * ADR-358 Q19 Φ6 — Nosing Profile preset generator ↔ classifier round-trip.
 *
 * Guards the SSoT contract with the LOCKED section semantics (x=0..size fwd,
 * y=0=top down, max x = overhang) consumed by Φ4a (`resolveTreadNosing`) and
 * Φ4b (`buildTreadNosingMesh`).
 */

import {
  buildNosingProfile,
  classifyNosingProfile,
  DEFAULT_NOSING_PROFILE_SIZE,
} from '../nosing-profile-presets';
import { resolveTreadNosing } from '../stair-tread-overrides';
import type { StairParams } from '../../../types/stair-types';

describe('buildNosingProfile', () => {
  it('square → undefined (flat, no shaped section)', () => {
    expect(buildNosingProfile('square', 25)).toBeUndefined();
  });

  it('non-positive size → undefined for any preset', () => {
    expect(buildNosingProfile('bullnose', 0)).toBeUndefined();
    expect(buildNosingProfile('chamfer', -5)).toBeUndefined();
  });

  it('chamfer(s) → straight bevel (s,0)→(0,−s)', () => {
    expect(buildNosingProfile('chamfer', 30)).toEqual([
      { x: 30, y: 0 },
      { x: 0, y: -30 },
    ]);
  });

  it('bullnose(r) → quarter arc from (r,0) to (0,−r), max x = r', () => {
    const arc = buildNosingProfile('bullnose', 20)!;
    expect(arc.length).toBeGreaterThanOrEqual(3);
    expect(arc[0]!.x).toBeCloseTo(20);
    expect(arc[0]!.y).toBeCloseTo(0);
    const last = arc[arc.length - 1]!;
    expect(last.x).toBeCloseTo(0);
    expect(last.y).toBeCloseTo(-20);
    for (const p of arc) expect(Math.hypot(p.x, p.y)).toBeCloseTo(20); // on the radius
    const maxX = Math.max(...arc.map((p) => p.x));
    expect(maxX).toBeCloseTo(20); // overhang = r
  });
});

describe('classifyNosingProfile (round-trip)', () => {
  it('undefined / empty → square', () => {
    expect(classifyNosingProfile(undefined)).toEqual({ kind: 'square', size: 0 });
    expect(classifyNosingProfile([])).toEqual({ kind: 'square', size: 0 });
  });

  it('recovers a chamfer preset', () => {
    const section = buildNosingProfile('chamfer', 18);
    expect(classifyNosingProfile(section)).toEqual({ kind: 'chamfer', size: 18 });
  });

  it('recovers a bullnose preset', () => {
    const section = buildNosingProfile('bullnose', 22);
    expect(classifyNosingProfile(section)).toEqual({ kind: 'bullnose', size: 22 });
  });

  it('unrecognised freehand section → custom (size = overhang)', () => {
    const freehand = [
      { x: 10, y: 0 },
      { x: 15, y: -5 },
      { x: 4, y: -12 },
    ];
    expect(classifyNosingProfile(freehand)).toEqual({ kind: 'custom', size: 15 });
  });
});

describe('end-to-end — generated profile drives the Φ4a overhang', () => {
  it('resolveTreadNosing reads the preset section + overhang', () => {
    const profile = buildNosingProfile('bullnose', DEFAULT_NOSING_PROFILE_SIZE)!;
    const params = {
      nosing: 10,
      perTreadOverrides: { 2: { customProfile: profile } },
    } as unknown as StairParams;
    const resolved = resolveTreadNosing(params, 2);
    expect(resolved.overhangDepth).toBeCloseTo(DEFAULT_NOSING_PROFILE_SIZE);
    expect(resolved.section).toBe(profile);
  });
});
