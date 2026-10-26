/**
 * ADR-920 Β4.8 Τ.3 — breakline elevation conflicts reach the engineer as QA flags.
 *
 * Two promises are pinned here: (1) the check only TRANSLATES the builder's report — severity from Δz, LOCAL → WORLD,
 * the overruled breakline named by its 1-based number, nothing when the breaklines agree; (2) the report comes from the
 * ONE memoised build — `getTopoBuildReport().surface` IS the surface every other consumer reads, so asking QA's question
 * never triangulates the survey a second time.
 */

import { clearTopo, setTopoPoints } from '../../TopoPointStore';
import { seedBreakline } from '../../__tests__/topo-breakline-fixtures';
import { getTopoBuildReport, getTopoSurfaceFull, invalidateTopoSurface } from '../../topo-surface';
import { buildTinWithReport } from '../../tin-builder';
import type { Breakline, TopoPoint, TopoPoint3D } from '../../topo-types';
import {
  breaklineConflictFlag, breaklineConflictSeverity, checkBreaklineConflicts, KEPT_BY_SURVEY, rankBreaklineConflicts,
} from '../check-breakline-conflicts';
import { runTopoQa } from '../run-topo-qa';
import i18next from 'i18next';
import ICU from 'i18next-icu';
import el from '@/i18n/locales/el/dxf-viewer-panels.json';
import en from '@/i18n/locales/en/dxf-viewer-panels.json';

/** Far from the world origin on purpose: a forgotten LOCAL → WORLD shift is off by ~500 km, not by a rounding error. */
const OX = 500_000_000;
const OY = 4_000_000_000;
const p = (x: number, y: number, z: number): TopoPoint3D => ({ x: OX + x, y: OY + y, z });

const SQUARE: readonly TopoPoint[] = [p(0, 0, 0), p(10_000, 0, 0), p(10_000, 10_000, 0), p(0, 10_000, 0)];
const EAST_WEST: readonly TopoPoint3D[] = [p(0, 5_000, 1_000), p(10_000, 5_000, 1_000)];
const northSouth = (z: number): TopoPoint3D[] => [p(5_000, 0, z), p(5_000, 10_000, z)];
const line = (id: string, vertices: readonly TopoPoint3D[]): Breakline => ({ id, vertices });

function flagsOf(points: readonly TopoPoint[], breaklines: readonly Breakline[]) {
  const report = buildTinWithReport(points, breaklines);
  return checkBreaklineConflicts(report.breaklineConflicts, breaklines, report.surface.origin);
}

beforeEach(() => {
  clearTopo();
  invalidateTopoSurface();
});

describe('checkBreaklineConflicts', () => {
  it('flags a crossing at the crossing, in WORLD, naming the overruled (later) breakline', () => {
    const flags = flagsOf(SQUARE, [line('a', EAST_WEST), line('b', northSouth(3_000))]);

    expect(flags).toHaveLength(1);
    const [flag] = flags;
    expect(flag!.kind).toBe('breakline-conflict');
    expect(flag!.messageKey).toBe('topography.qa.flag.breaklineCrossing');
    expect(flag!.at.x).toBeCloseTo(OX + 5_000, 6);
    expect(flag!.at.y).toBeCloseTo(OY + 5_000, 6);
    expect(flag!.atZMm).toBeCloseTo(1_000, 6); // the KEPT (earlier) elevation — what the surface carries
    // Β3.2 — the PAIR: #1 kept its elevation, #2 was overruled.
    expect(flag!.messageParams).toEqual({ line: 2, keptLine: 1, kept: '1.00', overruled: '3.00', deviation: '2.00' });
    expect(flag!.severity).toBe('high');
  });

  it('is silent when crossing breaklines agree — a junction, not a contradiction', () => {
    expect(flagsOf(SQUARE, [line('a', EAST_WEST), line('b', northSouth(1_000))])).toEqual([]);
  });

  it('flags a breakline passing through a survey point at another elevation (the point keeps its Z)', () => {
    const flags = flagsOf([...SQUARE, p(5_000, 5_000, 0)], [line('a', EAST_WEST)]);

    expect(flags).toHaveLength(1);
    expect(flags[0]!.messageKey).toBe('topography.qa.flag.breaklineVertexOn');
    // A survey point kept its Z — no breakline is named (the ICU `none` branch).
    expect(flags[0]!.messageParams).toEqual({
      line: 1, keptLine: KEPT_BY_SURVEY, kept: '0.00', overruled: '1.00', deviation: '1.00',
    });
  });

  it('lists the largest Δz first', () => {
    const flags = flagsOf(SQUARE, [
      line('a', EAST_WEST),
      line('b', [p(2_500, 0, 1_200), p(2_500, 10_000, 1_200)]), // Δ 0.20 m
      line('c', [p(7_500, 0, 4_000), p(7_500, 10_000, 4_000)]), // Δ 3.00 m
    ]);
    expect(flags.map((f) => f.messageParams.line)).toEqual([3, 2]);
  });
});

