/**
 * ADR-920 Β4.8 — the LINES of the 2D terrain map: contours (minor / index) and the labels of the index contours.
 *
 * Cartographic practice (USGS US Topo · Civil 3D): every N-th contour is an INDEX contour, drawn heavier and labelled;
 * the intermediate ones are not labelled. A label sits ON its line, along the straightest stretch long enough to hold
 * it, and always reads upright (`normalizeTextAngle`, the CAD rule). The line is not cut: the view draws the label with
 * a halo (`paint-order: stroke`), which opens the gap visually and survives any zoom and the PDF.
 *
 * Labels never collide: a label whose box would overlap an accepted one is dropped (first come, in snapshot order —
 * deterministic). Fewer labels beat a label nobody can read.
 *
 * @module lib/terrain/publication/terrain-map-contours
 */

import { normalizeAngleDiff, normalizeTextAngle, RADIANS_TO_DEGREES } from '@/lib/geometry/angle';
import { LISTING_TERRAIN_MAP_DIGIT_EM } from './listing-terrain-config';
import { roundPublished } from './listing-terrain-frame';
import type { ListingTerrainContour } from './listing-terrain-types';
import { flatSvgPoints, joinPathData, polylinePathData, type SvgPoint } from './terrain-map-svg';

/** One index-contour label, in SVG user space. */
export interface TerrainMapContourLabel {
  /** Centre of the label, on the line. */
  readonly x: number;
  readonly y: number;
  /** SVG rotation, degrees clockwise — always upright (|angle| ≤ 90°). */
  readonly angleDeg: number;
  /** The elevation to print, absolute metres (the view formats it for the locale). */
  readonly levelM: number;
}

/** All minor (`major = false`) or all index (`major = true`) contours as ONE path data string. */
export function contourPathData(contours: readonly ListingTerrainContour[], major: boolean): string {
  return joinPathData(
    contours.filter((c) => c.major === major).map((c) => polylinePathData(flatSvgPoints(c.points), c.closed)),
  );
}

/** The length a label needs along its line: its characters plus one character of clear space, metres. */
export function labelLengthM(levelM: number, heightM: number): number {
  return (String(levelM).length + 1) * LISTING_TERRAIN_MAP_DIGIT_EM * heightM;
}

/** Cumulative arc length at every vertex. */
function cumulativeLengths(points: readonly SvgPoint[]): number[] {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  return cum;
}

/** Prefix sums of the absolute turn at every vertex (the end vertices do not turn). */
function turnPrefix(points: readonly SvgPoint[]): number[] {
  const prefix = [0];
  for (let m = 1; m < points.length; m++) {
    let turn = 0;
    if (m < points.length - 1) {
      const a = Math.atan2(points[m].y - points[m - 1].y, points[m].x - points[m - 1].x);
      const b = Math.atan2(points[m + 1].y - points[m].y, points[m + 1].x - points[m].x);
      turn = Math.abs(normalizeAngleDiff(b - a));
    }
    prefix.push(prefix[m - 1] + turn);
  }
  return prefix;
}

/** The window `[i, j]` at least `need` long that turns least (two pointers, O(n)); `null` if the line is too short. */
function straightestWindow(cum: readonly number[], turns: readonly number[], need: number): readonly [number, number] | null {
  let best: readonly [number, number] | null = null;
  let bestCost = Infinity;
  let j = 1;
  for (let i = 0; i < cum.length - 1; i++) {
    if (j <= i) j = i + 1;
    while (j < cum.length - 1 && cum[j] - cum[i] < need) j++;
    if (cum[j] - cum[i] < need) break;
    const cost = turns[j - 1] - turns[i];
    if (cost < bestCost) { bestCost = cost; best = [i, j]; }
  }
  return best;
}

/** The point at arc length `s` along the polyline. */
function pointAtLength(points: readonly SvgPoint[], cum: readonly number[], s: number): SvgPoint {
  let k = 1;
  while (k < cum.length - 1 && cum[k] < s) k++;
  const span = cum[k] - cum[k - 1];
  const t = span > 0 ? (s - cum[k - 1]) / span : 0;
  return { x: points[k - 1].x + t * (points[k].x - points[k - 1].x), y: points[k - 1].y + t * (points[k].y - points[k - 1].y) };
}

/** The label of ONE index contour, or `null` when no stretch of it is long enough. */
function labelOf(contour: ListingTerrainContour, heightM: number): TerrainMapContourLabel | null {
  const points = flatSvgPoints(contour.points);
  if (points.length < 2) return null;
  const cum = cumulativeLengths(points);
  const window = straightestWindow(cum, turnPrefix(points), labelLengthM(contour.levelM, heightM));
  if (window === null) return null;
  const [i, j] = window;
  const centre = pointAtLength(points, cum, (cum[i] + cum[j]) / 2);
  const angle = normalizeTextAngle(Math.atan2(points[j].y - points[i].y, points[j].x - points[i].x));
  return {
    x: roundPublished(centre.x),
    y: roundPublished(centre.y),
    angleDeg: Math.round(normalizeAngleDiff(angle) * RADIANS_TO_DEGREES * 10) / 10,
    levelM: contour.levelM,
  };
}

/** Labels of the index contours, without collisions. */
export function contourLabelsOf(contours: readonly ListingTerrainContour[], heightM: number): TerrainMapContourLabel[] {
  const accepted: TerrainMapContourLabel[] = [];
  for (const contour of contours) {
    if (!contour.major) continue;
    const label = labelOf(contour, heightM);
    if (label === null) continue;
    const reach = labelLengthM(label.levelM, heightM);
    const collides = accepted.some(
      (other) => Math.hypot(other.x - label.x, other.y - label.y) < (reach + labelLengthM(other.levelM, heightM)) / 2,
    );
    if (!collides) accepted.push(label);
  }
  return accepted;
}
