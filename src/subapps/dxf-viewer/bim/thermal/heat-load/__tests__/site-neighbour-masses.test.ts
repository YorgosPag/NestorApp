/**
 * ADR-422 L7.3 Slice E / ADR-369 — tests για τη σύνθεση μαζών γειτονικών κτιρίων
 * (pure). jest globals (describe/it/expect) — ΟΧΙ vitest import.
 */

import {
  buildHorizonObstacles,
  resolveBuildingTopElevationM,
  DEFAULT_STOREY_HEIGHT_M,
  type NeighbourBuildingInput,
} from '../site-neighbour-masses';
import type { BuildingPlacement } from '../site-placement-transform';

const ACTIVE: BuildingPlacement = { sceneToM: 1 };

/** Τετράγωνο footprint [0,2]×[0,2] (scene units). */
const SQUARE = [
  { x: 0, y: 0 },
  { x: 2, y: 0 },
  { x: 2, y: 2 },
  { x: 0, y: 2 },
];

describe('resolveBuildingTopElevationM', () => {
  it('baseElevation + floorCount · storeyHeight', () => {
    expect(resolveBuildingTopElevationM(5, 3, 3)).toBe(14); // 5 + 9
  });

  it('μη-θετικός όροφος → μόνο baseElevation', () => {
    expect(resolveBuildingTopElevationM(5, 0, 3)).toBe(5);
  });

  it('μη-θετικό storeyHeight → default', () => {
    expect(resolveBuildingTopElevationM(0, 2, 0)).toBe(2 * DEFAULT_STOREY_HEIGHT_M);
  });
});

describe('buildHorizonObstacles', () => {
  it('μεταφέρει το footprint στο ενεργό frame + υπολογίζει το ύψος κορυφής', () => {
    const neighbour: NeighbourBuildingInput = {
      footprintLocalXY: SQUARE,
      placement: { sceneToM: 1, siteOrigin: { x: 10, y: 5 } },
      baseElevationM: 0,
      floorCount: 4,
      storeyHeightM: 3,
    };
    const obstacles = buildHorizonObstacles([neighbour], ACTIVE);
    expect(obstacles).toHaveLength(1);
    expect(obstacles[0].topElevationM).toBe(12); // 0 + 4·3
    expect(obstacles[0].polygonXY[0]).toEqual({ x: 10, y: 5 }); // +siteOrigin
    expect(obstacles[0].polygonXY).toHaveLength(4);
  });

  it('παραλείπει degenerate footprint (<3 κορυφές)', () => {
    const bad: NeighbourBuildingInput = {
      footprintLocalXY: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      placement: ACTIVE,
      baseElevationM: 0,
      floorCount: 2,
      storeyHeightM: 3,
    };
    expect(buildHorizonObstacles([bad], ACTIVE)).toHaveLength(0);
  });

  it('παραλείπει κτίριο με floorCount ≤ 0', () => {
    const noFloors: NeighbourBuildingInput = {
      footprintLocalXY: SQUARE,
      placement: ACTIVE,
      baseElevationM: 0,
      floorCount: 0,
      storeyHeightM: 3,
    };
    expect(buildHorizonObstacles([noFloors], ACTIVE)).toHaveLength(0);
  });

  it('κενή λίστα → κανένα εμπόδιο (zero-regression)', () => {
    expect(buildHorizonObstacles([], ACTIVE)).toEqual([]);
  });
});
