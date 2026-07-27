/**
 * ADR-716 Φ7 — a DIMENSION must scale on its CANONICAL fields, not only on its deprecated mirrors.
 *
 * The live verification of the metre survey (`47_ergasia.dxf`, ×1000 canonical-mm pass) found all
 * 9 dimensions with `startPoint / defPoints[0] === 1000` exactly: the legacy mirrors had moved and
 * the drawn geometry had not. The builders read `defPoints` / `textMidpoint`, so the dimensions
 * rendered 1000× small near the world origin.
 *
 * These tests are parametrised over EVERY dimension variant — the bug was never about one drawing
 * or one variant, it was about which FIELDS the scale branch knows (Giorgio, 2026-07-27: solve the
 * class, not the sample).
 */
import { scaleEntity } from '../scale-entity-transform';
import type { Entity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';

const ORIGIN: Point2D = { x: 0, y: 0 };
/** The canonical-mm factor of a metre-authored survey — the case that exposed the bug. */
const MM = 1000;

interface DimOverrides {
  defPoints?: Point2D[];
  measurementValue?: number;
  [k: string]: unknown;
}

function dim(dimensionType: string, extra: DimOverrides = {}): Entity {
  return {
    id: `dimension_${dimensionType}`,
    type: 'dimension',
    layerId: 'L1',
    visible: true,
    styleId: '',
    dimensionType,
    defPoints: [{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }],
    textMidpoint: { x: 7, y: 8 },
    // Deprecated mirrors — the ONLY fields the pre-fix branch touched.
    startPoint: { x: 1, y: 2 },
    endPoint: { x: 3, y: 4 },
    textPosition: { x: 7, y: 8 },
    ...extra,
  } as unknown as Entity;
}

/** Every variant of the union — none may be left behind by the scale pass. */
const ALL_VARIANTS = [
  'linear', 'aligned', 'angular2L', 'angular3P', 'radius', 'diameter',
  'arcLength', 'joggedRadius', 'ordinate', 'baseline', 'continued',
] as const;

type ScaledDim = {
  defPoints?: Point2D[];
  textMidpoint?: Point2D;
  startPoint?: Point2D;
  datum?: Point2D;
  leaderLength?: number;
  measurementValue?: number;
  manualBreaks?: { dimLinePoints?: Point2D[]; extLine1Points?: Point2D[] };
};

/**
 * Apply the scale the way production does — `applyCanonicalMmScale` merges the partial back over
 * the entity (`{...e, ...scaleEntity(e, …)}`). Asserting on the bare partial would confuse
 * "field deliberately left alone" with "field erased"; only the merge tells them apart.
 */
function applyScale(entity: Entity, sx: number, sy: number): ScaledDim {
  return { ...(entity as unknown as ScaledDim), ...(scaleEntity(entity, ORIGIN, sx, sy) as ScaledDim) };
}

describe('scaleEntity — dimension canonical fields (ADR-716 Φ7)', () => {
  describe.each(ALL_VARIANTS)('variant "%s"', (variant) => {
    const out = applyScale(dim(variant), MM, MM);

    it('κλιμακώνει ΚΑΘΕ defPoint — αυτά διαβάζουν οι builders', () => {
      expect(out.defPoints).toEqual([{ x: 1000, y: 2000 }, { x: 3000, y: 4000 }, { x: 5000, y: 6000 }]);
    });

    it('κλιμακώνει το textMidpoint', () => {
      expect(out.textMidpoint).toEqual({ x: 7000, y: 8000 });
    });

    it('τα legacy mirrors μένουν σε συμφωνία με τα defPoints', () => {
      expect(out.startPoint).toEqual(out.defPoints?.[0]);
    });
  });

  it('ordinate: το datum είναι σημείο → κλιμακώνεται', () => {
    const out = applyScale(
      dim('ordinate', { datum: { x: 10, y: 20 }, axis: 'x' }), MM, MM,
    );
    expect(out.datum).toEqual({ x: 10000, y: 20000 });
  });

  it('radius: το leaderLength είναι μήκος → ×|sx|', () => {
    const out = applyScale(dim('radius', { leaderLength: 2.5 }), MM, MM);
    expect(out.leaderLength).toBe(2500);
  });

  it('DIMBREAK: τα world-space break points κλιμακώνονται', () => {
    const out = applyScale(
      dim('linear', { manualBreaks: { dimLinePoints: [{ x: 1, y: 1 }], extLine1Points: [{ x: 2, y: 2 }] } }), MM, MM,
    );
    expect(out.manualBreaks).toEqual({
      dimLinePoints: [{ x: 1000, y: 1000 }],
      extLine1Points: [{ x: 2000, y: 2000 }],
    });
  });

  describe('measurementValue — μήκος ή γωνία;', () => {
    it('linear/aligned: μήκος → ×|sx| (12 m ⇒ 12000 mm)', () => {
      const out = applyScale(dim('aligned', { measurementValue: 12 }), MM, MM);
      expect(out.measurementValue).toBe(12000);
    });

    it.each(['angular2L', 'angular3P'])('%s: μοίρες → ΑΜΕΤΑΒΛΗΤΟ', (variant) => {
      const out = applyScale(dim(variant, { measurementValue: 90 }), MM, MM);
      expect(out.measurementValue).toBe(90);
    });

    it('μη-ομοιόμορφη κλίμακα: το μήκος δεν ανακτάται από έναν συντελεστή → η cache πέφτει', () => {
      const out = applyScale(dim('linear', { measurementValue: 12 }), 2, 3);
      expect(out.measurementValue).toBeUndefined();
    });

    it('κατοπτρισμός (αρνητικό sx): το μήκος μένει θετικό', () => {
      const out = applyScale(dim('linear', { measurementValue: 12 }), -MM, -MM);
      expect(out.measurementValue).toBe(12000);
    });
  });

  it('παλιά οντότητα ΧΩΡΙΣ defPoints: δεν εφευρίσκεται πεδίο', () => {
    const legacy = dim('linear');
    delete (legacy as unknown as Record<string, unknown>).defPoints;
    delete (legacy as unknown as Record<string, unknown>).textMidpoint;
    const out = applyScale(legacy, MM, MM);
    expect(out.defPoints).toBeUndefined();
    expect(out.textMidpoint).toBeUndefined();
    expect(out.startPoint).toEqual({ x: 1000, y: 2000 });
  });
});
