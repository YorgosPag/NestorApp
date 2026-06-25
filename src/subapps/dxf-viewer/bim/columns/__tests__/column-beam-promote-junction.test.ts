/**
 * ADR-529 — Tests: beam ΠΡΟΑΓΕΙ γωνιακή κολόνα μίας κατεύθυνσης σε Γ (boundary element).
 *
 *   (Α) Γεωμετρία `promoteColumnToBoundaryL`: διατηρεί την αρχική διατομή ως κατακόρυφο σκέλος + μεγαλώνει
 *       foot προς το δοκάρι (orientation-agnostic — 4 διατάξεις)· armWidth=στενή διάσταση, armLength=πλάτος
 *       δοκαριού, width=στενή+bearing, depth=μεγάλη διάσταση, position μετατοπισμένη κατά bearing/2.
 *   (Β) Detector `detectColumnPromotionsForBeam`: gates (ασύμμετρη + μη-αναπτυσσόμενη παρειά + γωνία +
 *       kind rectangular/shear-wall)· αρνητικά (συμμετρική / μέση παρειά / αναπτυσσόμενη παρειά / ήδη-L).
 *
 * Μονάδες: 'mm' (s=1).
 */

import { promoteColumnToBoundaryL } from '../column-beam-align';
import { detectColumnPromotionsForBeam, resyncPromotedBoundaryArmsForBeam } from '../column-beam-promote-junction';
import { rotateVector } from '../../grips/grip-math';
import type { Point2D } from '../../../rendering/types/Types';
import type { BeamEntity } from '../../types/beam-types';
import type { ColumnEntity, ColumnKind } from '../../types/column-types';

/** Ορθογωνική/τοιχείο κολόνα: footprint κεντραρισμένο (cx,cy), w(EW)×d(NS), rotation 0. */
function dirColumn(cx: number, cy: number, w: number, d: number, kind: ColumnKind = 'rectangular'): ColumnEntity {
  const hw = w / 2;
  const hd = d / 2;
  return {
    id: 'col_1', type: 'column', kind,
    params: { kind, position: { x: cx, y: cy, z: 0 }, width: w, depth: d, rotation: 0, sceneUnits: 'mm' },
    geometry: {
      footprint: {
        vertices: [
          { x: cx - hw, y: cy - hd, z: 0 }, { x: cx + hw, y: cy - hd, z: 0 },
          { x: cx + hw, y: cy + hd, z: 0 }, { x: cx - hw, y: cy + hd, z: 0 },
        ],
      },
    },
  } as unknown as ColumnEntity;
}

function beam(start: Point2D, end: Point2D, width = 250, depth = 500): BeamEntity {
  return {
    id: 'beam_1', type: 'beam', kind: 'straight',
    params: {
      kind: 'straight', startPoint: { x: start.x, y: start.y, z: 0 }, endPoint: { x: end.x, y: end.y, z: 0 },
      width, depth, topElevation: 3000, sceneUnits: 'mm',
    },
  } as unknown as BeamEntity;
}

const close = (a: number, b: number, tol = 1e-3): boolean => Math.abs(a - b) <= tol;

