/**
 * Landing thickness = Revit "Monolithic Landing → Same as Run" (Giorgio 2026-07-21).
 *
 * The landing slab inherits the run's structural depth — the μηρός waist slab —
 * whose SSoT is `StairParams.waistThickness` (ADR-395, default 150 mm). Two things
 * are verified:
 *   Π2 — the thickness is PARAMETRIC: lowering `waistThickness` thins the landing
 *        (e.g. 40 mm → "wooden" thin landing), no longer a hardcoded 200 mm.
 *   Π1 — with the 150 mm default < the 175 mm rise, the slab bottom stays ABOVE the
 *        lower tread's top, so the transition riser is no longer swallowed (the old
 *        hardcoded 200 mm > rise buried it).
 *
 * `extrudeFlatSlab` sets `mesh.position.y = baseY + topZ − thickness`, so the mesh's
 * `position.y` IS the slab's world bottom-face Y — the value asserted here.
 *
 * @see ../StairToThreeConverter.ts (resolveLandingThicknessMm / buildLandingMeshes)
 */

import { stairToMeshes } from '../StairToThreeConverter';
import { inferSceneUnitsFromWidth, sceneUnitsToMeters } from '../../../utils/scene-units';
import type { StairEntity } from '../../../bim/types/stair-types';

const P = (x: number, y: number, z: number) => ({ x, y, z });
const WIDTH = 900;
const RISE = 175;
const LANDING_Z = 875; // top face of the landing (5 · 175)
const LOWER_TREAD_TOP_Z = LANDING_Z - RISE; // 700 — top of the tread feeding the landing

/**
 * Minimal straight run whose top step opens onto a single landing quad at z=875.
 * Only `geometry.landings` matters for `buildLandingMeshes`; treads/risers are
 * empty so the sole emitted mesh is the landing.
 */
interface ThicknessOpts {
  readonly waistThickness?: number;
  readonly landingThickness?: number;
}

function makeStairWithLanding(opts: ThicknessOpts = {}): StairEntity {
  const landing = [
    P(0, 0, LANDING_Z),
    P(900, 0, LANDING_Z),
    P(900, WIDTH, LANDING_Z),
    P(0, WIDTH, LANDING_Z),
  ];
  return {
    id: 'stair_landing_thickness',
    type: 'stair',
    params: {
      basePoint: P(0, 0, 0),
      direction: 0,
      rise: RISE,
      tread: 270,
      width: WIDTH,
      stepCount: 6,
      riserType: 'closed',
      structureType: 'monolithic',
      handrails: { inner: false, outer: false, height: 900 },
      ...(opts.waistThickness !== undefined ? { waistThickness: opts.waistThickness } : {}),
      ...(opts.landingThickness !== undefined ? { landingThickness: opts.landingThickness } : {}),
    },
    geometry: {
      treads: [],
      treadsBelowCut: [],
      treadsAboveCut: [],
      risers: [],
      stringers: { inner: [], outer: [] },
      walkline: [P(0, 450, 0), P(900, 450, LANDING_Z)],
      handrails: {},
      landings: [landing],
      arrowSymbol: { start: P(0, 450, 0), end: P(500, 450, 0), label: 'UP' },
      bbox: { min: P(0, 0, 0), max: P(900, 900, LANDING_Z) },
    },
  } as unknown as StairEntity;
}

describe('StairToThreeConverter — landing thickness (Same as Run)', () => {
  const sceneToM = sceneUnitsToMeters(inferSceneUnitsFromWidth(WIDTH));
  const landingOf = (stair: StairEntity) =>
    stairToMeshes(stair).filter((m) => m.userData['stairComponent'] === 'landing');

  it('default (no waistThickness) → 150 mm structural depth, not the legacy 200 mm', () => {
    const landings = landingOf(makeStairWithLanding());
    expect(landings).toHaveLength(1);
    const bottomY = landings[0]!.position.y; // world bottom face
    expect(bottomY).toBeCloseTo(LANDING_Z * sceneToM - 0.150, 9);
    // Regression guard: the old hardcoded 200 mm would have put it at 0.675.
    expect(bottomY).not.toBeCloseTo(LANDING_Z * sceneToM - 0.200, 4);
  });

  it('Π2 — waistThickness drives it parametric ("Same as Run"): 40 mm → thin landing', () => {
    const bottomY = landingOf(makeStairWithLanding({ waistThickness: 40 }))[0]!.position.y;
    expect(bottomY).toBeCloseTo(LANDING_Z * sceneToM - 0.040, 9);
  });

  it('Π1 — default slab bottom stays ABOVE the lower tread top → riser not buried', () => {
    const bottomY = landingOf(makeStairWithLanding())[0]!.position.y;
    // 150 mm < 175 mm rise ⇒ bottom (0.725) above the lower tread top (0.700).
    expect(bottomY).toBeGreaterThan(LOWER_TREAD_TOP_Z * sceneToM);
  });

  it('a landing thicker than the rise would still bury it (documents the invariant)', () => {
    const bottomY = landingOf(makeStairWithLanding({ waistThickness: 200 }))[0]!.position.y;
    // waistThickness 200 > 175 rise ⇒ bottom (0.675) below the lower tread top (0.700).
    expect(bottomY).toBeLessThan(LOWER_TREAD_TOP_Z * sceneToM);
  });

  // ── Revit "Total Depth" override (landingThickness) ──────────────────────────
  it('landingThickness (Total Depth) WINS over waistThickness ("Same as Run")', () => {
    // waist 200 (thick RC) but landing explicitly 40 (timber) → 40 must render.
    const bottomY = landingOf(
      makeStairWithLanding({ waistThickness: 200, landingThickness: 40 }),
    )[0]!.position.y;
    expect(bottomY).toBeCloseTo(LANDING_Z * sceneToM - 0.040, 9);
  });

  it('landingThickness 40 mm → thin timber landing reachable below the RC waist floor', () => {
    const bottomY = landingOf(makeStairWithLanding({ landingThickness: 40 }))[0]!.position.y;
    expect(bottomY).toBeCloseTo(LANDING_Z * sceneToM - 0.040, 9);
    // And it clears the lower tread top ⇒ no burial.
    expect(bottomY).toBeGreaterThan(LOWER_TREAD_TOP_Z * sceneToM);
  });
});
