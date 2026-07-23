/**
 * Waist slab (μηρός) — the monolithic concrete body under the steps (Revit "Monolithic
 * Stair"). Because the treads/risers are thin FINISH shells (40/20 mm), a flat sloped
 * slab through the re-entrant corners would poke above the tread surfaces between corners
 * and cut the risers (Giorgio 2026-07-21). So the waist is a STEPPED prism: top = the
 * step profile, bottom = a sloped soffit `waist` perpendicular below the re-entrant line.
 *
 * Verifies: (a) monolithic/cantilever emit one extruded prism per flight; open/stringer
 * none; (b) a LANDING (z-gap) splits into two prisms; (c) the section top never rises
 * above the re-entrant line (tread tops) → zero intersection with the finishes; (d) the
 * soffit sits exactly `waist` PERPENDICULAR below; (e) pure `flightSectionPoints` shape.
 *
 * @see ../stair-waist-slabs.ts · ../StairToThreeConverter.ts
 */

import * as THREE from 'three';
import { buildWaistSlabMeshes, flightSectionPoints } from '../stair-waist-slabs';
import { stairToMeshes } from '../StairToThreeConverter';
import { inferSceneUnitsFromWidth, sceneUnitsToMeters } from '../../../utils/scene-units';
import type { StairEntity, StairStructureType, Point3D } from '../../../bim/types/stair-types';

const P = (x: number, y: number, z: number): Point3D => ({ x, y, z });
const WIDTH = 900;
const RISE = 175;
const TREAD = 270;
const NOSING = 30;
const WAIST_MM = 160;
const STEP_COUNT = 3;
const PITCH = RISE / TREAD; // tanθ of the re-entrant line

/** One tread quad: back edge `[0]→[3]` at `(along, 0..WIDTH, z)`, front `[1],[2]` a depth ahead. */
function mkTread(along: number, z: number): Point3D[] {
  const depth = TREAD + NOSING;
  return [P(along, 0, z), P(along + depth, 0, z), P(along + depth, WIDTH, z), P(along, WIDTH, z)];
}

/** Straight monolithic run ascending +X: 3 treads, re-entrant corners at z = 0/175/350. */
function makeStraightMonolithic(structureType: StairStructureType = 'monolithic'): StairEntity {
  const treads = [mkTread(0, 0), mkTread(TREAD, RISE), mkTread(2 * TREAD, 2 * RISE)];
  return {
    id: 'stair_waist', type: 'stair',
    params: {
      basePoint: P(0, 0, 0), direction: 0, rise: RISE, tread: TREAD, nosing: NOSING, width: WIDTH,
      stepCount: STEP_COUNT, riserType: 'closed', structureType, waistThickness: WAIST_MM,
      handrails: { inner: false, outer: false, height: 900 },
    },
    geometry: {
      treads, treadsBelowCut: treads, treadsAboveCut: [], risers: [],
      stringers: { inner: [], outer: [] }, walkline: [], handrails: {}, landings: [],
      arrowSymbol: { start: P(0, 450, 0), end: P(500, 450, 0), label: 'UP' },
      bbox: { min: P(0, 0, 0), max: P(810, WIDTH, 2 * RISE) },
    },
  } as unknown as StairEntity;
}

/** Two flights split by a landing: z-gap of 2·rise between the runs → two prisms. */
function makeWithLanding(): StairEntity {
  const s = makeStraightMonolithic();
  const treads = [mkTread(0, 0), mkTread(TREAD, RISE), mkTread(0, 3 * RISE), mkTread(TREAD, 4 * RISE)];
  return {
    ...s,
    params: { ...s.params, stepCount: 4 },
    geometry: { ...s.geometry, treads, treadsBelowCut: treads, treadsAboveCut: [] },
  } as unknown as StairEntity;
}

/** makeWithLanding + a real landing footprint polygon @ z = 2·RISE (between the two runs)
 *  — the "flying landing" case: the thin landing needs a waist pad underneath it. */
function makeWithLandingPoly(): StairEntity {
  const s = makeWithLanding();
  const zL = 2 * RISE; // landing top: one rise above flight1 (z=175), one below flight2 (z=525)
  const landing = [P(0, 0, zL), P(TREAD, 0, zL), P(TREAD, WIDTH, zL), P(0, WIDTH, zL)];
  return { ...s, geometry: { ...s.geometry, landings: [landing] } } as unknown as StairEntity;
}