describe('promoteColumnToBoundaryL (ADR-529 γεωμετρία)', () => {
  // Κολόνα 250(EW) × 400(NS) — μίας κατεύθυνσης (αναπτύσσεται Β-Ν). Δοκάρι από δυτικά, κοντά στο βόρειο άκρο.
  it('(Α1) δοκάρι από δυτικά/βόρεια → σκέλος δυτικά, foot βορράς (flipY=false)', () => {
    const col = dirColumn(0, 0, 250, 400);
    const bm = beam({ x: -1500, y: 120 }, { x: -125, y: 120 }, 250, 500);
    const p = promoteColumnToBoundaryL(col, bm, 500)!;
    expect(p.kind).toBe('L-shape');
    expect(close(p.width, 750)).toBe(true);   // στενή(250) + bearing(500)
    expect(close(p.depth, 400)).toBe(true);   // μεγάλη διάσταση (κατακόρυφο σκέλος = αρχική κολόνα)
    expect(close(p.lshape!.armWidth!, 250)).toBe(true);   // πάχος κατακόρυφου σκέλους = στενή διάσταση
    expect(close(p.lshape!.armLength!, 250)).toBe(true);  // foot = πλάτος δοκαριού
    expect(p.lshape!.flipY).toBe(false);
    expect(close(p.position.x, -250)).toBe(true); // μετατόπιση bearing/2 δυτικά
    expect(close(p.position.y, 0)).toBe(true);
    // foot (τοπικό +X) δείχνει δυτικά (uArm = west)
    const foot = rotateVector({ x: 1, y: 0 }, p.rotation!);
    expect(close(foot.x, -1)).toBe(true);
    expect(close(foot.y, 0)).toBe(true);
  });

  it('(Α2) δοκάρι από δυτικά/νότια → flipY=true (foot νότος)', () => {
    const col = dirColumn(0, 0, 250, 400);
    const bm = beam({ x: -1500, y: -120 }, { x: -125, y: -120 }, 250, 500);
    const p = promoteColumnToBoundaryL(col, bm, 500)!;
    expect(p.lshape!.flipY).toBe(true);
    expect(close(p.position.x, -250)).toBe(true);
  });

  it('(Α3) δοκάρι από ανατολικά → σκέλος ανατολικά (position +x, foot east)', () => {
    const col = dirColumn(0, 0, 250, 400);
    const bm = beam({ x: 1500, y: 120 }, { x: 125, y: 120 }, 250, 500);
    const p = promoteColumnToBoundaryL(col, bm, 500)!;
    expect(close(p.position.x, 250)).toBe(true);
    const foot = rotateVector({ x: 1, y: 0 }, p.rotation!);
    expect(close(foot.x, 1)).toBe(true);
    expect(close(foot.y, 0)).toBe(true);
  });

  it('(Α4) orientation-agnostic — στραμμένη κολόνα 30°: foot ∥ στενός άξονας', () => {
    const rot = 30;
    const rad = (rot * Math.PI) / 180;
    const shortAxis = { x: Math.cos(rad), y: Math.sin(rad) }; // W≤D → localX
    const longAxis = { x: -Math.sin(rad), y: Math.cos(rad) };
    const col = dirColumn(0, 0, 250, 400);
    (col.params as { rotation: number }).rotation = rot;
    // δοκάρι κατά τον στενό άξονα (near→far = +shortAxis)
    const near = { x: shortAxis.x * 125, y: shortAxis.y * 125 };
    const far = { x: shortAxis.x * 1500, y: shortAxis.y * 1500 };
    const p = promoteColumnToBoundaryL(col, beam(far, near, 250, 500), 500)!;
    const foot = rotateVector({ x: 1, y: 0 }, p.rotation!);
    expect(close(foot.x, shortAxis.x, 1e-2)).toBe(true); // foot ∥ +shortAxis (προς το δοκάρι)
    expect(close(foot.y, shortAxis.y, 1e-2)).toBe(true);
    expect(close(foot.x * longAxis.x + foot.y * longAxis.y, 0, 1e-2)).toBe(true); // ⊥ μεγάλος άξονας
  });

  it('(Α5) εκφυλισμένο δοκάρι → null', () => {
    const col = dirColumn(0, 0, 250, 400);
    expect(promoteColumnToBoundaryL(col, beam({ x: 5, y: 5 }, { x: 5, y: 5 }), 500)).toBeNull();
  });
});

describe('detectColumnPromotionsForBeam (ADR-529 detector)', () => {
  // Δοκάρι από δυτικά, framing στη δυτική (στενή) παρειά, κοντά στο βόρειο άκρο = γωνία.
  const cornerBeam = beam({ x: -1500, y: 120 }, { x: -125, y: 120 }, 250, 500);

  it('γωνιακή κολόνα μίας κατεύθυνσης + μη-αναπτυσσόμενη παρειά → 1 προαγωγή', () => {
    const col = dirColumn(0, 0, 250, 400);
    const out = detectColumnPromotionsForBeam(cornerBeam, [col, cornerBeam]);
    expect(out).toHaveLength(1);
    expect(out[0].columnId).toBe('col_1');
    expect(out[0].nextParams.kind).toBe('L-shape');
    expect(out[0].previousParams.kind).toBe('rectangular');
  });

  it('shear-wall (επιμήκης) ΣΥΜΠΕΡΙΛΑΜΒΑΝΕΤΑΙ (decision #4)', () => {
    const wall = dirColumn(0, 0, 200, 1200, 'shear-wall');
    const bm = beam({ x: -1500, y: 500 }, { x: -100, y: 500 }, 250, 500); // στενή παρειά, κοντά σε άκρο
    expect(detectColumnPromotionsForBeam(bm, [wall, bm])).toHaveLength(1);
  });

  it('συμμετρική (ratio<1.2) → καμία προαγωγή', () => {
    const col = dirColumn(0, 0, 300, 330);
    expect(detectColumnPromotionsForBeam(cornerBeam, [col, cornerBeam])).toHaveLength(0);
  });

  it('δοκάρι στη ΜΕΣΗ της παρειάς (όχι γωνία) → καμία προαγωγή', () => {
    const col = dirColumn(0, 0, 250, 400);
    const midBeam = beam({ x: -1500, y: 0 }, { x: -125, y: 0 }, 250, 500);
    expect(detectColumnPromotionsForBeam(midBeam, [col, midBeam])).toHaveLength(0);
  });

  it('δοκάρι στην ΑΝΑΠΤΥΣΣΟΜΕΝΗ παρειά (∥ μεγάλος άξονας) → καμία προαγωγή', () => {
    const col = dirColumn(0, 0, 250, 400);
    const longFaceBeam = beam({ x: 0, y: 1500 }, { x: 0, y: 200 }, 250, 500); // κάθετο, βόρεια παρειά
    expect(detectColumnPromotionsForBeam(longFaceBeam, [col, longFaceBeam])).toHaveLength(0);
  });

  it('ήδη L-shape → καμία προαγωγή (ήδη 2-directional)', () => {
    const col = dirColumn(0, 0, 250, 400, 'L-shape');
    expect(detectColumnPromotionsForBeam(cornerBeam, [col, cornerBeam])).toHaveLength(0);
  });

  it('νέο entity όχι δοκάρι → άδειο', () => {
    const col = dirColumn(0, 0, 250, 400);
    expect(detectColumnPromotionsForBeam(col as unknown as BeamEntity, [col])).toHaveLength(0);
  });
});

