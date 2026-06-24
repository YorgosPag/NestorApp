/**
 * ADR-523 — Τ-κεφαλή multi-reference flush snap (Revit alignment references).
 *
 * Επαληθεύει: (α) τις 3 reference offsets της κεφαλής από τη γεωμετρία· (β) τον matcher
 * nearest-wins (Γ↔Δ axis, 1-2↔νότια παρειά, ολίσθηση κατά μήκος, βόρεια πλευρά→στροφή 180,
 * εκτός μήκους→null)· (γ) integration μέσω του resolver (head → center anchor, μη-Τ → αδρανές).
 */

import {
  buildColumnHeadReferences,
  resolveColumnHeadReferenceSnap,
} from '../column-reference-lines';
import { resolveColumnFaceSnapFromTargets } from '../column-face-snap';
import type { LinearMemberSnapTarget } from '../../framing/linear-member-face-snap';
import type { SceneSnapTargets } from '../../framing/scene-snap-targets';

// Οριζόντιος τοίχος (0,0)→(1000,0), πάχος 250 (ημι-πάχος 125). 'mm' scene units (factor 1).
const WALL: LinearMemberSnapTarget = {
  id: 'w1',
  axis: [{ x: 0, y: 0 }, { x: 1000, y: 0 }],
  outline: [{ x: 0, y: 125 }, { x: 1000, y: 125 }, { x: 1000, y: -125 }, { x: 0, y: -125 }],
};

// T-κεφαλή: depth 600 → hd 300· flangeThickness 200 → perps [300 (1-2), 200 (Γ), 100 (ε)], alongHalf 200.
const HEAD = { perps: [300, 200, 100], alongHalf: 200 };

const emptyTargets = (wallTargets: readonly LinearMemberSnapTarget[]): SceneSnapTargets => ({
  footprints: [], circularFootprints: [], beamTargets: [], wallTargets,
  slabTargets: [], footprintEdgeTargets: [], lineTargets: [], diskTargets: [],
  rectTargets: [], wallEntities: [], openings: [],
});

describe('ADR-523 — buildColumnHeadReferences (γεωμετρία κεφαλής)', () => {
  it('Τ-shape → signed perps [1-2, Γ, ε] + ημι-μήκος', () => {
    const r = buildColumnHeadReferences('T-shape', 400, 600, { flangeThickness: 200 }, 'mm');
    expect(r).not.toBeNull();
    expect(r!.perps).toEqual([300, 200, 100]);
    expect(r!.alongHalf).toBe(200);
  });

  it('flipY → τα offsets γίνονται αρνητικά (κεφαλή στο −y)', () => {
    const r = buildColumnHeadReferences('T-shape', 400, 600, { flangeThickness: 200, flipY: true }, 'mm');
    expect(r!.perps).toEqual([-300, -200, -100]);
  });

  it('μη-Τ kind → null (tier αδρανής, μηδέν regression)', () => {
    expect(buildColumnHeadReferences('rectangular', 400, 600, undefined, 'mm')).toBeNull();
    expect(buildColumnHeadReferences('circular', 400, 600, undefined, 'mm')).toBeNull();
  });
});

describe('ADR-523 — resolveColumnHeadReferenceSnap (matcher nearest-wins)', () => {
  it('cursor κοντά στον άξονα από νότια → Γ↔Δ (κέντρο −200, στροφή 0)', () => {
    const r = resolveColumnHeadReferenceSnap({ x: 500, y: -210 }, [WALL], HEAD, 'mm');
    expect(r).not.toBeNull();
    expect(r!.position.x).toBeCloseTo(500);
    expect(r!.position.y).toBeCloseTo(-200); // Γ(+200) landing στον άξονα(0)
    expect(r!.rotation).toBeCloseTo(0);
    expect(r!.dist).toBeCloseTo(10);
  });

  it('cursor βαθιά νότια → 1-2 ↔ νότια παρειά τοίχου (κέντρο −425)', () => {
    const r = resolveColumnHeadReferenceSnap({ x: 500, y: -400 }, [WALL], HEAD, 'mm');
    expect(r!.position.y).toBeCloseTo(-425); // 1-2(+300) landing στη νότια παρειά(−125)
    expect(r!.rotation).toBeCloseTo(0);
  });

  it('cursor βόρεια → κέντρο +200, στροφή 180 (κεφαλή κοιτάει κάτω)', () => {
    const r = resolveColumnHeadReferenceSnap({ x: 500, y: 210 }, [WALL], HEAD, 'mm');
    expect(r!.position.y).toBeCloseTo(200);
    expect(r!.rotation).toBeCloseTo(180);
  });

  it('ολίσθηση κατά μήκος της παρειάς (along ακολουθεί τον cursor)', () => {
    const r = resolveColumnHeadReferenceSnap({ x: 800, y: -210 }, [WALL], HEAD, 'mm');
    expect(r!.position.x).toBeCloseTo(800);
    expect(r!.position.y).toBeCloseTo(-200);
  });

  it('εκτός μήκους τοίχου (+ημι-κεφαλή) → null (flush περιμετρικά)', () => {
    expect(resolveColumnHeadReferenceSnap({ x: 1300, y: -210 }, [WALL], HEAD, 'mm')).toBeNull();
  });

  it('χωρίς τοίχους → null', () => {
    expect(resolveColumnHeadReferenceSnap({ x: 500, y: -210 }, [], HEAD, 'mm')).toBeNull();
  });
});

describe('ADR-523 — integration μέσω resolveColumnFaceSnapFromTargets', () => {
  it('head παρόν → center anchor στον multi-reference (Γ↔Δ)', () => {
    const snap = resolveColumnFaceSnapFromTargets({ x: 500, y: -210 }, emptyTargets([WALL]), 'mm', undefined, HEAD);
    expect(snap).not.toBeNull();
    expect(snap!.anchor).toBe('center');
    expect(snap!.position.y).toBeCloseTo(-200);
    expect(snap!.rotation).toBeCloseTo(0);
  });

  it('head null (μη-Τ ghost) → ο tier δεν ενεργοποιείται (μηδέν regression)', () => {
    const withHead = resolveColumnFaceSnapFromTargets({ x: 500, y: -210 }, emptyTargets([WALL]), 'mm', undefined, HEAD);
    const without = resolveColumnFaceSnapFromTargets({ x: 500, y: -210 }, emptyTargets([WALL]), 'mm', undefined, null);
    // Με head → multi-reference (−200)· χωρίς head → ΟΧΙ multi-reference (διαφορετική/καμία λύση).
    expect(withHead!.position.y).toBeCloseTo(-200);
    expect(without?.position.y === -200).toBe(false);
  });
});
