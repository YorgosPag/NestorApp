/**
 * ADR-526 Φ6c — tests για τον καθαρισμό stair-generated πλακών (μπετόν σκαλοπατιών):
 * αφαίρεση τριγωνικών διπλότυπων + κατέβασμα ορθογώνιων στο ύψος καθίσματος.
 */

import { refineStairMeshPlanes } from '../tek-stair-plane-refine';
import type { TekPlaneRecord, TekStairRecord } from '../tek-import-types';

/** Σκάλα με footprint x∈[6.55,7.75], y∈[6.8,11.2]. */
const STAIR: TekStairRecord = {
  rawXml: '<record><type>21</type></record>',
  polylines: [[{ x: 6.55, y: 11.2 }, { x: 7.75, y: 6.8 }]],
  startElevationM: 0, endElevationM: 3, steps: 16, landings: 0,
  stairWidthM: 1.2, treadGoingM: 0.275, riserHeightM: 3 / 17,
  waistThicknessM: 0.15, walklineLengthM: 4.4, minStepWidthM: 0.07, stepsNumbering: true,
};

function quad(baseZ: number): TekPlaneRecord {
  return {
    vertices: [{ x: 6.6, y: 7.0 }, { x: 7.6, y: 7.0 }, { x: 7.6, y: 7.3 }, { x: 6.6, y: 7.3 }],
    widthM: 0, elevationM: 0, baseElevationM: baseZ, color: 'D0D0D0',
  };
}
function triangle(baseZ: number): TekPlaneRecord {
  return {
    vertices: [{ x: 6.6, y: 7.0 }, { x: 7.6, y: 7.0 }, { x: 7.6, y: 7.3 }],
    widthM: 0, elevationM: 0, baseElevationM: baseZ, color: 'D0D0D0',
  };
}

describe('refineStairMeshPlanes (ADR-526 Φ6c)', () => {
  it('αφαιρεί τριγωνικές + κατεβάζει ορθογώνιες στο ύψος καθίσματος (drop=πάχος)', () => {
    // Ορθογώνια @0.176, δύο τρίγωνα @0.026 → κάθισμα 0.026, drop 0.15.
    const out = refineStairMeshPlanes([quad(0.176), triangle(0.026), triangle(0.026)], [STAIR]);
    expect(out.filter((p) => p.vertices.length === 3)).toHaveLength(0); // τρίγωνα έφυγαν
    expect(out.filter((p) => p.vertices.length === 4)).toHaveLength(1);
    expect(out[0].baseElevationM).toBeCloseTo(0.026, 5); // κατέβηκε από 0.176 στο 0.026
  });

  it('πολλαπλά σκαλοπάτια: μία ορθογώνια ανά σκαλοπάτι στο κάθισμα', () => {
    const planes = [
      quad(0.176), triangle(0.026), triangle(0.026),
      quad(0.353), triangle(0.203), triangle(0.203),
    ];
    const out = refineStairMeshPlanes(planes, [STAIR]);
    const zs = out.map((p) => Math.round((p.baseElevationM ?? 0) * 1000)).sort((a, b) => a - b);
    expect(zs).toEqual([26, 203]);
  });

  it('κανονική πλάκα εκτός σκάλας (elev1 ορισμένο, μακριά) μένει ανέπαφη', () => {
    const outside: TekPlaneRecord = {
      vertices: [{ x: 100, y: 100 }, { x: 105, y: 100 }, { x: 105, y: 105 }, { x: 100, y: 105 }],
      widthM: 0.15, elevationM: 5, baseElevationM: 5, color: 'BC80FC',
    };
    const out = refineStairMeshPlanes([quad(0.176), triangle(0.026), triangle(0.026), outside], [STAIR]);
    expect(out).toContainEqual(outside); // αμετάβλητη
  });

  it('χωρίς σκάλες: όλες οι πλάκες αμετάβλητες', () => {
    const planes = [quad(0.176), triangle(0.026)];
    expect(refineStairMeshPlanes(planes, [])).toEqual(planes);
  });
});
