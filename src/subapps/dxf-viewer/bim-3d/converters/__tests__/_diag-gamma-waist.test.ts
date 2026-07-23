/**
 * TEMP DIAGNOSTIC — read-only ground-truth dump for gamma (Γ) waist-slab footprint
 * vs 2D geometry footprint. NOT a real regression test. Always passes; the value is
 * the console.log output. Delete when the investigation is done.
 */

import * as THREE from 'three';
import { computeStairGeometry } from '../../../bim/geometry/stairs/StairGeometryService';
import { splitThreeFlightsWithLandings } from '../../../bim/stairs/stair-variant-defaults';
import { stairToMeshes } from '../StairToThreeConverter';
import type {
  StairEntity,
  StairParams,
  StairVariantGamma,
  Polygon3D,
} from '../../../bim/types/stair-types';

const RISE = 175;   // mm
const TREAD = 280;  // mm
const WIDTH = 1200; // mm (default factory width)

function centroidXY(poly: Polygon3D): { x: number; y: number } {
  let sx = 0;
  let sy = 0;
  for (const p of poly) { sx += p.x; sy += p.y; }
  return { x: sx / poly.length, y: sy / poly.length };
}

function xyBounds(poly: Polygon3D): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of poly) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  return { minX, maxX, minY, maxY };
}

