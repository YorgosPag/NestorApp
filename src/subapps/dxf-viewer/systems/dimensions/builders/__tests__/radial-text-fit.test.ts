/**
 * ADR-362 Phase M3 — Radial text-fit (DIMTIX / DIMTOFL / DIMTMOVE) tests.
 *
 * Covers the pure decision (`resolveRadialTextFit`) across the faithful-AutoCAD
 * matrix (radius/diameter/arcLength/jogged × dimtix × dimtofl × dimtmove) and the
 * pure materialiser (`computeRadialPlacement`): inside-line prepend, outside leader
 * append with junction de-dup, DIMTMOVE landing tail, and anchor selection.
 */

import type { Point2D } from '../../../../rendering/types/Types';
import {
  resolveRadialTextFit,
  computeRadialPlacement,
  type RadialTextFitResult,
} from '../radial-text-fit';

const p = (x: number, y: number): Point2D => ({ x, y });

describe('resolveRadialTextFit — faithful-AutoCAD matrix', () => {
  interface Case {
    readonly name: string;
    readonly input: Parameters<typeof resolveRadialTextFit>[0];
    readonly expected: RadialTextFitResult;
  }

  const R = { defaultOutside: true, isDiameter: false }; // radius / jogged
  const D = { defaultOutside: false, isDiameter: true }; // diameter
  const A = { defaultOutside: false, isDiameter: false }; // arcLength

  const cases: readonly Case[] = [
    // ── radius (already outside by default) ──────────────────────────────────
    {
      name: 'radius default: outside, no inside line, no leader',
      input: { ...R, dimtix: false, dimtofl: false, dimtmove: 0 },
      expected: { textOutside: true, drawLineInside: false, useLeader: false },
    },
    {
      name: 'radius DIMTIX on: still outside (no-op for radius)',
      input: { ...R, dimtix: true, dimtofl: false, dimtmove: 0 },
      expected: { textOutside: true, drawLineInside: false, useLeader: false },
    },
    {
      name: 'radius DIMTOFL on: inside line drawn while text outside',
      input: { ...R, dimtix: false, dimtofl: true, dimtmove: 0 },
      expected: { textOutside: true, drawLineInside: true, useLeader: false },
    },
    {
      name: 'radius DIMTMOVE=1: landing leader on the outside text',
      input: { ...R, dimtix: false, dimtofl: false, dimtmove: 1 },
      expected: { textOutside: true, drawLineInside: false, useLeader: true },
    },
    // ── diameter (chord always inside; text inside by default) ───────────────
    {
      name: 'diameter default: text inside (centre), chord inside',
      input: { ...D, dimtix: false, dimtofl: false, dimtmove: 0 },
      expected: { textOutside: false, drawLineInside: true, useLeader: false },
    },
    {
      name: 'diameter DIMTIX on: text forced outside, chord stays inside',
      input: { ...D, dimtix: true, dimtofl: false, dimtmove: 0 },
      expected: { textOutside: true, drawLineInside: true, useLeader: false },
    },
    {
      name: 'diameter DIMTIX on + DIMTMOVE=1: outside + landing',
      input: { ...D, dimtix: true, dimtofl: false, dimtmove: 1 },
      expected: { textOutside: true, drawLineInside: true, useLeader: true },
    },
    // ── arcLength (text on arc by default) ───────────────────────────────────
    {
      name: 'arcLength default: text on arc (inside)',
      input: { ...A, dimtix: false, dimtofl: false, dimtmove: 0 },
      expected: { textOutside: false, drawLineInside: true, useLeader: false },
    },
    {
      name: 'arcLength DIMTIX on: pushed outside, no inside line',
      input: { ...A, dimtix: true, dimtofl: false, dimtmove: 0 },
      expected: { textOutside: true, drawLineInside: false, useLeader: false },
    },
    {
      name: 'arcLength DIMTIX on + DIMTOFL on: outside + arc kept inside',
      input: { ...A, dimtix: true, dimtofl: true, dimtmove: 0 },
      expected: { textOutside: true, drawLineInside: true, useLeader: false },
    },
    {
      name: 'DIMTMOVE=1 is a no-op while text stays inside (diameter default)',
      input: { ...D, dimtix: false, dimtofl: false, dimtmove: 1 },
      expected: { textOutside: false, drawLineInside: true, useLeader: false },
    },
  ];

  it.each(cases)('$name', ({ input, expected }) => {
    expect(resolveRadialTextFit(input)).toEqual(expected);
  });
});

describe('computeRadialPlacement — leader assembly', () => {
  const base = {
    insideAnchor: p(5, 0),
    outsideAnchor: p(15, 0),
    insideLinePath: [p(0, 0), p(10, 0)],
    outsideLeaderPath: [p(10, 0), p(20, 0)],
    outwardDir: p(1, 0),
    arrowSize: 2,
  };

  it('radius default (outside, no inside line): leader = outside segment only', () => {
    const out = computeRadialPlacement({
      ...base,
      fit: { textOutside: true, drawLineInside: false, useLeader: false },
    });
    expect(out.textAnchor).toEqual(p(15, 0));
    expect(out.leaderPath).toEqual([p(10, 0), p(20, 0)]);
  });

  it('radius + DIMTOFL: inside line prepended, junction de-duplicated', () => {
    const out = computeRadialPlacement({
      ...base,
      fit: { textOutside: true, drawLineInside: true, useLeader: false },
    });
    // (10,0) appears once, not twice, at the inside/outside junction.
    expect(out.leaderPath).toEqual([p(0, 0), p(10, 0), p(20, 0)]);
    expect(out.textAnchor).toEqual(p(15, 0));
  });

  it('diameter default (text inside): leader = chord only, anchor = inside', () => {
    const out = computeRadialPlacement({
      ...base,
      insideLinePath: [p(-10, 0), p(10, 0)],
      fit: { textOutside: false, drawLineInside: true, useLeader: false },
    });
    expect(out.textAnchor).toEqual(p(5, 0));
    expect(out.leaderPath).toEqual([p(-10, 0), p(10, 0)]);
  });

  it('diameter DIMTIX on: chord + outward leader, anchor = outside', () => {
    const out = computeRadialPlacement({
      ...base,
      insideLinePath: [p(-10, 0), p(10, 0)],
      outsideLeaderPath: [p(10, 0), p(14, 0)],
      fit: { textOutside: true, drawLineInside: true, useLeader: false },
    });
    expect(out.leaderPath).toEqual([p(-10, 0), p(10, 0), p(14, 0)]);
    expect(out.textAnchor).toEqual(p(15, 0));
  });

  it('DIMTMOVE=1: landing tail appended along outwardDir (2×arrowSize)', () => {
    const out = computeRadialPlacement({
      ...base,
      fit: { textOutside: true, drawLineInside: false, useLeader: true },
    });
    // tail = (20,0) + (1,0) * (2 * 2) = (24,0)
    expect(out.leaderPath).toEqual([p(10, 0), p(20, 0), p(24, 0)]);
  });

  it('landing is skipped when there is no leader path (defensive)', () => {
    const out = computeRadialPlacement({
      ...base,
      insideLinePath: [],
      outsideLeaderPath: [],
      fit: { textOutside: true, drawLineInside: false, useLeader: true },
    });
    expect(out.leaderPath).toEqual([]);
  });
});
