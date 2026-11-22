/**
 * ADR-920 §14.10 Ε3 — **what the profile chart draws**, as numbers and path data. Pure (no DOM, no React).
 *
 * 🔑 **Fixed aspect, declared exaggeration**: the chart is a `WIDTH × HEIGHT` box drawn with `xMidYMid meet`, so its
 *   shape never changes with the screen — and the vertical exaggeration it uses is a NUMBER we can say out loud
 *   («vertical scale 6× the horizontal»), like the 3D badge. A profile that silently stretches a gentle slope into a cliff
 *   is the oldest lie of elevation charts; CalTopo / ArcGIS do not state it.
 * 🔑 **Gaps stay gaps**: the ground is drawn per on-surface run; off-surface stretches are empty.
 * 🔑 **The slope strip** under the profile colours each piece by its slope class — the SAME classes as the map
 *   (`classifySlope` on the snapshot's bands): what is steep on the map is steep on the profile.
 *
 * @module lib/terrain/inspect/terrain-profile-chart
 */

import { classifySlope } from '@/lib/terrain/publication/terrain-slope';

import type { TerrainProfile } from './terrain-profile';

export const PROFILE_CHART_WIDTH = 600;
export const PROFILE_CHART_HEIGHT = 180;
/** The ground occupies the top; the slope strip sits under it. */
const GROUND_HEIGHT = 156;
const STRIP_TOP = 164;
export const PROFILE_CHART_STRIP_HEIGHT = 12;
/** Head-room above and below the relief, as a share of it — and never less than this many metres. */
const PAD_FRACTION = 0.1;
const MIN_PAD_M = 0.25;

interface ProfileChartStripPiece {
  readonly x: number;
  readonly width: number;
  readonly classIndex: number;
}

export interface ProfileChartModel {
  /** Elevation at the bottom / top of the ground box, metres. */
  readonly zBottomM: number;
  readonly zTopM: number;
  /** Filled area under each on-surface run. */
  readonly areaPaths: readonly string[];
  /** The ground line, split where «interpolated» changes. */
  readonly linePaths: readonly { readonly d: string; readonly sparse: boolean }[];
  readonly strip: readonly ProfileChartStripPiece[];
  readonly stripTop: number;
  /** Vertical scale ÷ horizontal scale of THIS drawing (1 = true shape). */
  readonly verticalRatio: number;
}

const round = (v: number): number => Math.round(v * 100) / 100;

/** Distance along the line → chart x. */
export function profileChartX(profile: TerrainProfile, s: number): number {
  return round((s / profile.lengthM) * PROFILE_CHART_WIDTH);
}

/** Elevation → chart y (SVG y down). */
export function profileChartY(model: Pick<ProfileChartModel, 'zBottomM' | 'zTopM'>, z: number): number {
  return round(GROUND_HEIGHT - ((z - model.zBottomM) / (model.zTopM - model.zBottomM)) * GROUND_HEIGHT);
}

/** Chart x → distance along the line, clamped. */
export function profileChartS(profile: TerrainProfile, x: number): number {
  return Math.min(profile.lengthM, Math.max(0, (x / PROFILE_CHART_WIDTH) * profile.lengthM));
}

function verticalRangeOf(profile: TerrainProfile): { zBottomM: number; zTopM: number } {
  const min = profile.minM ?? 0;
  const max = profile.maxM ?? min;
  const pad = Math.max((max - min) * PAD_FRACTION, MIN_PAD_M);
  return { zBottomM: min - pad, zTopM: max + pad };
}

/** On-surface runs as lists of station indices. */
function runsOf(profile: TerrainProfile): number[][] {
  const runs: number[][] = [];
  let run: number[] = [];
  profile.pieces.forEach((piece, i) => {
    if (piece.onSurface) {
      if (run.length === 0) run.push(i);
      run.push(i + 1);
    } else if (run.length > 0) { runs.push(run); run = []; }
  });
  if (run.length > 0) runs.push(run);
  return runs;
}

function pointOf(profile: TerrainProfile, range: { zBottomM: number; zTopM: number }, i: number): string {
  const st = profile.stations[i];
  return `${profileChartX(profile, st.s)} ${profileChartY(range, st.z ?? range.zBottomM)}`;
}

function areaPathOf(profile: TerrainProfile, range: { zBottomM: number; zTopM: number }, run: readonly number[]): string {
  const first = profile.stations[run[0]];
  const last = profile.stations[run[run.length - 1]];
  const top = run.map((i) => pointOf(profile, range, i)).join(' L');
  return `M${profileChartX(profile, first.s)} ${GROUND_HEIGHT} L${top} L${profileChartX(profile, last.s)} ${GROUND_HEIGHT} Z`;
}

/** The ground line of a run, cut where the «interpolated» flag changes. */
function linePathsOf(profile: TerrainProfile, range: { zBottomM: number; zTopM: number }, run: readonly number[]) {
  const out: { d: string; sparse: boolean }[] = [];
  for (let k = 0; k + 1 < run.length; k++) {
    const sparse = profile.pieces[run[k]].sparse;
    const segment = `L${pointOf(profile, range, run[k + 1])}`;
    const last = out[out.length - 1];
    if (last && last.sparse === sparse && k > 0) last.d += ` ${segment}`;
    else out.push({ d: `M${pointOf(profile, range, run[k])} ${segment}`, sparse });
  }
  return out;
}

export function profileChartModelOf(profile: TerrainProfile, bandsPct: readonly number[]): ProfileChartModel {
  const range = verticalRangeOf(profile);
  const runs = runsOf(profile);
  const strip = profile.pieces.filter((piece) => piece.onSurface).map((piece) => ({
    x: profileChartX(profile, piece.fromS),
    width: round(((piece.toS - piece.fromS) / profile.lengthM) * PROFILE_CHART_WIDTH),
    classIndex: classifySlope(Math.abs(piece.gradePct), bandsPct),
  }));
  const vertical = GROUND_HEIGHT / (range.zTopM - range.zBottomM);
  const horizontal = PROFILE_CHART_WIDTH / profile.lengthM;
  return {
    ...range,
    areaPaths: runs.map((run) => areaPathOf(profile, range, run)),
    linePaths: runs.flatMap((run) => linePathsOf(profile, range, run)),
    strip,
    stripTop: STRIP_TOP,
    verticalRatio: vertical / horizontal,
  };
}