describe('DIAG — gamma waist vs 2D footprint', () => {
  it('prints ground-truth numbers (always passes)', () => {
    // ── Build gamma params, mirroring the real factory idiom ─────────────────
    const stepCount = 17;
    const flightSplit = splitThreeFlightsWithLandings(stepCount); // real factory helper
    const actualStepCount = flightSplit[0] + flightSplit[1] + flightSplit[2];
    console.log('flightSplit from splitThreeFlightsWithLandings(17):', flightSplit,
      '-> actual stepCount (sum) =', actualStepCount);

    const variant: StairVariantGamma = {
      kind: 'gamma',
      turnSequence: ['right', 'right'] as const,
      landings: ['auto', 'auto'] as const,
      flightSplit,
    };

    const params: StairParams = {
      basePoint: { x: 0, y: 0, z: 0 },
      direction: 90,
      rise: RISE,
      tread: TREAD,
      nosing: 20,
      nosingSide: 'front',
      width: WIDTH,
      stepCount: actualStepCount,
      totalRise: RISE * (actualStepCount + 1),
      totalRun: TREAD * actualStepCount,
      pitch: Math.atan2(RISE, TREAD) * (180 / Math.PI),
      structureType: 'monolithic', // Συμπαγής -> waist active
      riserType: 'closed',
      antiskidNosing: false,
      adaContrastStrip: false,
      variant,
      walklineOffset: 300,
      handrails: { inner: true, outer: true, height: 900 },
      upDirection: 'forward',
      treadNumberStart: 1,
      treadLabelDisplay: 'none',
      treadLabelRestartPerFlight: false,
      codeProfile: 'nok',
    };

    const geometry = computeStairGeometry(params);

    const stair: StairEntity = {
      id: 'diag-gamma-stair',
      type: 'stair',
      layerId: '',
      kind: 'gamma',
      params,
      geometry,
      validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: 0 as unknown as never },
      levelId: 'diag-level',
      visible: true,
    } as unknown as StairEntity;

    // ── 2D geometry dump ──────────────────────────────────────────────────────
    const allTreads = [...geometry.treadsBelowCut, ...geometry.treadsAboveCut];
    console.log('\n=== 2D GEOMETRY ===');
    console.log('treads.length (below+above) =', allTreads.length);
    allTreads.forEach((t, i) => {
      const c = centroidXY(t);
      const z = t[0]!.z;
      console.log(`  tread[${i}] z=${z.toFixed(1)} centroid=(${c.x.toFixed(1)}, ${c.y.toFixed(1)})`);
    });

    console.log('landings.length =', geometry.landings.length);
    geometry.landings.forEach((l, i) => {
      const b = xyBounds(l);
      const z = l[0]!.z;
      console.log(`  landing[${i}] z=${z.toFixed(1)} xy-bounds=(x:${b.minX.toFixed(1)}..${b.maxX.toFixed(1)}, y:${b.minY.toFixed(1)}..${b.maxY.toFixed(1)})`);
    });

    let tMinX = Infinity, tMaxX = -Infinity, tMinY = Infinity, tMaxY = -Infinity;
    for (const t of allTreads) {
      const b = xyBounds(t);
      tMinX = Math.min(tMinX, b.minX); tMaxX = Math.max(tMaxX, b.maxX);
      tMinY = Math.min(tMinY, b.minY); tMaxY = Math.max(tMaxY, b.maxY);
    }
    console.log(`Overall treads xy bbox: x:${tMinX.toFixed(1)}..${tMaxX.toFixed(1)} y:${tMinY.toFixed(1)}..${tMaxY.toFixed(1)}`);
    console.log(`  width(x)=${(tMaxX - tMinX).toFixed(1)} depth(y)=${(tMaxY - tMinY).toFixed(1)}`);

    // ── 3D meshes dump ────────────────────────────────────────────────────────
    const meshes = stairToMeshes(stair, 0, undefined, 0);
    console.log('\n=== 3D MESHES ===');
    console.log('total meshes =', meshes.length);

    interface MeshDump {
      component: string;
      idx: number | undefined;
      box: THREE.Box3;
    }
    const dumps: MeshDump[] = meshes.map((m) => {
      const box = new THREE.Box3().setFromObject(m);
      return {
        component: String(m.userData['stairComponent']),
        idx: m.userData['stairComponentIndex'] as number | undefined,
        box,
      };
    });

    dumps.forEach((d, i) => {
      const b = d.box;
      console.log(
        `  mesh[${i}] component=${d.component} idx=${d.idx ?? '-'} ` +
        `worldX:${b.min.x.toFixed(3)}..${b.max.x.toFixed(3)} ` +
        `worldY(height):${b.min.y.toFixed(3)}..${b.max.y.toFixed(3)} ` +
        `worldZ:${b.min.z.toFixed(3)}..${b.max.z.toFixed(3)}`,
      );
    });

    // ── Isolate waist meshes ─────────────────────────────────────────────────
    const waistDumps = dumps.filter((d) => d.component === 'waist');
    console.log('\n=== WAIST MESHES ONLY ===');
    console.log('waist mesh count =', waistDumps.length, '(expect 3 for a 3-flight gamma)');
    waistDumps.forEach((d, i) => {
      const b = d.box;
      // world x = DXF x ; world z = -DXF y  -> plan footprint = (worldX, worldZ)
      console.log(
        `  waist[${i}] idx=${d.idx ?? '-'} planFootprint worldX:${b.min.x.toFixed(3)}..${b.max.x.toFixed(3)} ` +
        `worldZ(-DXFy):${b.min.z.toFixed(3)}..${b.max.z.toFixed(3)} ` +
        `worldY(height):${b.min.y.toFixed(3)}..${b.max.y.toFixed(3)}`,
      );
    });

    // ── Tread meshes combined footprint (for comparison) ────────────────────
    const treadDumps = dumps.filter((d) => d.component === 'tread');
    let mMinX = Infinity, mMaxX = -Infinity, mMinZ = Infinity, mMaxZ = -Infinity;
    for (const d of treadDumps) {
      mMinX = Math.min(mMinX, d.box.min.x); mMaxX = Math.max(mMaxX, d.box.max.x);
      mMinZ = Math.min(mMinZ, d.box.min.z); mMaxZ = Math.max(mMaxZ, d.box.max.z);
    }
    console.log('\n=== TREAD MESHES COMBINED FOOTPRINT ===');
    console.log('tread mesh count =', treadDumps.length);
    console.log(`combined planFootprint worldX:${mMinX.toFixed(3)}..${mMaxX.toFixed(3)} worldZ(-DXFy):${mMinZ.toFixed(3)}..${mMaxZ.toFixed(3)}`);

    // Convert 2D tread bbox (mm, DXF-local) to meters world-frame for direct comparison:
    // world x = DXFx/1000, world z = -DXFy/1000
    console.log('\n=== FOR COMPARISON: 2D treads bbox converted to world-frame (m) ===');
    console.log(`worldX: ${(tMinX / 1000).toFixed(3)}..${(tMaxX / 1000).toFixed(3)} worldZ(-DXFy/1000): ${(-tMaxY / 1000).toFixed(3)}..${(-tMinY / 1000).toFixed(3)}`);

    expect(true).toBe(true);
  });
});