describe('stair-waist-slabs (μηρός)', () => {
  const sceneToM = sceneUnitsToMeters(inferSceneUnitsFromWidth(WIDTH));

  it('monolithic → one extruded prism for the flight', () => {
    const meshes = buildWaistSlabMeshes(makeStraightMonolithic(), 0, sceneToM);
    expect(meshes).toHaveLength(1);
    expect(meshes[0]!.geometry.type).toBe('ExtrudeGeometry');
  });

  it('cantilever also emits a solid body', () => {
    expect(buildWaistSlabMeshes(makeStraightMonolithic('cantilever'), 0, sceneToM)).toHaveLength(1);
  });

  it('open / stringer / glass / grating structures emit NO waist (open underneath)', () => {
    for (const t of ['stringer-1side', 'stringer-2side', 'central-stringer', 'suspended', 'glass-tread', 'steel-grating'] as const) {
      expect(buildWaistSlabMeshes(makeStraightMonolithic(t), 0, sceneToM)).toHaveLength(0);
    }
  });

  it('a LANDING (z-gap between runs) splits into two prisms', () => {
    expect(buildWaistSlabMeshes(makeWithLanding(), 0, sceneToM)).toHaveLength(2);
  });

  // ADR-358 — the top flight's waist must reach the FLOOR (one rise above the top tread).
  // Regression: `topFloorZ = baseZ + stepCount·rise` ignored the rise each turn landing
  // adds, so on a landing kind the top flight got `topSteps=0` and the waist stopped one
  // tread short of the floor (a visible undercut, gamma-obvious with its two landings).
  it('multi-landing: top flight waist reaches the top floor, not one tread short', () => {
    const meshes = buildWaistSlabMeshes(makeWithLanding(), 0, sceneToM);
    const maxY = Math.max(...meshes.map((m) => {
      m.geometry.computeBoundingBox();
      return m.geometry.boundingBox!.max.y;
    }));
    // treads at z = 0/175/525/700 → top tread = 4·rise; the floor sits one rise above it.
    expect(maxY).toBeCloseTo(5 * RISE * sceneToM, 5);
    expect(maxY).toBeGreaterThan(4 * RISE * sceneToM + 1e-6); // pre-fix stopped here
  });

  it('the solid NEVER rises above the re-entrant line (no intersection with the thin treads/risers)', () => {
    const mesh = buildWaistSlabMeshes(makeStraightMonolithic(), 0, sceneToM)[0]!;
    const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    // Section-x → world-x, section-y → world-y (uh = +X, origin at the floor corner), so
    // every vertex must sit on/below the re-entrant line y = pitch·x (the tread tops).
    for (let i = 0; i < pos.count; i++) {
      expect(pos.getY(i)).toBeLessThanOrEqual(PITCH * pos.getX(i) + 1e-6);
    }
  });

  it('soffit sits `waist` PERPENDICULAR below the NOSING line (min concrete = waist)', () => {
    const mesh = buildWaistSlabMeshes(makeStraightMonolithic(), 0, sceneToM)[0]!;
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox!;
    const waistM = WAIST_MM * 0.001;
    const cosT = TREAD / Math.hypot(TREAD, RISE);
    // Deepest point = soffit under the base corner: one rise below it (nosing line) + waist/cosθ.
    expect(box.min.y).toBeCloseTo(-(RISE * sceneToM + waistM / cosT), 5);
    // Top reaches the landing-edge corner (one step past the last tread), no overhang.
    expect(box.max.y).toBeCloseTo(RISE * STEP_COUNT * sceneToM, 5);
  });

  it('flightSectionPoints: stepped top on re-entrant line, soffit BELOW the nosing line (valid solid)', () => {
    const cosT = TREAD / Math.hypot(TREAD, RISE);
    const vShift = WAIST_MM / cosT;          // perpendicular waist → vertical component
    const drop = RISE + vShift;              // soffit below the re-entrant corners
    const pts = flightSectionPoints(3, TREAD, RISE, drop);
    expect(pts).toHaveLength(2 + 7);         // 2 soffit + (2·M+1) staircase
    // Every vertex on/below the re-entrant line y = pitch·x (tread tops touch, never exceed).
    for (const p of pts) expect(p.y).toBeLessThanOrEqual(PITCH * p.x + 1e-9);
    // Soffit vertices sit strictly BELOW the nosing line y = pitch·x − rise → no self-intersection.
    const soffit = [pts[0]!, pts[1]!];
    for (const p of soffit) expect(p.y).toBeLessThan(PITCH * p.x - RISE + 1e-9);
    // Re-entrant corners present exactly.
    const has = (x: number, y: number) => pts.some((p) => Math.abs(p.x - x) < 1e-9 && Math.abs(p.y - y) < 1e-9);
    expect(has(0, 0) && has(TREAD, RISE) && has(3 * TREAD, 3 * RISE)).toBe(true);
  });

  it('integrates: stairToMeshes tags waist meshes with component "waist"', () => {
    const waist = stairToMeshes(makeStraightMonolithic()).filter(
      (m) => m.userData['stairComponent'] === 'waist',
    );
    expect(waist).toHaveLength(1);
    expect(waist[0]!.userData['bimId']).toBe('stair_waist');
  });

  // ── ADR-685 Φ2 — terminating trim (η σκάλα πατά στην πλάκα, δεν κρέμεται από κάτω) ──
  describe('terminating soffit trim (Revit "Join Geometry" parity)', () => {
    const cosT = TREAD / Math.hypot(TREAD, RISE);
    const naturalDrop = RISE + WAIST_MM / cosT; // vertical drop below the base re-entrant corner

    it('flightSectionPoints: no floor → unchanged 2-point soffit (byte-for-byte)', () => {
      expect(flightSectionPoints(3, TREAD, RISE, naturalDrop)).toHaveLength(2 + 7);
    });

    it('flightSectionPoints: a floor above the natural soffit → flat base + resumed slope', () => {
      const floorY = -naturalDrop / 2; // between base soffit (−drop) and 0
      const pts = flightSectionPoints(3, TREAD, RISE, naturalDrop, floorY);
      // 3 soffit points (flat base (0,floor)→(aCross,floor) then top) + staircase (2·M+1).
      expect(pts).toHaveLength(3 + 7);
      expect(pts[0]!.x).toBeCloseTo(0, 9);
      expect(pts[0]!.y).toBeCloseTo(floorY, 9);
      expect(pts[1]!.y).toBeCloseTo(floorY, 9); // flat base at the floor level
      const aCross = ((floorY + naturalDrop) * TREAD) / RISE;
      expect(pts[1]!.x).toBeCloseTo(aCross, 6);
      // The resumed vertex lies exactly on the original soffit line (no self-cut).
      expect(pts[2]!.y).toBeCloseTo(-naturalDrop + (RISE / TREAD) * pts[2]!.x, 6);
      // Nothing dips below the floor.
      for (const p of pts) expect(p.y).toBeGreaterThanOrEqual(floorY - 1e-6);
    });

    it('flightSectionPoints: a floor at/below the natural soffit → no trim', () => {
      expect(flightSectionPoints(3, TREAD, RISE, naturalDrop, -naturalDrop)).toHaveLength(2 + 7);
      expect(flightSectionPoints(3, TREAD, RISE, naturalDrop, -naturalDrop - 100)).toHaveLength(2 + 7);
    });

    it('buildWaistSlabMeshes: clip raises the base soffit to the slab underside (no hang)', () => {
      const naturalMinY = -(RISE * sceneToM + WAIST_MM * 0.001 / cosT);
      const clipWorldY = naturalMinY / 2; // seat slab underside, above the natural soffit
      const mesh = buildWaistSlabMeshes(makeStraightMonolithic(), 0, sceneToM, clipWorldY)[0]!;
      mesh.geometry.computeBoundingBox();
      // The deepest point is now the trimmed flat base at the clip, not the natural soffit.
      expect(mesh.geometry.boundingBox!.min.y).toBeCloseTo(clipWorldY, 6);
      expect(mesh.geometry.boundingBox!.min.y).toBeGreaterThan(naturalMinY + 1e-6);
    });

    it('buildWaistSlabMeshes: clip below the natural soffit is a no-op', () => {
      const naturalMinY = -(RISE * sceneToM + WAIST_MM * 0.001 / cosT);
      const clipped = buildWaistSlabMeshes(makeStraightMonolithic(), 0, sceneToM, naturalMinY - 1)[0]!;
      clipped.geometry.computeBoundingBox();
      expect(clipped.geometry.boundingBox!.min.y).toBeCloseTo(naturalMinY, 5);
    });

    const treads = (meshes: readonly THREE.Mesh[]) =>
      meshes.filter((m) => m.userData['stairComponent'] === 'tread');
    const lowestTreadY = (meshes: readonly THREE.Mesh[]) =>
      Math.min(...treads(meshes).map((m) => {
        m.geometry.computeBoundingBox();
        return m.geometry.boundingBox!.min.y + m.position.y;
      }));

    it('seated on base slab → the STARTING (base) tread is skipped (floor tiles cover it)', () => {
      const stair = makeStraightMonolithic();
      const noSeat = stairToMeshes(stair); // no base slab → every tread kept
      const seated = stairToMeshes(stair, 0, undefined, 0, -285); // slab underside defined → seat
      expect(treads(seated)).toHaveLength(treads(noSeat).length - 1);
      // The one removed is the lowest step; the remaining base rises by one rise.
      expect(lowestTreadY(seated)).toBeGreaterThan(lowestTreadY(noSeat) + 1e-6);
    });

    it('NOT seated (pass-through / no slab) → every tread kept (riser untouched either way)', () => {
      const stair = makeStraightMonolithic();
      expect(treads(stairToMeshes(stair))).toHaveLength(3);
      expect(stairToMeshes(stair, 0, undefined, 0, -285).filter(
        (m) => m.userData['stairComponent'] === 'riser',
      ).length).toBe(stairToMeshes(stair).filter(
        (m) => m.userData['stairComponent'] === 'riser',
      ).length);
    });
  });

  // ── ADR-358 (2026-07-23) — ο μηρός τερματίζει FLUSH στην κάτω παρειά του πλατισκάλου
  //    (Revit "waist spans across landings"): δεν "πετάει" το πλατύσκαλο, δεν βυθίζεται ο κλάδος. ──
  describe('upper flight bears flat on the landing underside (no flying, no sinking)', () => {
    const landingThk = WAIST_MM * 0.001;      // "Same as Run" (no landingThickness override)
    const landingTop = 2 * RISE * sceneToM;    // one rise below flight-2's first tread (525 → 350)
    const underside = landingTop - landingThk; // 0.190 m — the thin landing's bottom face

    const waistByIndex = (stair: StairEntity, idx: number) =>
      stairToMeshes(stair).find(
        (m) => m.userData['stairComponent'] === 'waist' && m.userData['stairComponentIndex'] === idx,
      ) as THREE.Mesh;
    const worldMinY = (mesh: THREE.Mesh) => {
      mesh.geometry.computeBoundingBox();
      return mesh.geometry.boundingBox!.min.y + mesh.position.y;
    };

    it('the upper flight soffit meets the landing underside — not the deep natural soffit', () => {
      // Clamped FLAT at the landing underside, NOT hanging a full soffitDrop below (≈ −0.06 m,
      // which was the flight "sinking through" the thin landing).
      expect(worldMinY(waistByIndex(makeWithLandingPoly(), 1))).toBeCloseTo(underside, 5);
    });

    it('no separate pad body is emitted — only the thin landing itself sits over the flight', () => {
      const comps = stairToMeshes(makeWithLandingPoly()).map((m) => m.userData['stairComponent']);
      expect(comps).not.toContain('landing-waist');
      expect(comps.filter((c) => c === 'landing')).toHaveLength(1);
    });

    it('the thin landing seats flush on the flight (landing underside === clamped soffit)', () => {
      const landing = stairToMeshes(makeWithLandingPoly()).find(
        (m) => m.userData['stairComponent'] === 'landing',
      )! as THREE.Mesh;
      expect(worldMinY(landing)).toBeCloseTo(underside, 5);
      expect(worldMinY(waistByIndex(makeWithLandingPoly(), 1))).toBeCloseTo(underside, 5);
    });

    it('the BASE flight base soffit still reaches the floor deep soffit (not raised by the landing above)', () => {
      // gi 0 dives to its natural base soffit (≈ −0.41 m) at the FLOOR end, far below the landing.
      expect(worldMinY(waistByIndex(makeWithLandingPoly(), 0))).toBeLessThan(underside - 0.1);
    });

    it('the LOWER flight is PROLONGED under the landing until its soffit meets the underside', () => {
      // The lower flight's TOP meets the landing above it → its μηρός extends under the landing
      // with a cap AT the landing underside (0.190 m). No other vertex of that flight sits there.
      const flight1 = waistByIndex(makeWithLandingPoly(), 0);
      const pos = flight1.geometry.getAttribute('position') as THREE.BufferAttribute;
      let meetsUnderside = false;
      for (let i = 0; i < pos.count; i++) {
        if (Math.abs(pos.getY(i) + flight1.position.y - underside) < 1e-4) { meetsUnderside = true; break; }
      }
      expect(meetsUnderside).toBe(true);
    });

    it('flightSectionPoints: TOP landing extension prolongs the soffit to meet the underside', () => {
      const M = 2, span = M * TREAD;
      const drop = RISE + WAIST_MM / (TREAD / Math.hypot(TREAD, RISE)); // rise + waist/cosθ
      const topSoffitY = M * RISE - drop;
      const underY = topSoffitY + 120;                    // above the natural top soffit → extend
      const aMeet = span + ((underY - topSoffitY) * TREAD) / RISE;
      const pts = flightSectionPoints(M, TREAD, RISE, drop, undefined, underY);
      const has = (x: number, y: number) => pts.some((p) => Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - y) < 1e-6);
      expect(has(aMeet, underY)).toBe(true);              // soffit meets the underside, past the edge
      expect(has(span, underY)).toBe(true);               // flat cap back to the flight edge
      expect(aMeet).toBeGreaterThan(span);                // prolonged BEYOND the flight
    });

    it('flightSectionPoints: no extension when the landing underside is at/below the top soffit', () => {
      const M = 2;
      const drop = RISE + WAIST_MM / (TREAD / Math.hypot(TREAD, RISE));
      const topSoffitY = M * RISE - drop;
      expect(flightSectionPoints(M, TREAD, RISE, drop, undefined, topSoffitY - 30)).toHaveLength(2 + (2 * M + 1));
    });
  });
});