describe('breaklineConflictSeverity — the duplicate points\' bands, nothing hidden below them', () => {
  it.each([
    [1, 'low'], [99, 'low'], [100, 'medium'], [999, 'medium'], [1_000, 'high'], [5_000, 'high'],
  ] as const)('Δz %i mm → %s', (dz, severity) => {
    expect(breaklineConflictSeverity(dz)).toBe(severity);
  });
});

describe('the report comes from the ONE build', () => {
  it('getTopoBuildReport().surface IS getTopoSurfaceFull() — no second triangulation', () => {
    setTopoPoints(SQUARE);
    seedBreakline(EAST_WEST);
    seedBreakline(northSouth(3_000));

    const report = getTopoBuildReport();
    expect(getTopoSurfaceFull()).toBe(report.surface);
    expect(getTopoBuildReport()).toBe(report);
    expect(report.breaklineConflicts).toHaveLength(1);
  });

  it('runTopoQa surfaces the conflict in the report', () => {
    setTopoPoints(SQUARE);
    seedBreakline(EAST_WEST);
    seedBreakline(northSouth(3_000));

    const conflicts = runTopoQa('existing').flags.filter((f) => f.kind === 'breakline-conflict');
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.messageParams.line).toBe(2);
  });
});

/**
 * ADR-920 Β3.2 — the pair reaches the engineer as TEXT. The messages gained an ICU `select` (`keptLine`: a number, or
 * `none` for a survey point); a malformed branch would render the raw pattern, and no key-presence gate sees that.
 * Rendered here through the REAL locale files and the REAL ICU plugin, both languages, both branches.
 */
describe('conflict messages render the pair (el + en, real ICU)', () => {
  const instance = i18next.createInstance();

  beforeAll(async () => {
    await instance.use(new ICU()).init({
      lng: 'el', fallbackLng: false, ns: ['p'], defaultNS: 'p',
      resources: { el: { p: el }, en: { p: en } },
    });
  });

  const crossing = () => flagsOf(SQUARE, [line('a', EAST_WEST), line('b', northSouth(3_000))])[0]!;
  const onSurvey = () => flagsOf([...SQUARE, p(5_000, 5_000, 0)], [line('a', EAST_WEST)])[0]!;

  it.each([
    ['el', 'από τη #1', 'σημείο αποτύπωσης'],
    ['en', 'from #1', 'survey point'],
  ])('%s: a crossing names the kept line; a survey point is named as such', (lng, keptText, surveyText) => {
    const t = instance.getFixedT(lng);
    const a = crossing();
    const b = onSurvey();
    expect(t(a.messageKey, a.messageParams)).toContain(keptText);
    expect(t(b.messageKey, b.messageParams)).toContain(surveyText);
    for (const text of [t(a.messageKey, a.messageParams), t(b.messageKey, b.messageParams)]) {
      expect(text).not.toMatch(/[{}]|keptLine|select/);
    }
  });
});

describe('ADR-920 Β3.6 — a conflict an engineer resolved is a decision, not a QA finding', () => {
  const at = { x: OX + 5_000, y: OY + 5_000 };
  const resolvedPair = (): Breakline[] => [
    line('a', EAST_WEST),
    { ...line('b', northSouth(3_000)), crossingResolutions: [{ withBreaklineId: 'a', ...at, rule: 'average' }] },
  ];

  it('QA drops it; the remaining flags keep their report ids', () => {
    const third: Breakline = line('c', [p(2_000, 0, 5_000), p(2_000, 10_000, 5_000)]);
    const breaklines = [...resolvedPair(), third];
    const report = buildTinWithReport(SQUARE, breaklines);
    expect(report.breaklineConflicts.filter((c) => c.resolution)).toHaveLength(1);
    const flags = checkBreaklineConflicts(report.breaklineConflicts, breaklines, report.surface.origin);
    expect(flags).toHaveLength(report.breaklineConflicts.length - 1);
    const resolvedIndex = report.breaklineConflicts.findIndex((c) => c.resolution);
    expect(flags.map((f) => f.id)).not.toContain(`breakline-conflict:${resolvedIndex}`);
  });

  it.each([['el', 'Μέσος όρος'], ['en', 'Use average']])('%s: the resolved message names the rule and the result', async (lng, ruleText) => {
    const instance = i18next.createInstance();
    await instance.use(new ICU()).init({
      lng, fallbackLng: false, ns: ['p'], defaultNS: 'p', resources: { el: { p: el }, en: { p: en } },
    });
    const breaklines = resolvedPair();
    const report = buildTinWithReport(SQUARE, breaklines);
    const conflict = report.breaklineConflicts.find((c) => c.resolution)!;
    const [flag] = checkBreaklineConflicts([{ ...conflict, resolution: undefined }], breaklines, report.surface.origin);
    expect(flag!.messageParams).not.toHaveProperty('rule');
    // Same ranking/flag helper the breakline list uses — the resolved branch:
    const resolved = breaklineConflictFlag(rankBreaklineConflicts([conflict])[0]!, (id) => (id === 'a' ? 1 : 2), report.surface.origin);
    const text = instance.t(resolved.messageKey, resolved.messageParams);
    expect(text).toContain(ruleText);
    expect(text).toContain('2.00'); // (1.00 + 3.00) / 2
    expect(text).not.toMatch(/[{}]|select/);
  });
});