describe('resyncPromotedBoundaryArmsForBeam (ADR-529 Φ5 — associative foot ↔ beam width)', () => {
  /** Προαχθείσα Γ-κολόνα με σύνδεσμο προς το δοκάρι (foot armLength = παλιό πλάτος δοκαριού). */
  function promotedLColumn(armLength: number, promotedFromBeamId?: string): ColumnEntity {
    return {
      id: 'col_L', type: 'column', kind: 'L-shape',
      params: {
        kind: 'L-shape', position: { x: 0, y: 0, z: 0 }, width: 450, depth: 400, rotation: 0, sceneUnits: 'mm',
        lshape: { armWidth: 250, armLength, flipY: false, promotedFromBeamId },
      },
      geometry: { footprint: { vertices: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }] } },
    } as unknown as ColumnEntity;
  }

  it('δοκάρι ξανα-διαστασιολογήθηκε (200→250) → foot ακολουθεί στα 250 (EC2/EC8 έδραση ≥ δοκάρι)', () => {
    const col = promotedLColumn(200, 'beam_1');
    const bm = beam({ x: -1500, y: 0 }, { x: -125, y: 0 }, 250, 500); // width τώρα 250
    const out = resyncPromotedBoundaryArmsForBeam(bm, [col, bm]);
    expect(out).toHaveLength(1);
    expect(out[0].columnId).toBe('col_L');
    expect(out[0].nextParams.lshape?.armLength).toBe(250);
    expect(out[0].nextParams.lshape?.armWidth).toBe(250); // leg αμετάβλητο
    expect(out[0].previousParams.lshape?.armLength).toBe(200);
  });

  it('convergence guard: armLength ήδη = πλάτος δοκαριού → άδειο (idempotent, μηδέν κύκλος)', () => {
    const col = promotedLColumn(250, 'beam_1');
    const bm = beam({ x: -1500, y: 0 }, { x: -125, y: 0 }, 250, 500);
    expect(resyncPromotedBoundaryArmsForBeam(bm, [col, bm])).toHaveLength(0);
  });

  it('ασφάλεια: user-drawn L (χωρίς promotedFromBeamId) ΔΕΝ αγγίζεται', () => {
    const col = promotedLColumn(200, undefined);
    const bm = beam({ x: -1500, y: 0 }, { x: -125, y: 0 }, 250, 500);
    expect(resyncPromotedBoundaryArmsForBeam(bm, [col, bm])).toHaveLength(0);
  });

  it('ασφάλεια: L προαχθείσα από ΑΛΛΟ δοκάρι → δεν αγγίζεται από αυτό', () => {
    const col = promotedLColumn(200, 'beam_OTHER');
    const bm = beam({ x: -1500, y: 0 }, { x: -125, y: 0 }, 250, 500);
    expect(resyncPromotedBoundaryArmsForBeam(bm, [col, bm])).toHaveLength(0);
  });

  it('entity όχι δοκάρι → άδειο', () => {
    const col = promotedLColumn(200, 'beam_1');
    expect(resyncPromotedBoundaryArmsForBeam(col as unknown as BeamEntity, [col])).toHaveLength(0);
  });
});
